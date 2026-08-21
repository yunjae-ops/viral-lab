# DATA_CONTRACT.md — 데이터 계약

각 경계(Excel ↔ 브라우저 ↔ 서버 API ↔ Claude ↔ Supabase)에서 오가는 데이터의 정확한 모양을 정의한다.
**AI가 반환하는 모든 JSON은 여기 스키마와 정확히 일치해야 하며, Zod로 런타임 검증한다.**

Scout Phase에 등장하는 Supabase 테이블은 §6.
현재 `promptVersion = v2` (Critical Gate 도입, D-023).

---

## 1. 입력 Excel

### 1.1 Header 목록

**필수 (3종):**

| Header 문자열 | 별칭 | 의미 |
|---|---|---|
| `순서` | — | 행 번호 |
| `/제목` | `레퍼런스 링크` | Threads 레퍼런스 URL |
| `리뷰내용` | `작성안`, `작성한 글` | 사용자가 쓴 콘텐츠 초안 (공백만이면 이 행 자체가 없음) |

**선택 (2종):**

| Header 문자열 | 의미 | 존재 시 동작 |
|---|---|---|
| `이미지 파일명` | 이미지 파일명 | 결과 표/ANALYZED에 그대로 실려 나감 |
| `레퍼런스 원문` | 레퍼런스 텍스트 전문 | Critical Gate 중 `appealTransfer`와 `referenceCoreAppeal / referenceViralEngine` 추출 활성화 |

### 1.2 Header 감지 알고리즘

1. Sheet의 첫 20행.
2. 각 셀 값을 `String(v)` → `trim`.
3. 필수 3종을 모두 포함(정확 일치 또는 별칭)하는 첫 행 = Header.
4. 못 찾으면 에러: `"Header를 찾지 못했습니다. 필수 컬럼: 순서, /제목(=레퍼런스 링크), 리뷰내용(=작성안=작성한 글)"`.
5. Header 다음 행부터 데이터.
6. `리뷰내용`이 빈 문자열/공백만인 행은 skip — **API 호출도 캐시 항목도 만들지 않는다.**

### 1.3 파싱 결과 (브라우저 메모리)

```ts
type ParsedRow = {
  index: number;
  sheetRowNumber: number;
  refUrl: string | null;
  draft: string;
  imageFilename: string | null;
  refOriginal: string | null;
};
```

---

## 2. 서버 API: 단일 행 분석

`POST /api/review/analyze-row`

### 2.1 Request Body

```json
{
  "index": 12,
  "draft": "사용자가 쓴 콘텐츠 초안 전체 문자열",
  "refOriginal": "레퍼런스 원문 문자열 또는 null",
  "refUrl": "https://www.threads.net/... 또는 null"
}
```

### 2.2 Response Body — `RowAnalysis` (promptVersion v2)

```json
{
  "index": 12,

  "hygiene": {
    "gates": {
      "G1_self_contained":   { "pass": true,  "evidence": "한 줄" },
      "G2_discovery":        { "pass": false, "evidence": "한 줄 (의미상 전환 판단 근거)" },
      "G3_narrative":        { "pass": true,  "evidence": "한 줄" },
      "G4_causal_structure": { "pass": true,  "evidence": "한 줄" }
    },
    "passedCount": 3,
    "grade": "B"
  },

  "critical": {
    "reference": {
      "coreAppeal": "이 콘텐츠에서 사람들이 실제로 욕망·반응한 핵심 소구 한 문장",
      "viralEngine": "그 소구를 강하게 만든 표현 장치·대비·반전·사회적 증거·반복사용 증거·관계·숫자·상황"
    },
    "draftCoreAppeal": "작성안에서 뽑아낸 핵심 소구 한 문장",
    "appealTransfer": {
      "value": "STRONG",
      "evidence": "왜 STRONG인지 한 줄",
      "deviationPoint": "가장 크게 소구가 이탈한 지점 (또는 이탈 없으면 null)"
    },
    "productCuriosity": {
      "value": "MEDIUM",
      "evidence": "왜 MEDIUM인지 한 줄"
    },
    "searchMotivation": {
      "value": "STRONG",
      "evidence": "왜 STRONG인지 한 줄 (본문 미완성/댓글 유도로 만들어진 궁금증이 아닌지 확인)",
      "liftDirection": "검색 동기를 높이기 위한 핵심 수정 방향"
    }
  },

  "diagnostic": {
    "hookCode": "C",
    "hookCodeReason": "왜 이 코드인지 한 줄",
    "newPatternCandidate": null,

    "emotion":        { "value": "시크함",  "otherLabel": null },
    "speaker":        { "value": "OTHER",  "otherLabel": "부부-부부 관찰" },
    "disclosureMode": { "value": "리스트", "otherLabel": null },

    "listHomogeneity":       { "applicable": true, "pass": true, "evidence": "..." },
    "salesMessageStandsOut": { "pass": true,  "evidence": "..." },
    "referenceCloneRisk":    { "applicable": true, "level": "low", "quotedFragments": [] },

    "healthClaimsToVerify": ["빈속에 물 1L 마시면 붓기 빠짐"],
    "topProblems": [
      "발견의 순간이 약함 — G2 재설계 필요",
      "결과 원인이 서술적임 — 구조화 필요"
    ],
    "revisionDirection": "두 번째 단락을 구조화된 원인 두 줄로 축약."
  },

  "finalVerdict": {
    "value": "NEEDS_REVISION",
    "reasons": [
      "hygiene.grade = B (Gate 2 실패)",
      "appealTransfer STRONG이지만 hygiene A 아님 → READY 불가"
    ]
  },

  "meta": {
    "model": "<서버 env ANTHROPIC_MODEL 값>",
    "promptVersion": "v2",
    "elapsedMs": 4321
  }
}
```

**`hookCode === "NEW_PATTERN_CANDIDATE"`일 때** `newPatternCandidate`:

```json
"newPatternCandidate": {
  "whyDifferent": "A~M 어느 것도 아닌 이유 한 줄",
  "structureSummary": "핵심 구조 요약",
  "proposedName": "임시 패턴명",
  "linguisticFeatures": ["짧은 구절1", "짧은 구절2"]
}
```

`hookCode !== "NEW_PATTERN_CANDIDATE"`이면 `null`. Zod refinement 강제.

### 2.3 스키마 규칙 (Zod)

**Hygiene:**
- `hygiene.grade` ∈ `"A" | "B" | "FAIL"`.
- `hygiene.passedCount` ∈ 0..4, gates의 `pass:true` 개수와 정확히 일치. 불일치 시 실패 = 재시도.
- 서버는 gates로 항상 `passedCount`·`grade`를 재계산해 덮어쓴다: `4→A, 3→B, 0-2→FAIL`.

**Critical:**
- `refOriginal === null || refOriginal === ""` 이면:
  - `critical.reference` MUST be `null`.
  - `critical.appealTransfer` MUST be `null`.
  - `critical.draftCoreAppeal`은 여전히 필수 (draft 단독에서도 뽑는다).
  - `critical.productCuriosity`, `critical.searchMotivation`은 필수.
- `refOriginal`이 존재하면:
  - `critical.reference.coreAppeal`, `critical.reference.viralEngine` 모두 비어 있지 않은 문자열.
  - `critical.appealTransfer` 객체 필수.
    - `value` ∈ `"STRONG" | "PARTIAL" | "MISMATCH"`.
    - `evidence` 비어 있지 않은 문자열.
    - `deviationPoint`는 문자열 또는 `null`.
- `critical.productCuriosity.value` ∈ `"STRONG" | "MEDIUM" | "WEAK"`, `evidence` 필수.
- `critical.searchMotivation.value` ∈ `"STRONG" | "MEDIUM" | "WEAK"`, `evidence`·`liftDirection` 필수.
- 모든 문자열 필드 최대 500자.
- **AI가 임의로 이 값들을 확정하지 못하도록** 프롬프트에서 다음 규칙 명시:
  - 정보량이 많다고 Search Motivation을 STRONG으로 평가하지 말 것.
  - 본문 미완성·댓글 유도로 만들어진 궁금증은 STRONG으로 평가하지 말 것.
  - `referenceCoreAppeal`은 단순 주제 요약이 아니라 심리적 소구 문장이어야 함.

**Final Verdict:**
- `finalVerdict.value` ∈ `"READY" | "NEEDS_REVISION" | "FAIL"`.
- AI가 반환한 값은 무시하고 **서버가 §2.4 규칙으로 재계산해 덮어쓴다.**
- `finalVerdict.reasons`는 서버가 채우는 문자열 배열(사람이 읽는 근거).

**Diagnostic 3축 enum:**
- `emotion.value` ∈ `절박함 | 시크함 | 순수감탄 | 놀람 | OTHER`
- `speaker.value` ∈ `본인 1인칭 | 딸-엄마 관찰 | 친구-친구 관찰 | 순수 목격자 | OTHER`
- `disclosureMode.value` ∈ `직접서술 | 리스트 | 대화체 | 선언문 | OTHER`
- OTHER면 `otherLabel` 필수, 비-OTHER면 `null` (Zod refinement).

**기타:**
- `referenceCloneRisk.applicable`은 `refOriginal`이 존재할 때만 `true`. `level` ∈ `"low" | "medium" | "high"`.
- `listHomogeneity.applicable`은 리스트형일 때만 `true`.
- `topProblems` 1~3개.
- 임의 백분율 필드(`salesRatioPercent` 등) 존재 금지.

### 2.4 Final Verdict 계산 규칙 (서버, 결정적)

Let `refExists = (refOriginal !== null && refOriginal !== "")`.

1. **FAIL** — 아래 중 **하나라도** 참이면 즉시 `FAIL`:
   - `hygiene.grade === "FAIL"`
   - `searchMotivation.value === "WEAK"`
   - `refExists && appealTransfer.value === "MISMATCH"`

2. **READY** — FAIL이 아니면서 **모두** 참이어야 `READY`:
   - `hygiene.grade === "A"`
   - `searchMotivation.value === "STRONG"`
   - `refExists ? appealTransfer.value === "STRONG" : true`

3. **NEEDS_REVISION** — 위 두 조건 어디에도 해당하지 않는 나머지.

**임의 100점 점수 방식 금지.** 규칙 조정 시 이 문서와 `docs/DECISIONS.md`(D-022)에 반영.

`reasons[]`는 서버가 원인을 나열:
- `"hygiene.grade = FAIL: G1, G3 실패"`
- `"searchMotivation = WEAK"`
- `"appealTransfer = MISMATCH — draftCoreAppeal이 referenceCoreAppeal의 핵심 긴장(가격/기대 역전)에서 이탈해 신제품 소개로 바뀜"`
- `"hygiene = A + appealTransfer = STRONG + searchMotivation = STRONG → READY"`

### 2.5 에러 응답

```json
{ "error": "SCHEMA_VALIDATION_FAILED", "detail": "..." }
```

서버가 최대 2회 재시도해도 실패면 이 에러. 클라이언트는 해당 행만 실패 표시.

---

## 3. 서버 API: Portfolio 분석

`POST /api/review/portfolio`

### 3.1 Request Body

```json
{
  "rows": [
    {
      "index": 1,
      "hygieneGrade": "A",
      "hookCode": "A",
      "emotion":        { "value": "시크함",     "otherLabel": null },
      "speaker":        { "value": "본인 1인칭", "otherLabel": null },
      "disclosureMode": { "value": "리스트",     "otherLabel": null },
      "appealTransfer": "STRONG",
      "productCuriosity": "MEDIUM",
      "searchMotivation": "STRONG",
      "finalVerdict": "READY",
      "hasReference": true
    }
  ]
}
```

- draft 본문·evidence는 보내지 않는다.
- `appealTransfer`는 `refOriginal`이 없었던 행에서는 `"N/A"`로 보낸다 (집계용).

### 3.2 Response Body — `PortfolioAnalysis`

```json
{
  "counts": {
    "hookCode": {
      "A": 12, "B": 3, "C": 0, "D": 0, "E": 0, "F": 0, "G": 0,
      "H": 0, "I": 0, "J": 0, "K": 0, "L": 0, "M": 0,
      "NEW_PATTERN_CANDIDATE": 2
    },
    "emotion":        { "절박함": 8, "시크함": 20, "순수감탄": 4, "놀람": 3, "OTHER": 1 },
    "speaker":        { "본인 1인칭": 25, "딸-엄마 관찰": 3, "친구-친구 관찰": 2, "순수 목격자": 4, "OTHER": 0 },
    "disclosureMode": { "직접서술": 12, "리스트": 15, "대화체": 4, "선언문": 3, "OTHER": 0 },
    "hygieneGrade":   { "A": 10, "B": 15, "FAIL": 9 },
    "appealTransfer": { "STRONG": 8,  "PARTIAL": 12, "MISMATCH": 5, "N/A": 9 },
    "productCuriosity": { "STRONG": 6, "MEDIUM": 18, "WEAK": 10 },
    "searchMotivation": { "STRONG": 5, "MEDIUM": 17, "WEAK": 12 },
    "finalVerdict":   { "READY": 4, "NEEDS_REVISION": 22, "FAIL": 8 }
  },
  "warnings": [
    { "kind": "OVERUSE",         "field": "hookCode",         "value": "A",        "ratio": 0.42 },
    { "kind": "MISMATCH_HEAVY",  "field": "appealTransfer",   "value": "MISMATCH", "ratio": 0.31 },
    { "kind": "SEARCH_WEAK_HEAVY","field": "searchMotivation","value": "WEAK",     "ratio": 0.36 },
    { "kind": "FORMAT_VS_SEARCH", "detail": "Hook·감정·화자 분포는 다양하지만 searchMotivation WEAK 비율이 임계치 초과 — 포맷은 다양하나 제품 관심으로 이어지지 않음" }
  ],
  "recommendation": {
    "text": "다음 소재에서 우선 채울 방향에 대한 자유서술 (Claude 생성)",
    "suggestedAngles": ["L × 친구관찰 × 대화체", "J × 시크함 × 선언문", "K × 순수목격자 × 리스트"]
  }
}
```

- `counts`·`warnings`는 서버가 결정적으로 계산.
- 초기 경고 임계치는 튜닝 값. 기본 제안: `OVERUSE` 0.40, `MISMATCH_HEAVY` 0.30, `SEARCH_WEAK_HEAVY` 0.35, `FORMAT_VS_SEARCH`는 Hook/감정/화자 각 최대 비율이 0.40 이하 AND `searchMotivation.WEAK` 비율이 0.30 이상일 때.
- `recommendation`만 Claude 호출 1회.

---

## 4. ANALYZED Excel 출력

### 4.1 시트 구성

- **시트 1:** 원본 그대로.
- **시트 2 `Analysis`:** 원본 컬럼 유지 + 다음 컬럼 추가 (순서 그대로):
  - `Hygiene등급` (`A`/`B`/`FAIL`), `G1`, `G2`, `G3`, `G4`
  - `참조소구`, `참조바이럴엔진`, `작성안소구`
  - `AppealTransfer`, `AppealTransfer근거`, `이탈지점`
  - `제품호기심`, `제품호기심근거`
  - `검색동기`, `검색동기근거`, `검색동기수정방향`
  - `최종판정` (`READY`/`NEEDS_REVISION`/`FAIL`), `판정근거`
  - `Hook`, `NewPatternName` (NEW_PATTERN_CANDIDATE일 때만 값)
  - `감정`, `감정_기타라벨`, `화자`, `화자_기타라벨`, `공개방식`, `공개방식_기타라벨`
  - `판매튐`, `유사도`, `건강주장`, `구조문제점`, `구조수정방향`
- **시트 3 `Portfolio`:** 집계표 + 경고 + AI recommendation.

### 4.2 파일명

`{원본파일명(확장자 제외)}_ANALYZED_{YYYYMMDD_HHmm}.xlsx`.

브라우저 다운로드. 원본은 절대 덮어쓰지 않는다.

---

## 5. 로컬 캐시 (localStorage, Review Phase 3 이후)

### 5.1 캐시 키

- 재료: `draft`, `refOriginal ?? ""`, `promptVersion` (현재 `v2`).
- `SHA-256(draft + "␞" + (refOriginal ?? "") + "␞" + promptVersion)` → hex.
- 프리픽스: `viral-lab:review:v2:<hash>`.

### 5.2 엔트리 스키마

```ts
type CacheEntry = {
  key: string;
  promptVersion: string;
  analyzedAt: string;
  result: RowAnalysis;
};
```

### 5.3 동작 규칙

- 분석 시작 시 캐시 조회 → 히트면 Claude 호출 생략.
- "이 행 강제 재분석" / "전체 강제 재분석" / "캐시 비우기" 버튼.
- `promptVersion` 상승 시 프리픽스 변경으로 자연 무효화.
- 빈 draft 행은 캐시 없음.
- 크기 관리: timestamp 기준 LRU-lite, 4MB 근접 시 축출.
- 향후 서버 DB로 확장 가능한 구조 유지.

---

## 6. Supabase (Scout Phase 이후에만 도입)

Review Phase에서는 이 절 전체를 무시. Scout Phase B부터 실제 테이블 생성. 자세한 설계 이유는 `docs/SCOUT_DESIGN.md`.

### 6.1 `search_families`

| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | uuid | PK |
| `name` | text | unique |
| `description` | text | |
| `enabled` | boolean | 기본 true |
| `created_at` | timestamptz | |

### 6.2 `seed_queries`

| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | uuid | PK |
| `family_id` | uuid | FK → `search_families.id` |
| `query` | text | |
| `state` | text | `ACTIVE` \| `CANDIDATE` \| `REJECTED` \| `DISABLED` |
| `provenance` | text | `USER_MANUAL` \| `AI_EXPANSION` \| `SAVED_REFERENCE` \| `DISCOVERED_PATTERN` |
| `parent_seed_id` | uuid | nullable, 자기 참조 |
| `source_reference_id` | uuid | nullable, FK → `saved_references.id` |
| `enabled` | boolean | |
| `notes` | text | |
| `created_at` | timestamptz | |
| `created_by` | text | `user` \| `ai` |

- unique(`family_id`, `query`).
- AI 생성 Query는 반드시 `state = "CANDIDATE"`.

### 6.3 `scout_candidates`

| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | uuid | PK |
| `permalink` | text | **unique** |
| `text` | text | |
| `username` | text | |
| `posted_at` | timestamptz | |
| `collected_at` | timestamptz | |
| `seed_query_id` | uuid | FK |
| `search_mode` | text | `TOP` \| `RECENT` |
| `classification` | text | `A~M` \| `NEW_PATTERN_CANDIDATE` \| `UNCLASSIFIED` |
| `new_pattern_proposed_name` | text | nullable |
| `hook` | text | nullable |
| `emotion` | text | enum 또는 `OTHER` |
| `emotion_other_label` | text | nullable |
| `speaker` | text | enum 또는 `OTHER` |
| `speaker_other_label` | text | nullable |
| `disclosure_mode` | text | enum 또는 `OTHER` |
| `disclosure_mode_other_label` | text | nullable |
| `family_id` | uuid | 후보를 데려온 Family (캐시) |
| `cluster_id` | uuid | nullable |
| `quality_score` | numeric | |
| `novelty_score` | numeric | |
| `similarity_max` | numeric | |
| `views` | integer | nullable |
| `view_source` | text | `PUBLIC_UI` \| `MANUAL` \| `UNAVAILABLE` |
| `view_checked_at` | timestamptz | nullable |
| `status` | text | `RAW` \| `RECOMMENDED` \| `SAVED` \| `REJECTED` |
| `manual_body` | text | 사용자가 붙여넣은 원문 fallback |
| `notes` | text | |

인덱스: `posted_at desc`, `collected_at desc`, `status`, `cluster_id`.

### 6.4 `saved_references`

| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | uuid | PK |
| `candidate_id` | uuid | FK, nullable |
| `text` | text | |
| `permalink` | text | unique nullable |
| `hook` | text | |
| `emotion` | text | |
| `speaker` | text | |
| `disclosure_mode` | text | |
| `structure_summary` | text | |
| `core_appeal` | text | nullable — 향후 Review의 referenceCoreAppeal 개념을 재사용 가능 |
| `viral_engine` | text | nullable |
| `tags` | text[] | |
| `saved_at` | timestamptz | |

### 6.5 `rejected_candidates`

| 컬럼 | 타입 |
|---|---|
| `id` | uuid |
| `candidate_id` | uuid |
| `reason` | text |
| `rejected_at` | timestamptz |

### 6.6 `query_runs`

| 컬럼 | 타입 |
|---|---|
| `id` | uuid |
| `seed_query_id` | uuid |
| `search_mode` | text |
| `run_at` | timestamptz |
| `raw_count` | integer |
| `deduped_count` | integer |
| `recommended_count` | integer |
| `saved_count` | integer |
| `error` | text |

### 6.7 `pattern_candidates`

| 컬럼 | 타입 |
|---|---|
| `id` | uuid |
| `proposed_name` | text |
| `structure_summary` | text |
| `linguistic_features` | text[] |
| `first_seen_at` | timestamptz |
| `occurrence_count` | integer |
| `state` | text — `PENDING` \| `APPROVED` \| `REJECTED` |
| `approved_hook_code` | text |

---

## 7. 환경변수 (서버 전용)

| 이름 | 언제부터 | 용도 |
|---|---|---|
| `ANTHROPIC_API_KEY` | Review Phase 2 | Claude |
| `ANTHROPIC_MODEL` | Review Phase 2 | 모델 ID (하드코딩 금지) |
| `REVIEW_SHARED_PASSWORD` | Vercel 배포 순간 (Review Phase 6) | 인증 |
| `THREADS_ACCESS_TOKEN` (예정) | Scout Phase A | Threads API |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (예정) | Scout Phase B | Supabase |

**`NEXT_PUBLIC_` 접두어 금지.**

---

## 8. 버전·마이그레이션 규칙

- 스키마·프롬프트 변경 시:
  1. `promptVersion` 상승 (`v2` → `v3` 등).
  2. Zod 스키마 파일 새 버전으로 분리.
  3. `docs/DECISIONS.md`에 이유.
  4. 캐시 자동 무효화 (프리픽스 변경).
- Final Verdict 규칙 조정은 promptVersion 상승 없이 가능하지만 `DECISIONS.md` D-022에 반영.
- Supabase 스키마 변경은 마이그레이션 SQL을 별도 파일로 커밋.
