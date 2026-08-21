# DATA_CONTRACT.md — 데이터 계약

이 문서는 각 경계(Excel ↔ 브라우저 ↔ 서버 API ↔ Claude ↔ Supabase)에서 오가는 데이터의 정확한 모양을 정의한다.
**AI가 반환하는 모든 JSON은 여기 정의된 스키마와 정확히 일치해야 하며, Zod로 런타임 검증한다.**

> 용어: "런타임 검증" = 코드가 실제로 돌아가는 순간, JSON의 각 필드가 기대한 타입·형식인지 확인하는 것.

---

## 1. 입력 Excel

### 1.1 필수 Header (정확 일치)

| Header 문자열 | 의미 | 타입 |
|---|---|---|
| `순서` | 행 번호 | number 또는 문자열 숫자 |
| `/제목` | Threads 레퍼런스 URL | 문자열(URL 또는 빈값) |
| `리뷰내용` | 사용자가 쓴 콘텐츠 초안 | 문자열 (필수, 공백만 있으면 스킵) |
| `이미지 파일명` | 이미지 파일명 | 문자열 (빈값 허용) |

### 1.2 선택 Header

| Header 문자열 | 의미 | 존재 시 동작 |
|---|---|---|
| `레퍼런스 원문` | 원 레퍼런스의 텍스트 전문 | 있으면 레퍼런스 vs 초안 비교 활성화 |

### 1.3 Header 감지 알고리즘

1. Sheet 첫 20행을 순서대로 읽는다.
2. 각 행의 셀 값을 문자열로 정규화(trim, 앞뒤 공백 제거).
3. 그 행에 `순서`, `/제목`, `리뷰내용`, `이미지 파일명`이 **모두** 포함되면 그 행이 Header 행.
4. 없으면 에러.
5. Header 행 다음 행부터가 데이터.
6. `리뷰내용`이 빈 문자열/공백만인 행은 skip(집계에도 안 들어감).

### 1.4 파싱 결과 (브라우저 메모리, TypeScript 타입 이미지)

```ts
type ParsedRow = {
  index: number;            // 순서 (Excel의 "순서" 값 그대로)
  sheetRowNumber: number;   // Excel 물리적 행 번호 (1-based)
  refUrl: string | null;    // /제목
  draft: string;            // 리뷰내용 (필수, 이 필드가 비면 이 행 자체가 존재하지 않음)
  imageFilename: string | null;
  refOriginal: string | null; // 레퍼런스 원문 (컬럼이 있고 값이 있을 때만)
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
      "G1_self_contained": { "pass": true,  "evidence": "한 줄 근거" },
      "G2_discovery":      { "pass": false, "evidence": "한 줄 근거" },
      "G3_narrative":      { "pass": true,  "evidence": "한 줄 근거" },
      "G4_causal_structure": { "pass": true, "evidence": "한 줄 근거" }
    },
    "passedCount": 3,
    "grade": "B"
  },
  "diagnostic": {
    "hookCode": "C",
    "hookCodeReason": "왜 이 코드인지 한 줄",
    "emotion": "담담",
    "speaker": "관찰자",
    "disclosureMode": "직접 서술",
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
    "model": "claude-sonnet-4-5",
    "promptVersion": "v1",
    "elapsedMs": 4321
  }
}
```

### 2.3 스키마 규칙 (Zod로 검증)

- `core.grade` ∈ `"A" | "B" | "C" | "D"`
- `core.passedCount` ∈ 0..4, 그리고 `gates` 안의 `pass: true` 개수와 정확히 일치해야 함(불일치 시 검증 실패 = 재시도).
- 등급 계산은 **서버 코드**가 최종 확정한다(AI가 계산했더라도 서버가 다시 계산해서 덮어씀). AI 실수 방지.
- `diagnostic.hookCode` ∈ `A|B|C|D|E|F|G|H|I|J|K|L|M`
- `diagnostic.emotion`, `speaker`, `disclosureMode`는 초기에는 자유서술로 받되, 정해진 카테고리 목록이 확정되면 enum으로 바꾼다 (DECISIONS D-004).
- `similarityToReference.applicable`은 `refOriginal`이 존재할 때만 `true`.
- `keyRevisionPoints`는 최대 3개.
- 모든 문자열은 UTF-8, 최대 길이 500자.

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
    { "index": 1, "hookCode": "A", "emotion": "확신", "speaker": "나", "disclosureMode": "직접 서술", "grade": "A" },
    ...
  ]
}
```

- 이미 분석된 각 행에서 집계에 필요한 필드만 뽑아서 보낸다. draft 본문은 보내지 않음(비용/속도).

### 3.2 Response Body — `PortfolioAnalysis`

```json
{
  "counts": {
    "hookCode":       { "A": 12, "B": 3, "...": 0 },
    "emotion":        { "담담": 8, "확신": 20, ... },
    "speaker":        { "나": 25, "관찰자": 5 },
    "disclosureMode": { "직접 서술": 22, "대화 재현": 8 },
    "grade":          { "A": 10, "B": 15, "C": 4, "D": 1 }
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

- `counts`와 `warnings`는 서버가 코드로 계산(결정적, AI 개입 없음).
- `recommendation`만 Claude 호출로 생성.

---

## 4. ANALYZED Excel 출력

### 4.1 시트 구성

- **시트 1: 원본 그대로 (건드리지 않음)**
- **시트 2: `Analysis`**
  - 원본의 모든 컬럼 유지
  - 뒤에 추가:
    - `등급`, `G1`, `G2`, `G3`, `G4`, `Hook`, `감정`, `화자`, `공개방식`, `판매비중%`, `유사도`, `건강주장`, `수정포인트`
- **시트 3: `Portfolio`**
  - 상단: 집계표 (카테고리별 개수·비율)
  - 하단: 경고 목록
  - 최하단: AI가 생성한 `recommendation.text`와 `suggestedAngles`

### 4.2 파일명

`{원본파일명(확장자 제외)}_ANALYZED_{YYYYMMDD_HHmm}.xlsx`

- 원본 파일과 같은 폴더에 저장되지 않음. 브라우저 다운로드.

---

## 5. Supabase (Scout Phase 이후에만 등장)

> 지금 만들지 않는다. 참고용 초안.

### 5.1 테이블 `scout_items`

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
| `manual_body` | text | 사용자가 나중에 붙여넣은 원문(있을 수 있음) |
| `notes` | text | 사용자 메모 |

### 5.2 인덱스

- `permalink` unique
- `timestamp` desc (최근순 조회)

---

## 6. 버전·마이그레이션 규칙

- 스키마가 바뀌면:
  1. `promptVersion`을 올린다 (`v1` → `v2`).
  2. Zod 스키마 파일도 새 버전으로 분리.
  3. `docs/DECISIONS.md`에 변경 이유와 하위 호환 처리 방식을 기록.
- 이미 저장된 ANALYZED 파일은 지난 promptVersion으로 남는다. 재분석은 사용자가 명시적으로 다시 실행.
