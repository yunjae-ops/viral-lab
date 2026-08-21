# SPEC.md — Viral Lab 기능 사양

## 0. 한 줄 요약

Threads 바이럴 콘텐츠 업무용 내부 웹도구. Next.js 한 프로젝트 안에 두 페이지.

- **`/review`** — 내가 Excel에 수동 작성한 Threads 콘텐츠를 업로드하면 내 바이럴 원칙에 얼마나 부합하는지 AI가 분석.
- **`/scout`** — Threads에서 새 바이럴 레퍼런스를 지속적으로 발굴. **"내가 아직 확보하지 않은 새로운 콘텐츠 구조"를 계속 발견**하는 것이 핵심 목적.

개발 순서: **Review 완성 → 실제 업무 검증 → Scout 개발.**

Scout 세부 설계는 `docs/SCOUT_DESIGN.md`. Reconstruction 판정의 완전한 규칙은 `docs/RECONSTRUCTION_RULES.md`.

---

## 1. `/review` 사양

### 1.1 사용자 시나리오

1. Excel 업로드.
2. 도구가 Header 행을 자동 감지하고 어느 행이 Header인지 표시.
3. 미리보기 확인 후 "분석 시작".
4. 각 행에 대해 Claude로 Hygiene + Critical + Diagnostic 계산.
   캐시(§1.9)에 동일 입력이 있으면 Claude 호출 생략.
5. 진행률 실시간 표시.
6. 완료 시 표 + 상단 Portfolio 카드. 각 행 상세에는 Critical Gate + Reconstruction 결과가 한 화면에 표시(§1.6).
7. "결과 다운로드"로 `..._ANALYZED_YYYYMMDD_HHmm.xlsx` (원본 보존).

### 1.2 입력 Excel 형식

- 첫 행이 Header라고 가정하지 않는다.

- **필수 Header (3종):** `순서`, `/제목`, `리뷰내용`.
- **선택 Header (2종):** `이미지 파일명`(있으면 그대로 실려 나감, 없어도 정상 동작), `레퍼런스 원문`(있을 때만 Critical Gate 중 `appealTransfer`와 `reconstruction` 활성화).
- **Header 별칭:** `/제목`=`레퍼런스 링크`, `리뷰내용`=`작성안`=`작성한 글`.
- **Header 자동 감지:** 첫 20행 · 셀 `trim` · 필수 3종(별칭 포함) 모두 포함하는 첫 행이 Header. 못 찾으면 명확한 에러.

### 1.3 Hygiene Gate (구 Core Gate) — 구조 완성도

| # | Gate | 통과 기준 |
|---|---|---|
| G1 | 본문 완결성 | 질문·댓글의 답변에 의존하지 않고 본문만으로 내용이 완결되는가 |
| G2 | 발견/전환 | 발견 또는 전환이 존재하는가 (예: `근데`, `그런데`, `알고 보니`, `웃긴 건`, `실제로 해보니`). **단어 존재가 아니라 의미상 전환**을 판단 |
| G3 | 서사 완결 | 서사가 본문 안에서 완결되는가 |
| G4 | 결과·원인 구조성 | 결과의 원인이 구체적이고 구조적으로 활용 가능한가 |

`hygiene.grade` (서버 재계산): 4 → **A**, 3 → **B**, 0–2 → **FAIL**. C·D 없음.

### 1.4 Critical Gate — Review 최상위 판정

Review의 최상위 목적은 "잘 쓰인 Threads 글인가"가 아니라 **레퍼런스가 준 심리적 엔진을 새 소재로 옮겨오는 데 성공했는가 + 사람들이 검색까지 가는가 + 표면 서사를 새로 만들었는가**이다.

#### 1.4.1 Reference / Draft Core Appeal 추출 (기존)

- `referenceCoreAppeal` (refOriginal 있을 때) — 심리적 소구 한 문장. **단순 주제 요약 금지.**
- `referenceViralEngine` — 소구를 강하게 만든 표현 장치 (대비 · 반전 · 사회적 증거 · 반복사용 증거 · 관계 · 숫자 · 상황).
- `draftCoreAppeal` — draft에서도 별도 추출.

#### 1.4.2 Appeal Transfer (기존, 레퍼런스 있을 때만)

`STRONG | PARTIAL | MISMATCH` + `evidence` + `deviationPoint`. 표면 문장 복제가 아니라 **심리적 엔진**이 넘어왔는지.

#### 1.4.3 Product Curiosity (기존)

`STRONG | MEDIUM | WEAK` + `evidence`.

#### 1.4.4 Search Motivation (기존)

`STRONG | MEDIUM | WEAK` + `evidence` + `liftDirection`. Product Curiosity보다 엄격. 정보량 기반 STRONG 금지. 본문 미완성/댓글 유도 STRONG 금지.

### 1.4a Reconstruction Quality (신규, 레퍼런스 있을 때만)

**원칙: 심리적 엔진은 보존하되, 그 엔진을 전달하는 사건과 서사는 새로 만든다.** 완전한 규칙은 `docs/RECONSTRUCTION_RULES.md`.

4개 표면 서사 축 + 장애물 + 표면 복제 위험을 독립적으로 평가:

- **Persona** — `CHANGED | SAME | NOT_APPLICABLE` + Reference/Draft summary + evidence
- **Event** — `CHANGED | SAME | NOT_APPLICABLE` + summaries + evidence
- **Deficiency Trigger** — `CHANGED | SAME | ADDED | NOT_APPLICABLE` + summaries + evidence. ADDED는 변화로 취급. **억지 비극·과장된 위험 상황을 사실처럼 제시하는 방식은 좋은 재구성으로 평가하지 않는다.**
- **Ending Method** — `CHANGED | SAME | NOT_APPLICABLE` + `endingType`(`정보 질문 | 감정 질문 | 선언 | 관찰 | 추천 | 반전 | 결론 | 리스트 마감 | OTHER`) + evidence. `disclosureMode`(글 전체 표현 형식)와 절대 혼동하지 않는다.
- **Obstacle** — `referenceHasObstacle`, `draftHasObstacle`, `functionPreserved`, `detailsTransformed`, `evidence`. **장애물은 단순 디테일이 아니라 Viral Engine의 일부일 수 있으므로 삭제하면 안 되고, 기능은 유지하되 내용은 재구성해야 한다.**
- **Surface Clone Risk** — `LOW | MEDIUM | HIGH` + `quotedFragments[]` + `evidence`. (기존 `diagnostic.referenceCloneRisk`를 여기로 이동·재명명, 대소문자 통일.)

**서버 결정적 계산 (§1.5, RECONSTRUCTION_RULES §6):**
- `unchangedCount` — 4개 축 중 `SAME` 개수 (`NOT_APPLICABLE`은 제외).
- `applicableCount` — 4개 축 중 `NOT_APPLICABLE`이 아닌 개수 (Portfolio 축별 SAME 비율 분모).
- `verdict` — `0 → TRANSFORMED`, `1 → BORDERLINE`, `2+ → TOO_CLOSE`.

**단순 단어 치환은 CHANGED로 인정하지 않는다** (프롬프트 상수에 예시 포함: 엄마→이모, 3년→2년, 119→응급실 등).

**AI는 "법적 표절이다/아니다"라고 단정하지 않는다.** 이 판정은 내부 재구성 훈련 기준.

### 1.5 Final Verdict — 서버 결정적 규칙 (Reconstruction 반영)

`finalVerdict.value ∈ { READY | NEEDS_REVISION | FAIL }`. **임의 100점 점수 방식 금지.**

Let `refExists = (refOriginal !== null && refOriginal !== "")`.

**FAIL** — 아래 중 하나라도 참이면:
- `hygiene.grade === "FAIL"`
- `searchMotivation.value === "WEAK"`
- `refExists && appealTransfer.value === "MISMATCH"`
- **NEW:** `refExists && reconstruction.verdict === "TOO_CLOSE"`
- **NEW:** `refExists && reconstruction.surfaceCloneRisk.value === "HIGH"`

**READY** — FAIL이 아니면서 모두 참이어야:
- `hygiene.grade === "A"`
- `searchMotivation.value === "STRONG"`
- `refExists ? appealTransfer.value === "STRONG" : true`
- **NEW:** `refExists ? reconstruction.verdict === "TRANSFORMED" : true`
- **NEW:** `refExists ? reconstruction.surfaceCloneRisk.value !== "HIGH" : true`

**NEEDS_REVISION** — 그 외. `BORDERLINE`은 READY가 아니라 최소 NEEDS_REVISION.

레퍼런스 없는 draft에서는 Reconstruction을 Final Verdict 계산에서 제외.

`reasons[]`는 서버가 사람이 읽는 원인을 채움. (예: `"reconstruction.verdict = TOO_CLOSE (Persona/Event SAME)"`, `"surfaceCloneRisk = HIGH — 특이 숫자 3개 그대로"`.)

### 1.6 각 행 상세 UI (레퍼런스 있을 때 한 화면에)

**CRITICAL GATE**
- Reference Core Appeal
- Reference Viral Engine
- Draft Core Appeal
- Appeal Transfer (값 + 근거)
- Product Curiosity (값 + 근거)
- Search Motivation (값 + 근거)
- 이탈지점 (`appealTransfer.deviationPoint`)
- 검색 동기 수정방향 (`searchMotivation.liftDirection`)

**RECONSTRUCTION** (Critical Gate 아래)
- Persona: Reference → Draft (CHANGED / SAME)
- Event: Reference → Draft (CHANGED / SAME)
- Deficiency Trigger: Reference → Draft (CHANGED / SAME / ADDED / N/A)
- Ending Method: Reference → Draft (CHANGED / SAME / N/A) + `endingType` Reference → Draft
- Obstacle: 기능 유지 여부 · 세부내용 재구성 여부
- Surface Clone Risk: LOW / MEDIUM / HIGH
- Unchanged: `{unchangedCount} / {applicableCount}`
- Reconstruction Verdict: TRANSFORMED / BORDERLINE / TOO_CLOSE
- 가장 크게 원문과 겹치는 지점 (`reconstruction.evidence`)
- 재구성하려면 무엇을 바꿔야 하는지 (`reconstruction.revisionDirection`)

레퍼런스가 없으면 이 두 섹션의 Reference·Appeal Transfer·Reconstruction 항목은 숨긴다 (Product Curiosity / Search Motivation은 계속 표시).

Appeal Transfer와 Reconstruction은 **독립 축**이므로 함께 표시하되 하나의 값으로 뭉치지 않는다. 조합 해석은 `RECONSTRUCTION_RULES §7`.

### 1.7 Diagnostic (참고 지표)

- **Hook Code:** `A|B|C|D|E|F|G|H|I|J|K|L|M | NEW_PATTERN_CANDIDATE` (`docs/HOOK_CODES.md`).
- **감정태도:** `절박함 | 시크함 | 순수감탄 | 놀람 | OTHER`
- **화자:** `본인 1인칭 | 딸-엄마 관찰 | 친구-친구 관찰 | 순수 목격자 | OTHER`
- **정보공개방식:** `직접서술 | 리스트 | 대화체 | 선언문 | OTHER` — **글 전체 표현 형식**. `endingMethod.endingType`(마지막 서사 기능)과 절대 통합하지 않는다.
- 구조화 필드: `hookCodeReason`, `listHomogeneity`, `salesMessageStandsOut`, `healthClaimsToVerify`, `topProblems[1..3]`, `revisionDirection`.
- **`referenceCloneRisk`는 `critical.reconstruction.surfaceCloneRisk`로 이동됨 (§1.4a).** Diagnostic에는 더 이상 존재하지 않는다.

### 1.8 Portfolio Analysis

**코드가 계산:**
- Hook A~M + NEW_PATTERN_CANDIDATE 개수
- 감정 / 화자 / 정보공개방식 분포 (OTHER 별도)
- `hygieneGrade` 분포 (`A`, `B`, `FAIL`)
- `appealTransfer` 분포 (`STRONG` / `PARTIAL` / `MISMATCH` / `N/A`)
- `productCuriosity` 분포 (`STRONG` / `MEDIUM` / `WEAK`)
- `searchMotivation` 분포 (`STRONG` / `MEDIUM` / `WEAK`)
- `finalVerdict` 분포 (`READY` / `NEEDS_REVISION` / `FAIL`)
- **NEW: 재구성 훈련 지표 (레퍼런스 있는 행만):**
  - `reconstructionVerdict` 분포 (`TRANSFORMED` / `BORDERLINE` / `TOO_CLOSE`)
  - `surfaceCloneRisk` 분포 (`LOW` / `MEDIUM` / `HIGH`)
  - 축별 SAME 횟수: `personaSame` / `eventSame` / `deficiencyTriggerSame` / `endingSame` (각 분모는 축별 applicable 행 수)
  - 향후 표시 예정 컬럼 준비: `obstacleDeletedCount`, `obstacleDetailClonedCount`
- 경고: `OVERUSE`, `MISMATCH_HEAVY`, `SEARCH_WEAK_HEAVY`, `FORMAT_VS_SEARCH`, **NEW:** `RECONSTRUCTION_TOO_CLOSE_HEAVY`, `SURFACE_CLONE_HEAVY`.

**AI가 생성:**
- "다음 소재에서 어떤 방향을 우선 채울지" 자유서술 + 조합 예시.
- 재구성 훈련 피드백 (예: "사건과 결핍 계기를 새로 만드는 능력이 가장 부족하다") — 카운트는 서버가 주입, AI는 해석만.

### 1.9 로컬 캐시 (row-level, localStorage)

- **`promptVersion = v3`** (Reconstruction 도입). 프리픽스 `viral-lab:review:v3:`.
- 캐시 키: `SHA-256(draft + ␞ + (refOriginal ?? "") + ␞ + promptVersion)`.
- 동일 입력은 강제 재분석 아니면 재호출 안 함.
- 빈 draft 행은 API·캐시 모두 없음.

### 1.10 성능·비용

- 동시성 3. 실패 행은 표시만 하고 나머지 완주.

### 1.11 인증

- Vercel 배포 순간부터 shared-password 필수 (Phase 6). HttpOnly 세션 30일.

---

## 2. `/scout` 사양 요약 (Review 완성 후)

`docs/SCOUT_DESIGN.md` 참조. 핵심: Search Gene Pool · Novelty · Diversity · Exploration · NEW_PATTERN_CANDIDATE · Optional Engagement Verification. Review의 Reconstruction 데이터는 향후 Scout novelty 판정의 입력으로 사용 가능 (SCOUT_DESIGN §4a).

---

## 3. Non-Goals

- 다중 사용자·팀 협업·모바일 전용
- Threads 외 플랫폼 / AI 파인튜닝 / 실시간 알림 / 자체 CDN
- Vector DB, 대규모 Queue, Microservice, OAuth
- 초기부터 복잡한 단일 추천 공식 / Review Final Verdict의 100점 점수 방식
- Reconstruction verdict를 "법적 표절 판정"으로 사용하는 것

---

## 4. 열려 있는 결정

- **없음.** 튜닝 값(과사용/재구성/표면복제 경고 임계, Diversity Quota N, Exploit/Explore 비율, 조회수 필터 default)은 실운영 데이터로 조정. 규칙 조정은 `DECISIONS.md`에 append.
