# DATA_CONTRACT.md — 데이터 계약

각 경계(Excel ↔ 브라우저 ↔ 서버 API ↔ Claude ↔ Supabase)에서 오가는 데이터의 정확한 모양을 정의한다.
**AI가 반환하는 모든 JSON은 여기 스키마와 정확히 일치해야 하며, Zod로 런타임 검증한다.**

Reconstruction 판정 규칙의 완전한 근거는 `docs/RECONSTRUCTION_RULES.md`.
현재 `promptVersion = v3` (Reconstruction 도입, D-025).

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
| `레퍼런스 원문` | 레퍼런스 텍스트 전문 | Critical Gate 중 `appealTransfer`, `reference*`, `reconstruction` 활성화 |

### 1.2 Header 감지 알고리즘

1. Sheet 첫 20행.
2. 각 셀 값을 `String(v)` → `trim`.
3. 필수 3종을 모두 포함(정확 일치 또는 별칭)하는 첫 행 = Header.
4. 못 찾으면 에러.
5. Header 다음 행부터 데이터.
6. `리뷰내용`이 공백만인 행은 skip.

### 1.3 파싱 결과

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

### 2.2 Response Body — `RowAnalysis` (promptVersion v3)

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
      "coreAppeal":  "핵심 소구 한 문장",
      "viralEngine": "그 소구를 강하게 만든 표현 장치"
    },
    "draftCoreAppeal": "작성안에서 뽑아낸 핵심 소구 한 문장",

    "appealTransfer": {
      "value": "STRONG",
      "evidence": "왜 STRONG인지 한 줄",
      "deviationPoint": "가장 크게 소구가 이탈한 지점 또는 null"
    },

    "productCuriosity": {
      "value": "MEDIUM",
      "evidence": "왜 MEDIUM인지 한 줄"
    },

    "searchMotivation": {
      "value": "STRONG",
      "evidence": "왜 STRONG인지 한 줄 (본문 미완성/댓글 유도 아닌지 확인)",
      "liftDirection": "검색 동기를 높이기 위한 핵심 수정 방향"
    },

    "reconstruction": {
      "persona": {
        "value": "CHANGED",
        "referenceSummary": "레퍼런스 화자 한 줄",
        "draftSummary": "작성안 화자 한 줄",
        "evidence": "판정 근거 한 줄"
      },
      "event": {
        "value": "CHANGED",
        "referenceSummary": "레퍼런스 사건 한 줄",
        "draftSummary": "작성안 사건 한 줄",
        "evidence": "판정 근거"
      },
      "deficiencyTrigger": {
        "value": "ADDED",
        "referenceSummary": null,
        "draftSummary": "작성안 결핍 계기 한 줄",
        "evidence": "판정 근거"
      },
      "endingMethod": {
        "value": "CHANGED",
        "referenceType": "정보 질문",
        "draftType": "관찰",
        "evidence": "판정 근거"
      },
      "obstacle": {
        "referenceHasObstacle": true,
        "draftHasObstacle": true,
        "functionPreserved": true,
        "detailsTransformed": true,
        "evidence": "장애물 기능 유지 + 내용 재구성 근거"
      },
      "surfaceCloneRisk": {
        "value": "LOW",
        "quotedFragments": [],
        "evidence": "겹치는 표현·수치가 거의 없음"
      },
      "unchangedCount":    0,
      "applicableCount":   4,
      "verdict":           "TRANSFORMED",
      "evidence":          "가장 크게 원문과 겹치는 지점 (없다면 '없음')",
      "revisionDirection": "재구성하려면 무엇을 바꿔야 하는지 (없다면 '유지 권장')"
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

    "healthClaimsToVerify": ["빈속에 물 1L 마시면 붓기 빠짐"],
    "topProblems": [
      "발견의 순간이 약함 — G2 재설계 필요"
    ],
    "revisionDirection": "두 번째 단락을 구조화된 원인 두 줄로 축약."
  },

  "finalVerdict": {
    "value": "NEEDS_REVISION",
    "reasons": [
      "hygiene.grade = B (Gate 2 실패)",
      "reconstruction.verdict = TRANSFORMED · surfaceCloneRisk = LOW"
    ]
  },

  "meta": {
    "model": "<서버 env VIRAL_LAB_ANTHROPIC_MODEL 값>",
    "promptVersion": "v3",
    "elapsedMs": 4321
  }
}
```

### 2.3 스키마 규칙 (Zod)

**Hygiene:**
- `hygiene.grade` ∈ `"A" | "B" | "FAIL"`; `passedCount` ∈ 0..4, gates true 개수와 일치. 서버가 재계산해 덮어씀 (`4→A, 3→B, 0-2→FAIL`).

**Critical (레퍼런스 존재 조건):**

Let `refExists = (refOriginal !== null && refOriginal !== "")`.

- `refExists === false`이면:
  - `critical.reference === null`
  - `critical.appealTransfer === null`
  - `critical.reconstruction === null`
  - `critical.draftCoreAppeal`은 여전히 필수
  - `critical.productCuriosity`, `critical.searchMotivation` 필수
- `refExists === true`이면:
  - `critical.reference.coreAppeal`, `critical.reference.viralEngine` 모두 비어 있지 않은 문자열
  - `critical.appealTransfer` 객체 필수:
    - `value ∈ "STRONG" | "PARTIAL" | "MISMATCH"`
    - `evidence` 비어 있지 않은 문자열
    - `deviationPoint` 문자열 또는 `null`
  - `critical.reconstruction` 객체 필수 (§2.3.1)

`critical.productCuriosity.value ∈ "STRONG" | "MEDIUM" | "WEAK"`, `evidence` 필수.
`critical.searchMotivation.value ∈ "STRONG" | "MEDIUM" | "WEAK"`, `evidence`·`liftDirection` 필수.

**프롬프트 명시 규칙 (AI가 임의 확정 못하게):**
- 정보량 많다고 Search Motivation STRONG 금지.
- 본문 미완성·댓글 유도로 만든 궁금증 STRONG 금지.
- `referenceCoreAppeal`은 단순 주제 요약이 아니라 심리적 소구 문장.

#### 2.3.1 Reconstruction 스키마 (refExists일 때 필수)

**4개 축 각각:**

| 필드 | 값 |
|---|---|
| `persona.value` | `"CHANGED" \| "SAME" \| "NOT_APPLICABLE"` |
| `event.value` | `"CHANGED" \| "SAME" \| "NOT_APPLICABLE"` |
| `deficiencyTrigger.value` | `"CHANGED" \| "SAME" \| "ADDED" \| "NOT_APPLICABLE"` |
| `endingMethod.value` | `"CHANGED" \| "SAME" \| "NOT_APPLICABLE"` |

**축별 부가 필드:**
- `persona`, `event`: `referenceSummary`(string), `draftSummary`(string), `evidence`(string).
- `deficiencyTrigger`: `referenceSummary`(string | null; `value === "ADDED"`일 때 반드시 `null`), `draftSummary`(string), `evidence`(string).
- `endingMethod`: `referenceType`(enum), `draftType`(enum), `evidence`(string).
  - `endingType` enum: `"정보 질문" | "감정 질문" | "선언" | "관찰" | "추천" | "반전" | "결론" | "리스트 마감" | "OTHER"`.

**Obstacle:**
- `referenceHasObstacle: boolean`
- `draftHasObstacle: boolean`
- `functionPreserved: boolean | null` — `referenceHasObstacle === false`이면 반드시 `null`, 아니면 boolean.
- `detailsTransformed: boolean | null` — 위와 동일한 조건.
- `evidence: string`
- Zod refinement 강제.

**Surface Clone Risk:**
- `value ∈ "LOW" | "MEDIUM" | "HIGH"`.
- `quotedFragments: string[]` — 실제 겹치는 표현·수치 인용, 최대 각 500자.
- `evidence: string`.

**서버 계산 (AI 반환값 무시):**
- `unchangedCount` = 4개 축 중 `value === "SAME"`인 개수.
- `applicableCount` = 4개 축 중 `value !== "NOT_APPLICABLE"`인 개수.
- `verdict`:
  - `unchangedCount === 0` → `"TRANSFORMED"`
  - `unchangedCount === 1` → `"BORDERLINE"`
  - `unchangedCount >= 2` → `"TOO_CLOSE"`

**AI가 반환하는 top-level 필드:**
- `reconstruction.evidence: string` — 가장 크게 원문과 겹치는 지점 (또는 "없음").
- `reconstruction.revisionDirection: string` — 재구성하려면 무엇을 바꿔야 하는지 (또는 "유지 권장").

**단순 단어 치환 금지 규칙**은 프롬프트에 명시 (`RECONSTRUCTION_RULES §5`).

**Diagnostic 3축 enum:**
- `emotion.value ∈ 절박함 | 시크함 | 순수감탄 | 놀람 | OTHER`
- `speaker.value ∈ 본인 1인칭 | 딸-엄마 관찰 | 친구-친구 관찰 | 순수 목격자 | OTHER`
- `disclosureMode.value ∈ 직접서술 | 리스트 | 대화체 | 선언문 | OTHER`
- OTHER면 `otherLabel` 문자열 필수, 비-OTHER면 `null` (Zod refinement).

**기타:**
- **`diagnostic.referenceCloneRisk`는 삭제됨.** `critical.reconstruction.surfaceCloneRisk`로 이동 (D-024).
- `diagnostic.listHomogeneity.applicable`은 리스트형일 때만 `true`.
- `topProblems` 1~3개.
- 임의 백분율 필드(`salesRatioPercent` 등) 존재 금지.

**Final Verdict:**
- `finalVerdict.value ∈ "READY" | "NEEDS_REVISION" | "FAIL"`.
- AI 반환값 무시, 서버가 §2.4 규칙으로 재계산.
- `finalVerdict.reasons`는 서버가 채우는 문자열 배열.

**Hook Code (기존과 동일):**
- `diagnostic.hookCode ∈ A~M | NEW_PATTERN_CANDIDATE`.
- `NEW_PATTERN_CANDIDATE`이면 `newPatternCandidate` 4필드 필수, 아니면 `null`.

### 2.4 Final Verdict 계산 규칙 (서버, 결정적) — Reconstruction 반영

Let `refExists = (refOriginal !== null && refOriginal !== "")`.

1. **FAIL** — 아래 중 **하나라도** 참이면 즉시 `FAIL`:
   - `hygiene.grade === "FAIL"`
   - `searchMotivation.value === "WEAK"`
   - `refExists && appealTransfer.value === "MISMATCH"`
   - **NEW:** `refExists && reconstruction.verdict === "TOO_CLOSE"`
   - **NEW:** `refExists && reconstruction.surfaceCloneRisk.value === "HIGH"`

2. **READY** — FAIL이 아니면서 **모두** 참이어야 `READY`:
   - `hygiene.grade === "A"`
   - `searchMotivation.value === "STRONG"`
   - `refExists ? appealTransfer.value === "STRONG" : true`
   - **NEW:** `refExists ? reconstruction.verdict === "TRANSFORMED" : true`
   - **NEW:** `refExists ? reconstruction.surfaceCloneRisk.value !== "HIGH" : true`

3. **NEEDS_REVISION** — 그 외. **`BORDERLINE`은 READY가 아니라 최소 NEEDS_REVISION.**

레퍼런스가 없는 draft에서는 Reconstruction 관련 조건을 전부 무시하고 상위 규칙만 적용.

`reasons[]` 예:
- `"reconstruction.verdict = TOO_CLOSE (persona SAME + event SAME)"`
- `"surfaceCloneRisk = HIGH — 특이 숫자 3개(3년, 10kg, 새벽 4시) 그대로"`
- `"reconstruction.verdict = TRANSFORMED · surfaceCloneRisk = LOW · appealTransfer = STRONG → READY"`

### 2.5 에러 응답

```json
{ "error": "SCHEMA_VALIDATION_FAILED", "detail": "..." }
```

최대 2회 재시도 후 실패면 해당 행만 실패 표시.

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
      "appealTransfer":     "STRONG",
      "productCuriosity":   "MEDIUM",
      "searchMotivation":   "STRONG",
      "finalVerdict":       "READY",
      "hasReference":       true,

      "reconstructionVerdict": "TRANSFORMED",
      "surfaceCloneRisk":      "LOW",
      "personaSame":            false,
      "eventSame":              false,
      "deficiencyTriggerSame":  false,
      "endingSame":             false,
      "personaApplicable":            true,
      "eventApplicable":              true,
      "deficiencyTriggerApplicable":  true,
      "endingApplicable":             true,
      "obstacleDeleted":       false,
      "obstacleDetailCloned":  false
    }
  ]
}
```

- draft 본문·evidence는 보내지 않는다.
- `appealTransfer`, `reconstructionVerdict`, `surfaceCloneRisk`, `*Same`, `obstacle*`는 `hasReference === false`이면 각각 `"N/A"` 또는 `null`.

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
    "finalVerdict":   { "READY": 4, "NEEDS_REVISION": 22, "FAIL": 8 },

    "reconstructionVerdict": { "TRANSFORMED": 6, "BORDERLINE": 9, "TOO_CLOSE": 10 },
    "surfaceCloneRisk":      { "LOW": 12, "MEDIUM": 9, "HIGH": 4 }
  },

  "reconstructionAxes": {
    "persona":           { "same": 3,  "applicable": 25 },
    "event":             { "same": 14, "applicable": 24 },
    "deficiencyTrigger": { "same": 11, "applicable": 20 },
    "ending":            { "same": 2,  "applicable": 25 },
    "obstacleDeleted":       3,
    "obstacleDetailCloned":  5
  },

  "warnings": [
    { "kind": "OVERUSE",                       "field": "hookCode",             "value": "A",           "ratio": 0.42 },
    { "kind": "MISMATCH_HEAVY",                "field": "appealTransfer",       "value": "MISMATCH",    "ratio": 0.31 },
    { "kind": "SEARCH_WEAK_HEAVY",             "field": "searchMotivation",     "value": "WEAK",        "ratio": 0.36 },
    { "kind": "FORMAT_VS_SEARCH",              "detail": "포맷 다양 · Search WEAK 다수" },
    { "kind": "RECONSTRUCTION_TOO_CLOSE_HEAVY","field": "reconstructionVerdict","value": "TOO_CLOSE",   "ratio": 0.40 },
    { "kind": "SURFACE_CLONE_HEAVY",           "field": "surfaceCloneRisk",     "value": "HIGH",        "ratio": 0.16 },
    { "kind": "AXIS_WEAK",                     "field": "event",                "detail": "event SAME 비율 58% — 사건을 새로 만드는 능력 부족" }
  ],

  "recommendation": {
    "text": "다음 소재에서 우선 채울 방향에 대한 자유서술 + 재구성 훈련 피드백",
    "suggestedAngles": ["L × 친구관찰 × 대화체", "J × 시크함 × 선언문"]
  }
}
```

- 모든 카운트·경고는 서버가 결정적으로 계산.
- 초기 임계 (튜닝 값):
  - `OVERUSE` 0.40
  - `MISMATCH_HEAVY` 0.30
  - `SEARCH_WEAK_HEAVY` 0.35
  - `FORMAT_VS_SEARCH`: Hook·감정·화자 각 최대 비율 ≤ 0.40 AND searchMotivation WEAK ≥ 0.30
  - `RECONSTRUCTION_TOO_CLOSE_HEAVY` 0.35
  - `SURFACE_CLONE_HEAVY` 0.15
  - `AXIS_WEAK`: 축별 SAME 비율(same / applicable) ≥ 0.50
- `recommendation.text`만 Claude 1회. 카운트·경고 데이터는 프롬프트에 주입 (AI가 별도 카운트를 만들지 않음).

---

## 4. ANALYZED Excel 출력

### 4.1 시트 구성

- **시트 1:** 원본 그대로.
- **시트 2 `Analysis`:** 원본 컬럼 유지 + 다음 컬럼 (순서):
  - `Hygiene등급`, `G1`, `G2`, `G3`, `G4`
  - `참조소구`, `참조바이럴엔진`, `작성안소구`
  - `AppealTransfer`, `AppealTransfer근거`, `이탈지점`
  - `제품호기심`, `제품호기심근거`
  - `검색동기`, `검색동기근거`, `검색동기수정방향`
  - `재구성판정`, `Unchanged`, `Persona`, `Event`, `결핍계기`, `EndingMethod`, `Reference결말유형`, `Draft결말유형`
  - `장애물_기능유지`, `장애물_세부재구성`
  - `SurfaceCloneRisk`, `SurfaceClone인용`
  - `재구성겹침지점`, `재구성수정방향`
  - `최종판정`, `판정근거`
  - `Hook`, `NewPatternName`
  - `감정`, `감정_기타라벨`, `화자`, `화자_기타라벨`, `공개방식`, `공개방식_기타라벨`
  - `판매튐`, `건강주장`, `구조문제점`, `구조수정방향`
  - 레퍼런스가 없는 행은 재구성·참조·AppealTransfer 관련 셀 전부 공란.
- **시트 3 `Portfolio`:** 집계표 + 경고 + AI recommendation.

### 4.2 파일명

`{원본파일명(확장자 제외)}_ANALYZED_{YYYYMMDD_HHmm}.xlsx`.

원본 절대 덮어쓰지 않는다.

---

## 5. 로컬 캐시 (localStorage, Review Phase 3 이후)

### 5.1 캐시 키

- 재료: `draft`, `refOriginal ?? ""`, `promptVersion` (현재 `v3`).
- `SHA-256(draft + "␞" + (refOriginal ?? "") + "␞" + promptVersion)` → hex.
- 프리픽스: `viral-lab:review:v3:<hash>`.

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
- `promptVersion` 상승 시 프리픽스 변경으로 자연 무효화 (`v2` → `v3`).
- 빈 draft 행은 캐시 없음.
- 4MB 근접 시 LRU-lite 축출.
- 향후 서버 DB 확장 가능한 구조 유지.

---

## 6. Supabase (Scout Phase 이후에만 도입)

Review Phase에서는 이 절 무시. 자세한 이유는 `docs/SCOUT_DESIGN.md`.

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
| `family_id` | uuid | FK |
| `query` | text | |
| `state` | text | `ACTIVE` \| `CANDIDATE` \| `REJECTED` \| `DISABLED` |
| `provenance` | text | `USER_MANUAL` \| `AI_EXPANSION` \| `SAVED_REFERENCE` \| `DISCOVERED_PATTERN` |
| `parent_seed_id` | uuid | nullable |
| `source_reference_id` | uuid | nullable, FK → `saved_references.id` |
| `enabled` | boolean | |
| `notes` | text | |
| `created_at` | timestamptz | |
| `created_by` | text | `user` \| `ai` |

- unique(`family_id`, `query`). AI 생성 Query는 반드시 `state = CANDIDATE`.

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
| `family_id` | uuid | 캐시 |
| `cluster_id` | uuid | nullable |
| `quality_score` | numeric | |
| `novelty_score` | numeric | |
| `similarity_max` | numeric | |
| `views` | integer | nullable |
| `view_source` | text | `PUBLIC_UI` \| `MANUAL` \| `UNAVAILABLE` |
| `view_checked_at` | timestamptz | nullable |
| `status` | text | `RAW` \| `RECOMMENDED` \| `SAVED` \| `REJECTED` |
| `manual_body` | text | 사용자 fallback 붙여넣기 |
| `notes` | text | |

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
| `core_appeal` | text | nullable — Review의 `referenceCoreAppeal` 개념 재사용 |
| `viral_engine` | text | nullable — Review의 `referenceViralEngine` 개념 재사용 |
| `tags` | text[] | |
| `saved_at` | timestamptz | |

### 6.5 `rejected_candidates` / 6.6 `query_runs` / 6.7 `pattern_candidates`

기존 정의 유지 (변경 없음).

---

## 7. 환경변수 (서버 전용)

| 이름 | 언제부터 | 용도 |
|---|---|---|
| `VIRAL_LAB_ANTHROPIC_API_KEY` | Review Phase 2 | Claude 호출 (Claude Code 자체 인증용 `ANTHROPIC_API_KEY`와 충돌 방지) |
| `VIRAL_LAB_ANTHROPIC_MODEL` | Review Phase 2 | 모델 ID (하드코딩 금지) |
| `REVIEW_SHARED_PASSWORD` | Vercel 배포 순간 (Review Phase 6) | 인증 |
| `THREADS_ACCESS_TOKEN` (예정) | Scout Phase A | Threads API |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (예정) | Scout Phase B | Supabase |

**`NEXT_PUBLIC_` 접두어 금지.**

---

## 8. 버전·마이그레이션 규칙

- 스키마·프롬프트 변경 시:
  1. `promptVersion` 상승 (`v3` → `v4` 등).
  2. Zod 스키마 파일 새 버전으로 분리.
  3. `docs/DECISIONS.md`에 이유.
  4. 캐시 자동 무효화 (프리픽스 변경).
- Final Verdict 규칙 조정은 promptVersion 상승 없이 가능 (순수 서버 규칙 변경). `DECISIONS.md` D-022에 append.
- Reconstruction 판정 축·enum 변경은 promptVersion 상승 필요.
