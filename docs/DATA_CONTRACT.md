# DATA_CONTRACT.md — 데이터 계약

이 문서는 각 경계(Excel ↔ 브라우저 ↔ 서버 API ↔ Claude ↔ Supabase)에서 오가는 데이터의 정확한 모양을 정의한다.
**AI가 반환하는 모든 JSON은 여기 정의된 스키마와 정확히 일치해야 하며, Zod로 런타임 검증한다.**

> 용어: "런타임 검증" = 코드가 실제로 돌아가는 순간, JSON의 각 필드가 기대한 타입·형식인지 확인하는 것.

---

## 1. 입력 Excel

### 1.1 Header 목록

**필수 (반드시 포함):**

| Header 문자열 | 별칭 | 의미 | 값 타입 |
|---|---|---|---|
| `순서` | — | 행 번호 | number 또는 문자열 숫자 |
| `/제목` | `레퍼런스 링크` | Threads 레퍼런스 URL | 문자열(URL 또는 빈값) |
| `리뷰내용` | `작성안`, `작성한 글` | 사용자가 쓴 콘텐츠 초안 | 문자열 (공백만 있으면 이 행 자체가 없음) |

**선택 (있으면 사용, 없어도 분석 가능):**

| Header 문자열 | 의미 | 존재 시 동작 |
|---|---|---|
| `이미지 파일명` | 이미지 파일명 | 결과 표/ANALYZED에 그대로 실려 나감 |
| `레퍼런스 원문` | 레퍼런스 텍스트 전문 | 레퍼런스 vs 초안 비교 활성화 |

### 1.2 Header 감지 알고리즘

1. Sheet의 첫 20행을 순서대로 읽는다.
2. 각 셀 값을 문자열로 정규화: 문자열이 아닌 값은 `String(v)`, 그 후 **`trim`**(앞뒤 공백 제거).
3. 그 행이 필수 Header 3종을 모두 포함하는지 확인. 각 필수 Header는 **정확 일치 또는 별칭 중 하나**로 매칭.
4. 최초로 조건을 만족하는 행을 Header 행으로 확정.
5. 못 찾으면 에러:
   `"Header를 찾지 못했습니다. 필수 컬럼: 순서, /제목(=레퍼런스 링크), 리뷰내용(=작성안=작성한 글)"`.
6. Header 행 다음 행부터가 데이터.
7. `리뷰내용`이 빈 문자열/공백만인 행은 skip(집계에도 안 들어감).

### 1.3 파싱 결과 (브라우저 메모리, TypeScript 타입 이미지)

```ts
type ParsedRow = {
  index: number;              // "순서" 값 그대로
  sheetRowNumber: number;     // Excel 물리 행 번호 (1-based)
  refUrl: string | null;      // /제목 = 레퍼런스 링크
  draft: string;              // 리뷰내용 = 작성안 = 작성한 글 (필수)
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

- 서버는 이 최소 필드만 받는다. 이미지 파일명·시트 행번호 등은 클라이언트가 자체 보관.

### 2.2 Response Body — `RowAnalysis`

```json
{
  "index": 12,
  "core": {
    "gates": {
      "G1_self_contained":    { "pass": true,  "evidence": "한 줄 근거" },
      "G2_discovery":         { "pass": false, "evidence": "한 줄 근거" },
      "G3_narrative":         { "pass": true,  "evidence": "한 줄 근거" },
      "G4_causal_structure":  { "pass": true,  "evidence": "한 줄 근거" }
    },
    "passedCount": 3,
    "grade": "B"
  },
  "diagnostic": {
    "hookCode": "C",
    "hookCodeReason": "왜 이 코드인지 한 줄",

    "emotion":         { "value": "시크함",   "otherLabel": null },
    "speaker":         { "value": "OTHER",   "otherLabel": "부부-부부 관찰" },
    "disclosureMode":  { "value": "리스트",  "otherLabel": null },

    "listHomogeneity": {
      "applicable": true,
      "pass": true,
      "evidence": "..."
    },
    "salesRatioPercent": 15,
    "similarityToReference": {
      "applicable": true,
      "level": "low",
      "quotedFragments": ["..."]
    },
    "healthClaimsToVerify": ["빈속에 물 1L 마시면 붓기 빠짐"],
    "keyRevisionPoints": [
      "발견의 순간이 약함 — G2 재설계 필요",
      "결과 원인이 서술적임 — 구조화 필요"
    ]
  },
  "meta": {
    "model": "<서버 env ANTHROPIC_MODEL 값>",
    "promptVersion": "v1",
    "elapsedMs": 4321
  }
}
```

### 2.3 스키마 규칙 (Zod로 검증)

- `core.grade` ∈ `"A" | "B" | "FAIL"` — **C·D 없음.**
- `core.passedCount` ∈ 0..4, gates의 `pass:true` 개수와 정확히 일치해야 함(불일치 시 검증 실패 = 재시도).
- 등급 계산은 **서버 코드**가 최종 확정한다. AI가 계산했더라도 서버가 gates 기준으로 다시 계산해 덮어씀:
  - passedCount 4 → `A`
  - passedCount 3 → `B`
  - passedCount 0~2 → `FAIL`

**Diagnostic enum:**

- `diagnostic.hookCode` ∈ `A|B|C|D|E|F|G|H|I|J|K|L|M` (OTHER 없음, `docs/HOOK_CODES.md` 참조)
- `diagnostic.emotion.value` ∈ `절박함 | 시크함 | 순수감탄 | 놀람 | OTHER`
- `diagnostic.speaker.value` ∈ `본인 1인칭 | 딸-엄마 관찰 | 친구-친구 관찰 | 순수 목격자 | OTHER`
- `diagnostic.disclosureMode.value` ∈ `직접서술 | 리스트 | 대화체 | 선언문 | OTHER`

**OTHER 규칙 (강제):**

- `value === "OTHER"` 이면 `otherLabel`은 비어 있지 않은 문자열이어야 한다.
- `value !== "OTHER"` 이면 `otherLabel`은 반드시 `null`.
- Zod refinement로 두 방향 모두 검사. 위반 시 스키마 실패 → 재시도.

**기타:**

- `similarityToReference.applicable`은 `refOriginal`이 존재할 때만 `true`.
- `keyRevisionPoints`는 최대 3개.
- 모든 evidence·otherLabel·자유서술 문자열은 UTF-8, 최대 500자.
- `salesRatioPercent`는 0~100 정수.

### 2.4 에러 응답

```json
{ "error": "SCHEMA_VALIDATION_FAILED", "detail": "..." }
```

- 서버가 AI 응답을 최대 2회 재시도했는데도 스키마 실패면 이 에러를 낸다.
- 클라이언트는 해당 행을 "실패"로 표시하고 재시도 버튼을 제공.

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
      "emotion":        { "value": "확신 아님(예시 시 OTHER 처리)", "otherLabel": null },
      "speaker":        { "value": "본인 1인칭", "otherLabel": null },
      "disclosureMode": { "value": "리스트", "otherLabel": null }
    }
  ]
}
```

- 이미 분석된 각 행에서 집계에 필요한 필드만 뽑아서 보낸다. draft 본문은 보내지 않음(비용/속도).

### 3.2 Response Body — `PortfolioAnalysis`

```json
{
  "counts": {
    "hookCode":       { "A": 12, "B": 3, "C": 0, "...": 0 },
    "emotion":        { "절박함": 8, "시크함": 20, "순수감탄": 4, "놀람": 3, "OTHER": 1 },
    "speaker":        { "본인 1인칭": 25, "딸-엄마 관찰": 3, "친구-친구 관찰": 2, "순수 목격자": 4, "OTHER": 0 },
    "disclosureMode": { "직접서술": 12, "리스트": 15, "대화체": 4, "선언문": 3, "OTHER": 0 },
    "grade":          { "A": 10, "B": 15, "FAIL": 9 }
  },
  "warnings": [
    { "kind": "OVERUSE", "field": "hookCode", "value": "A", "ratio": 0.42 }
  ],
  "recommendation": {
    "text": "다음 주제에서 비어 있는 방향에 대한 자유서술 (Claude가 생성)",
    "suggestedAngles": ["...", "..."]
  }
}
```

- `counts`·`warnings`는 서버가 코드로 계산(결정적, AI 개입 없음).
- `recommendation`만 Claude 호출로 생성.
- `grade` 카운트 키는 정확히 `A | B | FAIL`.

---

## 4. ANALYZED Excel 출력

### 4.1 시트 구성

- **시트 1: 원본 그대로 (건드리지 않음)**
- **시트 2: `Analysis`**
  - 원본의 모든 컬럼 유지
  - 뒤에 추가:
    - `등급` (`A`/`B`/`FAIL`), `G1`, `G2`, `G3`, `G4`, `Hook`, `감정`, `감정_기타라벨`, `화자`, `화자_기타라벨`, `공개방식`, `공개방식_기타라벨`, `판매비중%`, `유사도`, `건강주장`, `수정포인트`
- **시트 3: `Portfolio`**
  - 상단: 집계표 (카테고리별 개수·비율)
  - 하단: 경고 목록
  - 최하단: AI가 생성한 `recommendation.text`와 `suggestedAngles`

### 4.2 파일명

`{원본파일명(확장자 제외)}_ANALYZED_{YYYYMMDD_HHmm}.xlsx`

- 원본 파일과 같은 폴더에 자동 저장되지 않음. 브라우저 다운로드.

---

## 5. 로컬 캐시 (localStorage, Phase 4 이후)

Supabase·IndexedDB는 사용하지 않는다. 브라우저 localStorage에 각 행 결과를 캐시한다.

### 5.1 캐시 키

- 재료: `draft` 문자열, `refOriginal ?? ""` 문자열, `promptVersion` 문자열.
- 방식: `SHA-256(draft + "␞" + (refOriginal ?? "") + "␞" + promptVersion)` → hex 문자열.
- 저장 프리픽스: `viral-lab:review:v1:<hash>`

> 용어: `␞` = 화면에 안 보이는 구분 문자. 서로 다른 두 입력이 우연히 같은 결합 문자열이 되지 않게 하기 위해 씀.

### 5.2 엔트리 스키마

```ts
type CacheEntry = {
  key: string;              // hex hash
  promptVersion: string;    // "v1"
  analyzedAt: string;       // ISO timestamp
  result: RowAnalysis;      // §2.2와 동일
};
```

### 5.3 동작 규칙

- **분석 시작 시:** 각 행마다 캐시 조회 → 히트면 Claude 호출 생략, 미스면 호출.
- **강제 재분석:** 사용자가 "이 행 재분석" 또는 "전체 강제 재분석" 누르면 캐시 무시하고 호출한 뒤 갱신.
- **promptVersion 변경 시:** 키가 달라지므로 자연스럽게 무효화. 오래된 엔트리는 잔존하나 조회되지 않음.
- **크기 관리:** 초기에는 단순 timestamp 기준으로 오래된 것부터 제거. localStorage 4MB 근접 시 축출.
- **초기화:** 헤더 우측 "캐시 비우기" 버튼으로 전체 삭제.
- **새로고침 복구:** 새로고침 후 같은 파일을 다시 업로드하면 캐시 히트로 즉시 결과가 복구된다.

---

## 6. Supabase (Scout Phase 이후에만 등장)

> 지금 만들지 않는다. 참고용 초안.

### 6.1 테이블 `scout_items`

| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | uuid | PK, default gen |
| `permalink` | text | **unique** (중복 제거 키) |
| `text` | text | Threads 본문 |
| `username` | text | 작성자 handle |
| `timestamp` | timestamptz | 게시 시각 |
| `search_keyword` | text | 어떤 검색어로 수집했는지 |
| `search_mode` | text | `TOP` \| `RECENT` |
| `collected_at` | timestamptz | 수집 시각 |
| `manual_body` | text | 사용자가 나중에 붙여넣은 원문 |
| `notes` | text | 사용자 메모 |

### 6.2 인덱스

- `permalink` unique
- `timestamp` desc

---

## 7. 환경변수 (서버 전용)

| 이름 | 언제부터 필요 | 용도 |
|---|---|---|
| `ANTHROPIC_API_KEY` | Phase 3부터 | Claude 호출 |
| `ANTHROPIC_MODEL` | Phase 3부터 | 사용 모델 ID. 코드에 하드코딩 금지 (D-009) |
| `REVIEW_SHARED_PASSWORD` | Phase 3부터 | shared-password 인증 (D-005) |

**절대 `NEXT_PUBLIC_` 접두어를 붙이지 않는다.** 붙이면 브라우저 번들에 실려 유출.

---

## 8. 버전·마이그레이션 규칙

- 스키마가 바뀌면:
  1. `promptVersion`을 올린다 (`v1` → `v2`).
  2. Zod 스키마 파일도 새 버전으로 분리.
  3. `docs/DECISIONS.md`에 변경 이유와 하위 호환 처리 방식을 기록.
  4. 캐시 키에 promptVersion이 포함되므로 자동 무효화된다.
- 이미 저장된 ANALYZED 파일은 지난 promptVersion으로 남는다. 재분석은 사용자가 명시적으로 실행.
