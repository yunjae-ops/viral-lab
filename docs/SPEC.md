# SPEC.md — Viral Lab 기능 사양

## 0. 한 줄 요약

Threads 바이럴 콘텐츠 업무용 내부 웹도구. Next.js 한 프로젝트 안에 두 페이지.

- **`/review`** — 내가 Excel에 수동 작성한 Threads 콘텐츠를 업로드하면 내 바이럴 원칙에 얼마나 부합하는지 AI가 분석.
- **`/scout`** — Threads에서 새 바이럴 레퍼런스를 지속적으로 발굴. **"내가 아직 확보하지 않은 새로운 콘텐츠 구조"를 계속 발견**하는 것이 핵심 목적.

개발 순서: **Review 완성 → 실제 업무 검증 → Scout 개발.**

Scout 세부 설계는 별도 문서 `docs/SCOUT_DESIGN.md`에 있다. 이 문서(SPEC.md)는 Review를 정밀하게 다루고 Scout는 요약만 담는다.

---

## 1. `/review` 사양

### 1.1 사용자 시나리오

1. Excel 업로드.
2. 도구가 Header 행을 자동 감지하고, 어느 행이 Header인지 표시.
3. 미리보기(첫 3행 등) 확인 후 "분석 시작".
4. 각 행에 대해 Claude로 Core Grade + Diagnostic 계산.
   캐시(§1.7)에 동일 입력의 결과가 있으면 Claude 호출 생략.
5. 진행률(`47 / 120`, 캐시 히트 K건) 실시간 표시.
6. 완료 시 표 + 상단 Portfolio 카드.
7. "결과 다운로드"로 `..._ANALYZED_YYYYMMDD_HHmm.xlsx` 파일 저장(원본은 보존).

### 1.2 입력 Excel 형식

- 첫 행이 Header라고 가정하지 않는다. 앞쪽에 빈 행/안내문이 있을 수 있다.

- **필수 Header (3종):**
  - `순서`
  - `/제목` — Threads 레퍼런스 URL
  - `리뷰내용` — 사용자가 작성한 콘텐츠 초안

- **선택 Header (2종):**
  - `이미지 파일명` — 있으면 결과 표/ANALYZED에 그대로 실려 나감. **없어도 분석 정상 동작.**
  - `레퍼런스 원문` — 있으면 레퍼런스 vs 작성안 구조 비교 활성화, 없으면 작성안 단독 분석.

- **Header 별칭 (동일 의미로 인정):**
  - `/제목` = `레퍼런스 링크`
  - `리뷰내용` = `작성안` = `작성한 글`

- **Header 자동 감지:**
  - 첫 20행을 훑는다.
  - 각 셀 값을 문자열로 정규화 후 `trim`.
  - 필수 3종(정확 일치 또는 위 별칭 중 하나)이 **모두** 포함되는 첫 행이 Header.
  - 못 찾으면 명확한 에러.

### 1.3 Core Grade (핵심 판정)

각 콘텐츠 초안 1개에 대해 4개 Gate를 통과했는지 판정.

| # | Gate 이름 | 통과 기준 |
|---|-----------|-----------|
| G1 | 본문 완결성 | 질문·댓글의 답변에 의존하지 않고 본문만으로 내용이 완결되는가 |
| G2 | 발견/전환 | 발견 또는 전환이 존재하는가 (예: `근데`, `그런데`, `알고 보니`, `웃긴 건`, `실제로 해보니`). **단순 단어 존재 검사가 아니라 의미상 전환을 판단.** |
| G3 | 서사 완결 | 서사가 본문 안에서 완결되는가 |
| G4 | 결과·원인 구조성 | 결과가 발생한 원인이 구체적이고 구조적으로 활용 가능한가 |

**등급 계산 (확정):**
- passedCount 4 → **A**
- passedCount 3 → **B**
- passedCount 0–2 → **FAIL**
- **C·D 등급 없음.**

각 Gate는 `pass: boolean`과 짧은 근거 문장(evidence) 1개.
AI는 gates의 boolean만 반환한다. `passedCount`와 `grade`는 **서버가 재계산해 덮어쓴다** (D-007).
UI에서 Core Grade와 Diagnostic은 반드시 별도 섹션으로 보여준다.

### 1.4 Diagnostic (참고 지표, Core Grade와 분리)

**enum으로 고정된 축:**

- **Hook Code:** `A|B|C|D|E|F|G|H|I|J|K|L|M | NEW_PATTERN_CANDIDATE`
  - 정의는 `docs/HOOK_CODES.md`.
  - `NEW_PATTERN_CANDIDATE`일 때 추가 필드: `whyDifferent`, `structureSummary`, `proposedName`, `linguisticFeatures[]`.
  - **A~M은 "현재까지 발견된 분류"**일 뿐. AI는 A~M에 억지로 끼워 맞추지 않는다.
- **감정태도:** `절박함 | 시크함 | 순수감탄 | 놀람 | OTHER`
- **화자:** `본인 1인칭 | 딸-엄마 관찰 | 친구-친구 관찰 | 순수 목격자 | OTHER`
- **정보공개방식:** `직접서술 | 리스트 | 대화체 | 선언문 | OTHER`

**OTHER 반환 시:** `otherLabel`(짧은 자유서술 라벨) 필수. `value !== "OTHER"`이면 `otherLabel === null`. Zod refinement로 강제.

> 왜 enum 우선인가: 자유서술로 두면 "시크 / 시크함 / 무심함 / 관찰자적 태도"처럼 표기가 분산되어 Portfolio 집계가 불가능해진다.

**구조화 필드 (임의 점수 대신 boolean/enum/짧은 근거):**

- `hookCodeReason` — Hook 판단 근거 한 줄
- `listHomogeneity` — 리스트형일 때 항목 간 문법적 균질성: `{ applicable, pass, evidence }`
- `salesMessageStandsOut` — 제품·판매 메시지가 다른 내용보다 과도하게 튀는지: `{ pass, evidence }` (pass=true는 "튀지 않음")
- `referenceCloneRisk` — 레퍼런스 원문이 있을 때만: 문장·수치·디테일을 과도하게 복제했는지: `{ applicable, level: "low"|"medium"|"high", quotedFragments[] }`
- `healthClaimsToVerify` — 건강·영양·효능·의학 관련 사실검증 필요한 주장: string[]
- `topProblems` — 가장 큰 문제 1~3개: string[1..3]
- `revisionDirection` — 수정 방향: string (짧게)

AI는 **근거 없는 수치를 만들지 않는다.** 확신 못하는 지표는 반환하지 않는 편이 낫다.

### 1.5 Portfolio Analysis (Excel 전체)

전체 행이 분석된 뒤 1회 계산. **통계는 코드가 계산하고, AI는 해석/추천만 담당.**

**코드가 계산하는 것:**
- Hook A~M 개수 + NEW_PATTERN_CANDIDATE 개수
- 감정태도 비율
- 화자 비율
- 정보공개방식 비율
- 등급 분포 (`A`, `B`, `FAIL`)
- 과사용 경고: 특정 카테고리 상위 임계치(예: 40% 초과) 초과 시 자동 표시

**AI가 생성하는 것:**
- "다음 소재에서 어떤 방향을 우선 채우면 좋을지" 자유서술 + 추천 조합 예시(예: `L × 친구관찰 × 대화체`).

### 1.6 결과 저장 방식 (파일)

- **화면:** 표 + 상단 Portfolio 카드 (막대차트는 Tailwind div bar — D-003).
- **다운로드:** 브라우저 다운로드로 새 xlsx.
  - 파일명: `{원본이름}_ANALYZED_{YYYYMMDD_HHmm}.xlsx`.
  - 시트: `원본 그대로` + `Analysis`(등급/게이트/진단 컬럼 추가) + `Portfolio`(집계·경고·AI 추천).

### 1.7 로컬 캐시 (row-level, localStorage)

- Supabase·IndexedDB는 Review Phase에서 사용하지 않는다.
- **캐시 키:** `SHA-256(draft + ␞ + (refOriginal ?? "") + ␞ + promptVersion)`.
- 동일 입력은 사용자 강제 재분석이 아니면 Claude 재호출 안 함.
- 새로고침·재업로드 후에도 결과 즉시 복구.
- 빈 Excel 행은 API 호출·캐시 항목 모두 만들지 않는다.
- 전체 재분석 시작 전 예상 호출 개수(캐시 히트 반영) 표시.
- "이 행 강제 재분석", "전체 강제 재분석", "캐시 비우기" 버튼.
- 향후 서버 DB 저장으로 확장 가능한 구조 유지.

### 1.8 성능·비용

- 초기 동시성 = 3.
- 실패 행은 표시만 하고 나머지는 계속 진행. 실패 행만 재시도 버튼.

### 1.9 인증

- Claude API endpoint가 Vercel에 공개되는 순간부터 **shared-password 필수.**
- Review Phase 6에서 Vercel 배포 시 도입 (그전에는 로컬 개발만).
- `REVIEW_SHARED_PASSWORD` env와 비교, HttpOnly 세션 쿠키(30일).
- Google OAuth 등 복잡 인증 없음.

---

## 2. `/scout` 사양 요약 (Review 완성 후 개발)

**전체 설계는 `docs/SCOUT_DESIGN.md` 참조.** 여기서는 원칙과 경계만 요약.

### 2.1 목적

**두 가지를 동시에.**
1. 기존에 알고 있는 좋은 바이럴 패턴을 효율적으로 찾기.
2. 기존에 없는 새로운 패턴을 지속적으로 탐험하기.

Scout는 검색어 몇십 개를 반복 실행하는 프로그램이 아니다. 그렇게 하면 같은 글만 계속 모여 다양성이 사라진다.

### 2.2 핵심 개념

- **Search Gene Pool** — 검색어를 코드 하드코딩 없이 Family → Seed 구조로 관리. 사용자가 코드 수정 없이 추가·수정·비활성화 가능.
- **Search Family ≠ Hook Code.** Family는 "새 콘텐츠를 찾기 위한 탐색" 체계, Hook은 "발견된 콘텐츠 분류" 체계. 절대 통합하지 않는다.
- **NEW_PATTERN_CANDIDATE.** A~M 어디에도 명확히 안 들어가지만 흥미로우면 버리지 않고 후보로 표시. 새 Hook Code 자동 확정 없음(사용자 승인 필요).
- **Novelty / Similarity.** 기존 저장분과 비교. 값은 단일 공식으로 합치지 않고 개별 저장.
- **Semantic Clustering.** 서로 다른 검색어가 사실상 같은 유형의 글을 가져올 수 있으므로 Exact Dedup 뒤에 Cluster 판정. 초기엔 가장 단순한 방식으로 시작(Vector DB 등 도입 X).
- **Diversity Quota.** 같은 Family/Hook/화자/구조가 결과를 독점하지 못하게 상한.
- **Exploit / Explore.** Exploit ≈ 70–80%, Explore ≈ 20–30%. 비율은 설정 가능.
- **Query Provenance & Performance.** Query 출처(USER_MANUAL / AI_EXPANSION / SAVED_REFERENCE / DISCOVERED_PATTERN)와 성과 축적 가능한 구조. 초기엔 자동 최적화 없음.

### 2.3 Optional Engagement Verification (조회수 확인)

- 공식 Threads Keyword Search가 타인의 view count를 주지 않을 수 있음.
- **핵심 의존성으로 만들지 않는다.** 상위 후보만 대상, 공개 상태에서 로그인 없이 확인 가능한 데이터만.
- **금지:** 로그인/CAPTCHA/Rate Limit/접근 제한 우회.
- 조회수를 못 구해도 후보 삭제 금지: `views: null, viewSource: "UNAVAILABLE"`.
- 이 모듈이 고장나도 Scout의 검색·분석·저장은 정상 동작.

### 2.4 Scout Phase 요약

`docs/ACCEPTANCE_TESTS.md`의 Scout A~G 참조. 자동 수집(cron)은 Phase G에서만.

---

## 3. Non-Goals (지금은 안 만드는 것)

- 다중 사용자 계정·권한
- 팀 협업(코멘트, 승인 흐름)
- 모바일 전용 UI
- Threads 외 플랫폼
- AI 파인튜닝 / 자동 ML 추천 시스템
- 실시간 알림
- 자체 이미지 저장/CDN
- Vector DB, 대규모 Queue, Microservice
- OAuth
- 초기부터 복잡한 단일 추천 공식

---

## 4. 열려 있는 결정

- **없음** — Phase 1~6(Review) 및 Scout A~G 착수에 필요한 설계 원칙은 이 문서와 `docs/SCOUT_DESIGN.md`, `docs/DATA_CONTRACT.md`, `docs/DECISIONS.md`에 모두 명시되어 있다.
- 세부 튜닝 값(Exploit/Explore 비율의 정확한 초기값, Diversity Quota의 정확한 N, 조회수 임계치의 초기 기본값)은 Scout Phase 진입 시 실운영 데이터로 결정한다.
