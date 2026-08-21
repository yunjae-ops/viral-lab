# DATA_CONTRACT.md — 데이터 계약

각 경계(Excel ↔ 브라우저 ↔ 서버 API ↔ Claude ↔ Supabase)에서 오가는 데이터의 정확한 모양을 정의한다.
**AI가 반환하는 모든 JSON은 여기 스키마와 정확히 일치해야 하며, Zod로 런타임 검증한다.**

> 용어: "런타임 검증" = 코드가 실제로 도는 순간, JSON 각 필드가 기대한 타입·형식인지 확인하는 것.

Scout Phase에 등장하는 Supabase 테이블은 §6에 집중돼 있다.

---

## 1. 입력 Excel

### 1.1 Header 목록

**필수 (3종):**

| Header 문자열 | 별칭 | 의미 | 값 타입 |
|---|---|---|---|
| `순서` | — | 행 번호 | number 또는 문자열 숫자 |
| `/제목` | `레퍼런스 링크` | Threads 레퍼런스 URL | 문자열(URL 또는 빈값) |
| `리뷰내용` | `작성안`, `작성한 글` | 사용자가 쓴 콘텐츠 초안 | 문자열 (공백만이면 이 행 자체가 없음) |

**선택 (2종):**

| Header 문자열 | 의미 | 존재 시 동작 |
|---|---|---|
| `이미지 파일명` | 이미지 파일명 | 결과 표/ANALYZED에 그대로 실려 나감 |
| `레퍼런스 원문` | 레퍼런스 텍스트 전문 | 레퍼런스 vs 작성안 구조 비교 활성화 |

### 1.2 Header 감지 알고리즘

1. Sheet의 첫 20행을 순서대로.
2. 각 셀 값을 `String(v)` → **`trim`**.
3. 필수 Header 3종을 모두 포함(정확 일치 또는 별칭 중 하나)하는 첫 행을 Header로 확정.
4. 못 찾으면 에러: `"Header를 찾지 못했습니다. 필수 컬럼: 순서, /제목(=레퍼런스 링크), 리뷰내용(=작성안=작성한 글)"`.
5. Header 다음 행부터 데이터.
6. `리뷰내용`이 빈 문자열/공백만인 행은 skip — **API 호출도, 캐시 항목도 만들지 않는다.**

### 1.3 파싱 결과 (브라우저 메모리)

```ts
type ParsedRow = {
  index: number;                // "순서" 값 그대로
  sheetRowNumber: number;       // Excel 물리 행 번호 (1-based)
  refUrl: string | null;        // /제목 = 레퍼런스 링크
  draft: string;                // 리뷰내용 = 작성안 = 작성한 글 (필수)
  imageFilename: string | null; // 컬럼 없거나 값 없으면 null
  refOriginal: string | null;   // 컬럼 없거나 값 없으면 null
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

### 2.2 Response Body — `RowAnalysis`

```json
{
  "index": 12,
  "core": {
    "gates": {
      "G1_self_contained":   { "pass": true,  "evidence": "한 줄" },
      "G2_discovery":        { "pass": false, "evidence": "한 줄 (의미상 전환 판단 근거)" },
      "G3_narrative":        { "pass": true,  "evidence": "한 줄" },
      "G4_causal_structure": { "pass": true,  "evidence": "한 줄" }
    },
    "passedCount": 3,
    "grade": "B"
  },
  "diagnostic": {
    "hookCode": "C",
    "hookCodeReason": "왜 이 코드인지 한 줄",
    "newPatternCandidate": null,

    "emotion":         { "value": "시크함",   "otherLabel": null },
    "speaker":         { "value": "OTHER",   "otherLabel": "부부-부부 관찰" },
    "disclosureMode":  { "value": "리스트",  "otherLabel": null },

    "listHomogeneity":       { "applicable": true, "pass": true, "evidence": "..." },
    "salesMessageStandsOut": { "pass": true,  "evidence": "..." },
    "referenceCloneRisk":    { "applicable": true, "level": "low", "quotedFragments": [] },

    "healthClaimsToVerify": ["빈속에 물 1L 마시면 붓기 빠짐"],
    "topProblems": [
      "발견의 순간이 약함 — G2 재설계 필요",
      "결과 원인이 서술적임 — 구조화 필요"
    ],
    "revisionDirection": "결과 → 결과의 원인 두 번째 단락을 구조화된 원인 두 줄로 축약."
  },
  "meta": {
    "model": "<서버 env ANTHROPIC_MODEL 값>",
    "promptVersion": "v1",
    "elapsedMs": 4321
  }
}
```

**`newPatternCandidate`가 존재하는 경우** (`hookCode === "NEW_PATTERN_CANDIDATE"`):

```json
"newPatternCandidate": {
  "whyDifferent": "A~M 어느 것도 아닌 이유 한 줄",
  "structureSummary": "핵심 구조 요약",
  "proposedName": "임시 패턴명",
  "linguisticFeatures": ["짧은 구절1", "짧은 구절2"]
}
```

`hookCode !== "NEW_PATTERN_CANDIDATE"`이면 `newPatternCandidate === null`. Zod refinement로 강제.

### 2.3 스키마 규칙 (Zod)

- `core.grade` ∈ `"A" | "B" | "FAIL"` — **C·D 없음.**
- `core.passedCount` ∈ 0..4, gates의 `pass:true` 개수와 정확히 일치(불일치 시 스키마 실패 = 재시도).
- 등급은 서버가 gates로 항상 재계산해 덮어쓴다: `4→A`, `3→B`, `0-2→FAIL`.

**Hook Code:**
- `diagnostic.hookCode` ∈ `A|B|C|D|E|F|G|H|I|J|K|L|M | NEW_PATTERN_CANDIDATE`.
- `NEW_PATTERN_CANDIDATE`이면 `newPatternCandidate` 객체 필수, 그 외에는 `null`.

**Diagnostic 3축 enum:**
- `emotion.value` ∈ `절박함 | 시크함 | 순수감탄 | 놀람 | OTHER`
- `speaker.value` ∈ `본인 1인칭 | 딸-엄마 관찰 | 친구-친구 관찰 | 순수 목격자 | OTHER`
- `disclosureMode.value` ∈ `직접서술 | 리스트 | 대화체 | 선언문 | OTHER`

**OTHER 규칙 (강제):**
- `value === "OTHER"` ⇒ `otherLabel`은 비어 있지 않은 문자열
- `value !== "OTHER"` ⇒ `otherLabel === null`
- Zod refinement로 양방향 검사.

**기타:**
- `referenceCloneRisk.applicable`은 `refOriginal`이 존재할 때만 `true`. `level` ∈ `"low" | "medium" | "high"`.
- `listHomogeneity.applicable`은 리스트형일 때만 `true`.
- `salesMessageStandsOut.pass`가 `true`이면 "튀지 않음", `false`이면 "튐".
- `healthClaimsToVerify`, `topProblems`, `linguisticFeatures` 문자열 요소 최대 500자.
- `topProblems`는 1~3개.
- `revisionDirection`은 문자열, 최대 500자.
- AI는 근거 없는 수치를 만들지 않는다. `salesRatioPercent` 같은 임의 백분율 필드는 이 스키마에 존재하지 않는다(D-011 참조).

### 2.4 에러 응답

```json
{ "error": "SCHEMA_VALIDATION_FAILED", "detail": "..." }
```

서버가 최대 2회 재시도했는데도 실패면 이 에러. 클라이언트는 해당 행만 실패 표시.

---

## 3. 서버 API: Portfolio 분석

`POST /api/review/portfolio`

### 3.1 Request Body

```json
{
  "rows": [
    {
      "index": 1,
      "grade": "A",
      "hookCode": "A",
      "emotion":        { "value": "시크함",     "otherLabel": null },
      "speaker":        { "value": "본인 1인칭", "otherLabel": null },
      "disclosureMode": { "value": "리스트",     "otherLabel": null }
    }
  ]
}
```

draft 본문은 보내지 않는다.

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
    "grade":          { "A": 10, "B": 15, "FAIL": 9 }
  },
  "warnings": [
    { "kind": "OVERUSE", "field": "hookCode", "value": "A", "ratio": 0.42 }
  ],
  "recommendation": {
    "text": "다음 소재에서 우선 채울 방향에 대한 자유서술 (Claude 생성)",
    "suggestedAngles": ["L × 친구관찰 × 대화체", "J × 시크함 × 선언문", "K × 순수목격자 × 리스트"]
  }
}
```

- `counts`·`warnings`는 서버가 결정적으로 계산.
- `recommendation`만 Claude 호출 1회.
- 등급 카운트 키는 정확히 `A | B | FAIL`.

---

## 4. ANALYZED Excel 출력

### 4.1 시트 구성

- **시트 1:** 원본 그대로.
- **시트 2 `Analysis`:** 원본 컬럼 유지 + 다음 컬럼 추가:
  - `등급` (`A`/`B`/`FAIL`), `G1`, `G2`, `G3`, `G4`
  - `Hook`, `NewPatternName`(NEW_PATTERN_CANDIDATE일 때만 값)
  - `감정`, `감정_기타라벨`, `화자`, `화자_기타라벨`, `공개방식`, `공개방식_기타라벨`
  - `판매튐`, `유사도`, `건강주장`, `문제점`, `수정방향`
- **시트 3 `Portfolio`:** 집계표 + 경고 + AI `recommendation.text`·`suggestedAngles`.

### 4.2 파일명

`{원본파일명(확장자 제외)}_ANALYZED_{YYYYMMDD_HHmm}.xlsx`

브라우저 다운로드. 원본은 절대 덮어쓰지 않는다.

---

## 5. 로컬 캐시 (localStorage, Review Phase 3 이후)

Supabase·IndexedDB는 Review에서 사용하지 않는다.

### 5.1 캐시 키

- 재료: `draft`, `refOriginal ?? ""`, `promptVersion`.
- `SHA-256(draft + "␞" + (refOriginal ?? "") + "␞" + promptVersion)` → hex.
- 저장 프리픽스: `viral-lab:review:v1:<hash>`.

> `␞` = 화면에 안 보이는 구분 문자. 서로 다른 두 입력이 우연히 같은 결합 문자열이 되는 걸 막는다.

### 5.2 엔트리 스키마

```ts
type CacheEntry = {
  key: string;
  promptVersion: string;
  analyzedAt: string;   // ISO
  result: RowAnalysis;
};
```

### 5.3 동작 규칙

- 분석 시작 시 각 행 캐시 조회 → 히트면 Claude 호출 생략.
- "이 행 강제 재분석" / "전체 강제 재분석" / "캐시 비우기" 버튼 제공.
- `promptVersion` 상승 시 자연 무효화.
- 빈 draft 행은 캐시도 만들지 않는다.
- 크기 관리: 초기엔 timestamp 기준 단순 LRU-lite. localStorage 4MB 근접 시 축출.
- 향후 서버 DB로 확장 가능한 구조 유지 (같은 key 개념 재사용).

---

## 6. Supabase (Scout Phase 이후에만 도입)

Review Phase에서는 이 절 전체를 무시한다.
Scout Phase B부터 실제 테이블 생성. 자세한 설계 이유는 `docs/SCOUT_DESIGN.md`.

### 6.1 `search_families`

| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | uuid | PK |
| `name` | text | unique. 예: `발견`, `기대 뒤집기`, `반복사용/중독` |
| `description` | text | 사용자 메모 |
| `enabled` | boolean | 기본 true |
| `created_at` | timestamptz | |

### 6.2 `seed_queries`

| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | uuid | PK |
| `family_id` | uuid | FK → `search_families.id` |
| `query` | text | 검색어 원문 |
| `state` | text | `ACTIVE` \| `CANDIDATE` \| `REJECTED` \| `DISABLED` |
| `provenance` | text | `USER_MANUAL` \| `AI_EXPANSION` \| `SAVED_REFERENCE` \| `DISCOVERED_PATTERN` |
| `parent_seed_id` | uuid | nullable, 자기 참조 |
| `source_reference_id` | uuid | nullable, FK → `saved_references.id` |
| `enabled` | boolean | state=ACTIVE의 실제 실행 스위치 |
| `notes` | text | |
| `created_at` | timestamptz | |
| `created_by` | text | `user` \| `ai` |

- unique(`family_id`, `query`)로 중복 방지.
- AI 생성 Query는 반드시 `state = "CANDIDATE"`로 시작. 사용자 승인 시 `ACTIVE`.

### 6.3 `scout_candidates`

수집된 원 후보. Novelty/Similarity/Diversity 판정은 여기 값으로 이루어진다.

| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | uuid | PK |
| `permalink` | text | **unique** (Exact Dedup 키) |
| `text` | text | Threads 본문 |
| `username` | text | |
| `posted_at` | timestamptz | 게시 시각 |
| `collected_at` | timestamptz | 수집 시각 |
| `seed_query_id` | uuid | FK → `seed_queries.id` |
| `search_mode` | text | `TOP` \| `RECENT` |
| `classification` | text | `A~M` \| `NEW_PATTERN_CANDIDATE` \| `UNCLASSIFIED` |
| `new_pattern_proposed_name` | text | nullable |
| `hook` | text | nullable, 위와 중복될 수 있으나 UI 편의 |
| `emotion` | text | enum 문자열 또는 `OTHER` |
| `emotion_other_label` | text | nullable |
| `speaker` | text | enum 문자열 또는 `OTHER` |
| `speaker_other_label` | text | nullable |
| `disclosure_mode` | text | enum 문자열 또는 `OTHER` |
| `disclosure_mode_other_label` | text | nullable |
| `family_id` | uuid | 후보를 데려온 Family (참조용 캐시) |
| `cluster_id` | uuid | Semantic Clustering 결과, nullable |
| `quality_score` | numeric | AI 1차 품질 평가 |
| `novelty_score` | numeric | 기존 저장분 대비 novelty |
| `similarity_max` | numeric | 기존 저장분 중 최대 similarity |
| `views` | integer | nullable |
| `view_source` | text | `PUBLIC_UI` \| `MANUAL` \| `UNAVAILABLE` |
| `view_checked_at` | timestamptz | nullable |
| `status` | text | `RAW` \| `RECOMMENDED` \| `SAVED` \| `REJECTED` |
| `manual_body` | text | 사용자가 붙여넣은 원문 fallback |
| `notes` | text | |

- unique(`permalink`).
- 인덱스: `posted_at desc`, `collected_at desc`, `status`, `cluster_id`.
- **`quality/novelty/similarity`는 개별 컬럼.** 단일 recommendation score를 초기부터 저장하지 않는다(D-013).

### 6.4 `saved_references`

사용자가 SAVE한 최종 레퍼런스 라이브러리. Novelty 비교의 기준.

| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | uuid | PK |
| `candidate_id` | uuid | FK → `scout_candidates.id` (nullable — 외부 수동 등록도 허용) |
| `text` | text | |
| `permalink` | text | unique nullable |
| `hook` | text | |
| `emotion` | text | |
| `speaker` | text | |
| `disclosure_mode` | text | |
| `structure_summary` | text | 사용자 또는 AI가 정리한 구조 요약 |
| `tags` | text[] | |
| `saved_at` | timestamptz | |

### 6.5 `rejected_candidates`

| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | uuid | PK |
| `candidate_id` | uuid | FK → `scout_candidates.id` |
| `reason` | text | 사용자 자유서술 또는 enum |
| `rejected_at` | timestamptz | |

### 6.6 `query_runs`

Query별 실행 로그 (Query Performance 산출용).

| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | uuid | PK |
| `seed_query_id` | uuid | FK |
| `search_mode` | text | `TOP` \| `RECENT` |
| `run_at` | timestamptz | |
| `raw_count` | integer | 원 결과 개수 |
| `deduped_count` | integer | Exact Dedup 후 개수 |
| `recommended_count` | integer | 최종 추천에 올라간 개수 |
| `saved_count` | integer | 이 run에서 나중에 SAVE된 개수 (지연 집계) |
| `error` | text | nullable |

### 6.7 `pattern_candidates`

`NEW_PATTERN_CANDIDATE` 누적. 사용자 승인 시 Hook Code 승격.

| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | uuid | PK |
| `proposed_name` | text | |
| `structure_summary` | text | |
| `linguistic_features` | text[] | |
| `first_seen_at` | timestamptz | |
| `occurrence_count` | integer | 관찰 누적 카운트 |
| `state` | text | `PENDING` \| `APPROVED` \| `REJECTED` |
| `approved_hook_code` | text | 승인 시 사용자가 부여한 새 Hook 코드 문자열 |

---

## 7. 환경변수 (서버 전용)

| 이름 | 언제부터 | 용도 |
|---|---|---|
| `ANTHROPIC_API_KEY` | Review Phase 2 | Claude |
| `ANTHROPIC_MODEL` | Review Phase 2 | 모델 ID (하드코딩 금지) |
| `REVIEW_SHARED_PASSWORD` | Vercel 배포 순간 (Review Phase 6) | shared-password 인증 |
| `THREADS_ACCESS_TOKEN` (예정) | Scout Phase A | Threads API |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (예정) | Scout Phase B | Supabase |

**`NEXT_PUBLIC_` 접두어 금지.** `.env.local.example`은 값 비움.

---

## 8. 버전·마이그레이션 규칙

- 스키마가 바뀌면:
  1. `promptVersion` 상승 (`v1` → `v2`).
  2. Zod 스키마 파일 새 버전으로 분리.
  3. `docs/DECISIONS.md`에 이유 기록.
  4. 캐시 키에 promptVersion 포함되므로 자동 무효화.
- ANALYZED 파일은 지난 promptVersion으로 남는다. 재분석은 사용자가 명시 실행.
- Supabase 스키마 변경은 마이그레이션 SQL을 별도 파일로 저장소에 커밋.
