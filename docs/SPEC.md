# SPEC.md — Viral Lab 기능 사양

## 0. 한 줄 요약

Threads 바이럴 콘텐츠 업무용 내부 웹도구. Next.js 한 프로젝트 안에 두 페이지.

- **`/review`** — 내가 Excel에 수동 작성한 Threads 콘텐츠를 업로드하면 내 바이럴 원칙에 얼마나 부합하는지 AI가 분석.
- **`/scout`** — Threads에서 새 바이럴 레퍼런스를 지속적으로 발굴. **"내가 아직 확보하지 않은 새로운 콘텐츠 구조"를 계속 발견**하는 것이 핵심 목적.

개발 순서: **Review 완성 → 실제 업무 검증 → Scout 개발.**

Scout 세부 설계는 `docs/SCOUT_DESIGN.md`에 있다. 이 문서(SPEC.md)는 Review를 정밀하게 다루고 Scout는 요약만.

---

## 1. `/review` 사양

### 1.1 사용자 시나리오

1. Excel 업로드.
2. 도구가 Header 행을 자동 감지하고, 어느 행이 Header인지 표시.
3. 미리보기 확인 후 "분석 시작".
4. 각 행에 대해 Claude로 Hygiene + Critical + Diagnostic 계산.
   캐시(§1.9)에 동일 입력의 결과가 있으면 Claude 호출 생략.
5. 진행률 실시간 표시.
6. 완료 시 표 + 상단 Portfolio 카드. 각 행 상세에는 Critical Gate 결과가 한 화면에 표시(§1.6).
7. "결과 다운로드"로 `..._ANALYZED_YYYYMMDD_HHmm.xlsx` (원본 보존).

### 1.2 입력 Excel 형식

- 첫 행이 Header라고 가정하지 않는다.

- **필수 Header (3종):**
  - `순서`
  - `/제목` — Threads 레퍼런스 URL
  - `리뷰내용` — 사용자가 작성한 콘텐츠 초안

- **선택 Header (2종):**
  - `이미지 파일명` — 결과 표/ANALYZED에 그대로 실려 나감. **없어도 분석 정상 동작.**
  - `레퍼런스 원문` — **있을 때만 Critical Gate 중 `appealTransfer`가 활성화**. 없으면 draft 단독 분석.

- **Header 별칭:**
  - `/제목` = `레퍼런스 링크`
  - `리뷰내용` = `작성안` = `작성한 글`

- **Header 자동 감지:** 첫 20행 · 셀 `trim` · 필수 3종(별칭 포함) 모두 포함하는 첫 행이 Header. 못 찾으면 명확한 에러.

### 1.3 Hygiene Gate (구 Core Gate) — 구조 완성도

각 초안 1개에 대해 4개 gate.

| # | Gate | 통과 기준 |
|---|---|---|
| G1 | 본문 완결성 | 질문·댓글의 답변에 의존하지 않고 본문만으로 내용이 완결되는가 |
| G2 | 발견/전환 | 발견 또는 전환이 존재하는가 (예: `근데`, `그런데`, `알고 보니`, `웃긴 건`, `실제로 해보니`). **단어 존재가 아니라 의미상 전환**을 판단 |
| G3 | 서사 완결 | 서사가 본문 안에서 완결되는가 |
| G4 | 결과·원인 구조성 | 결과의 원인이 구체적이고 구조적으로 활용 가능한가 |

**`hygiene.grade` (서버 재계산, 확정):**
- passedCount 4 → **A**, 3 → **B**, 0–2 → **FAIL**. C·D 없음.

각 gate는 `pass: boolean` + 짧은 근거(evidence).
AI는 gate boolean만 반환. `passedCount`·`hygiene.grade`는 서버가 항상 재계산해 덮어씀.
UI에서 Hygiene / Critical / Diagnostic은 별도 섹션.

### 1.4 Critical Gate — Review 최상위 판정

Review의 최상위 목적은 "잘 쓰인 Threads 글인가"가 아니라 **레퍼런스가 준 심리적 엔진을 새 소재로 옮겨오는 데 성공했는가 + 사람들이 검색까지 가는가**이다. Hygiene이 4/4여도 Critical이 나쁘면 **좋은 소재가 아니다** (§1.5 finalVerdict).

#### 1.4.1 Reference / Draft Core Appeal 추출

**레퍼런스 원문이 있을 때 AI가 가장 먼저 하는 일:**

- `referenceCoreAppeal` — 이 콘텐츠에서 사람들이 실제로 욕망하거나 반응한 **핵심 가치/소구**를 한 문장.
- `referenceViralEngine` — 그 핵심 소구를 강하게 느끼게 만든 표현 장치 (대비 · 반전 · 사회적 증거 · 반복사용 증거 · 관계 · 숫자 · 상황).

**단순 주제 요약 금지.**

| ❌ BAD | ✅ GOOD |
|---|---|
| "다이소 화장품 추천" | "비싼 기존 해결책보다 저렴하고 별것 아닌 제품에서 오히려 더 눈에 띄는 만족을 경험했다는 가격/기대 역전." |

작성안에서도 별도로 `draftCoreAppeal` 추출.

#### 1.4.2 Appeal Transfer (레퍼런스 원문이 있을 때만)

`appealTransfer.value ∈ { STRONG | PARTIAL | MISMATCH }` + `evidence` + `deviationPoint`(가장 크게 이탈한 지점).

| 값 | 의미 |
|---|---|
| STRONG | 원본이 터진 핵심 심리적 소구가 새 제품/상황에서도 자연스럽게 유지 |
| PARTIAL | 표현 구조는 어느 정도 유지되지만 원본의 핵심 욕망·긴장이 약화 |
| MISMATCH | 원본의 겉 형식만 빌렸을 뿐, 사람들이 원본에 반응한 핵심 이유가 다른 메시지로 바뀜 |

**중요:** 문장·세부내용을 복제하라는 뜻이 아니다. 빌려와야 하는 것은 표면 문장이 아니라 **사람들이 반응한 심리적 엔진**이다.

#### 1.4.3 Product Curiosity

`productCuriosity.value ∈ { STRONG | MEDIUM | WEAK }` + `evidence`.

기준: 작성안을 **처음 보는 사람이 글을 끝까지 읽었을 때** "이게 뭐지?", "왜 이렇지?", "무슨 제품이지?"라는 자연스러운 궁금증이 생기는가.

#### 1.4.4 Search Motivation (Product Curiosity보다 엄격)

`searchMotivation.value ∈ { STRONG | MEDIUM | WEAK }` + `evidence` + `liftDirection`(검색 동기를 높이기 위한 핵심 수정 방향).

기준(가정): **"제품을 전혀 모르는 사용자가 Threads 피드에서 이 글을 우연히 읽었다. 글을 다 읽은 직후 제품명 또는 관련 키워드를 네이버에 직접 검색할 정도의 행동 동기가 생기는가?"**

**절대 규칙:**
- 제품명이 여러 번 노출됐다는 이유만으로 Search Motivation을 높게 평가하지 않는다.
- **핵심은 정보량이 아니라 정보격차 · 의외성 · 욕망 · 대비 · 결과 · 상황적 자기관련성.**
- **본문을 미완성으로 만들거나 답을 댓글로 미루는 방식으로 궁금증을 만드는 것은 STRONG으로 평가하지 않는다.** ("이야기의 답을 알기 위해 댓글을 봐야 한다"는 나쁨; "이야기는 끝났지만 제품 자체가 궁금하다"는 좋음.)
- 이 규칙은 프롬프트 상수에 명시된다.

### 1.5 Final Verdict — 서버 결정적 규칙

`finalVerdict.value ∈ { READY | NEEDS_REVISION | FAIL }`.

**임의 100점 점수 방식 금지 (D-020, D-022).** AI는 개별 gate·enum 값만 반환하고, 서버 코드가 아래 규칙으로 verdict를 계산해 덮어쓴다. `finalVerdict.reasons[]`에 사람이 읽을 수 있는 근거를 함께 채운다.

Let `refExists = (refOriginal !== null && refOriginal !== "")`.

**FAIL** — 아래 중 **하나라도** 참이면 즉시 FAIL:
- `hygiene.grade === "FAIL"`
- `searchMotivation.value === "WEAK"`
- `refExists && appealTransfer.value === "MISMATCH"`

**READY** — FAIL이 아니면서 **모두** 참이어야 함:
- `hygiene.grade === "A"`
- `searchMotivation.value === "STRONG"`
- `refExists ? appealTransfer.value === "STRONG" : true`

**NEEDS_REVISION** — 위 두 조건 어디에도 해당하지 않는 나머지.

`productCuriosity`는 finalVerdict를 직접 게이팅하지 않지만 UI·Portfolio에서 별도로 보여준다 (Search Motivation의 선행 지표).

**초기 규칙이며, 실사용 후 조정 가능하다.** 조정 시 `promptVersion`을 함께 올리진 않아도 되지만 `docs/DECISIONS.md`에 append.

### 1.6 각 행 상세 UI (레퍼런스가 있을 때 한 화면에)

다음을 반드시 한 화면에 배치.

- Reference Core Appeal
- Reference Viral Engine
- Draft Core Appeal
- Appeal Transfer (값 + 근거)
- Product Curiosity (값 + 근거)
- Search Motivation (값 + 근거)
- 가장 크게 소구가 이탈한 지점 (`appealTransfer.deviationPoint`)
- 검색 동기를 높이기 위한 핵심 수정 방향 (`searchMotivation.liftDirection`)

레퍼런스가 없으면 Reference 3항목과 Appeal Transfer 관련 3항목은 숨긴다.

### 1.7 Diagnostic (참고 지표, Hygiene·Critical과 분리)

**enum으로 고정된 축:**

- **Hook Code:** `A|B|C|D|E|F|G|H|I|J|K|L|M | NEW_PATTERN_CANDIDATE`
  - 정의: `docs/HOOK_CODES.md`.
  - `NEW_PATTERN_CANDIDATE`일 때 추가 필드: `whyDifferent`, `structureSummary`, `proposedName`, `linguisticFeatures[]`.
- **감정태도:** `절박함 | 시크함 | 순수감탄 | 놀람 | OTHER`
- **화자:** `본인 1인칭 | 딸-엄마 관찰 | 친구-친구 관찰 | 순수 목격자 | OTHER`
- **정보공개방식:** `직접서술 | 리스트 | 대화체 | 선언문 | OTHER`

**OTHER 반환 시** `otherLabel` 필수. Zod refinement로 강제.

**구조화 필드 (임의 점수 대신 boolean/enum):**
- `hookCodeReason` — Hook 판단 근거 한 줄
- `listHomogeneity` — 리스트형 항목 문법적 균질성: `{ applicable, pass, evidence }`
- `salesMessageStandsOut` — 판매 메시지가 튀는지: `{ pass, evidence }`
- `referenceCloneRisk` — 레퍼런스가 있을 때만: `{ applicable, level: "low"|"medium"|"high", quotedFragments[] }`
- `healthClaimsToVerify` — 사실검증 필요한 건강·효능 주장: string[]
- `topProblems` — 구조적 문제 1~3개: string[1..3]
- `revisionDirection` — 구조적 수정 방향 한 줄

AI는 근거 없는 수치를 만들지 않는다.

### 1.8 Portfolio Analysis (Excel 전체)

전체 행 분석 후 1회. **통계는 코드가 결정적으로 계산, AI는 해석/추천만 담당.**

**코드가 계산:**
- Hook A~M 개수 + NEW_PATTERN_CANDIDATE 개수
- 감정태도 / 화자 / 정보공개방식 분포 (OTHER 별도)
- `hygiene.grade` 분포 (`A`, `B`, `FAIL`)
- **`appealTransfer` 분포 (`STRONG` / `PARTIAL` / `MISMATCH` / `N/A`)**
- **`productCuriosity` 분포 (`STRONG` / `MEDIUM` / `WEAK`)**
- **`searchMotivation` 분포 (`STRONG` / `MEDIUM` / `WEAK`)**
- **`finalVerdict` 분포 (`READY` / `NEEDS_REVISION` / `FAIL`)**
- 과사용 경고: 특정 카테고리 상위 임계치 초과 시 자동 표시
- **다양성-검색 불일치 경고:** 예를 들어 Hook·감정·화자 분포는 다양한데 `searchMotivation = WEAK` 비율이 임계치 초과이면 "포맷은 다양하지만 제품 관심으로 이어지지 않는 소재가 많다"는 경고를 자동 표시. (초기 임계치는 튜닝 값)
- MISMATCH 과다 경고: `appealTransfer = MISMATCH` 비율 임계치 초과 시 표시.

**AI가 생성:**
- "다음 소재에서 어떤 방향을 우선 채우면 좋을지" 자유서술 + 조합 예시 (예: `L × 친구관찰 × 대화체`).
- 위 자동 경고를 반영해 우선순위를 조정한 방향 추천.

### 1.9 로컬 캐시 (row-level, localStorage)

- Supabase·IndexedDB는 Review Phase에서 사용하지 않는다.
- **캐시 키:** `SHA-256(draft + ␞ + (refOriginal ?? "") + ␞ + promptVersion)`.
- Critical Gate 도입으로 **현재 `promptVersion = v2`**. 캐시 자동 무효화.
- 동일 입력은 사용자 강제 재분석이 아니면 Claude 재호출 안 함.
- 빈 draft 행은 API 호출·캐시 항목 모두 만들지 않는다.
- 전체 재분석 시작 전 예상 호출 개수(캐시 히트 반영) 표시.
- "이 행 강제 재분석", "전체 강제 재분석", "캐시 비우기" 버튼.
- 향후 서버 DB 저장으로 확장 가능한 구조 유지.

### 1.10 성능·비용

- 초기 동시성 = 3.
- 실패 행은 표시만 하고 나머지는 계속 진행. 실패 행만 재시도 버튼.

### 1.11 인증

- Vercel 배포 순간부터 **shared-password 필수** (Review Phase 6).
- `REVIEW_SHARED_PASSWORD` env와 비교, HttpOnly 세션 쿠키(30일).
- Google OAuth 등 복잡 인증 없음.

---

## 2. `/scout` 사양 요약 (Review 완성 후 개발)

**전체 설계는 `docs/SCOUT_DESIGN.md`.**

Scout는 검색어 몇십 개를 반복 실행하는 프로그램이 아니다. 목적은 두 가지 동시.
1. 이미 알고 있는 좋은 바이럴 패턴을 효율적으로 찾기.
2. 아직 A~M 어디에도 명확히 안 들어가는 새 패턴을 지속 탐험.

핵심 개념: Search Gene Pool · Novelty · Diversity · Exploration · NEW_PATTERN_CANDIDATE · Optional Engagement Verification (안전 규칙 절대 준수) · Exploit + Explore.

Scout Phase A~G, cron은 마지막.

---

## 3. Non-Goals (지금은 안 만드는 것)

- 다중 사용자 계정·권한, 팀 협업, 모바일 전용 UI
- Threads 외 플랫폼
- AI 파인튜닝 / 자동 ML 추천 시스템
- 실시간 알림, 자체 이미지 CDN
- Vector DB, 대규모 Queue, Microservice
- OAuth
- 초기부터 복잡한 단일 추천 공식 / Review Final Verdict의 100점 점수 방식

---

## 4. 열려 있는 결정

- **없음.** 튜닝 값(과사용 경고 임계, MISMATCH·WEAK 경고 임계, Diversity Quota N, Exploit/Explore 비율, 조회수 필터 default)은 실운영 데이터로 조정.
