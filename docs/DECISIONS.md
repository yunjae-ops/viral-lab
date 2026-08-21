# DECISIONS.md — 설계 결정 기록 (ADR)

각 결정은 다음 형식.

- **상태:** proposed / accepted / superseded
- **날짜:** YYYY-MM-DD
- **맥락:** 왜 이 결정이 필요한가
- **결정:** 무엇을 하기로 했는가
- **대안:** 고려했지만 안 쓴 것들
- **비고:** 초보자 관점 부연

> "ADR" = Architecture Decision Record. 왜 이 결정을 했는지 나중에도 알 수 있게 남기는 짧은 노트.

---

## D-001 · 개발 순서는 Review → Scout 고정
- **상태:** accepted
- **결정:** Review Phase 6까지 끝난 뒤에만 Scout 관련 폴더·의존성 추가.
- **비고:** Review 안정 전 `app/scout`, `lib/scout`, `@supabase/*` 없어야 함.

---

## D-002 · Portfolio·Scout 집계는 코드가 계산, AI는 해석/추천만
- **상태:** accepted
- **결정:** 코드로 계산 가능한 통계는 코드가 결정적으로 계산. AI는 "다음 방향 추천" 자유서술만.

---

## D-003 · 초기 차트는 Chart 라이브러리 없이 CSS 막대
- **상태:** accepted

---

## D-004 · Hygiene Grade는 A/B/FAIL, Hook은 A~M + NEW_PATTERN_CANDIDATE, Diagnostic 3축은 enum + OTHER
- **상태:** accepted (2026-08-21 개정)
- **결정 (Hygiene, 옛 Core Grade):**
  - 4개 통과 → **A**, 3개 → **B**, 0–2개 → **FAIL**. C·D 없음.
  - Gate 2는 예시 단어의 **존재 여부**가 아니라 **의미상 전환**을 판단.
- **결정 (Hook Code):** `A~M` 정의는 `docs/HOOK_CODES.md`. A~M에 안 맞으면 `NEW_PATTERN_CANDIDATE` + 4필드.
- **결정 (Diagnostic 3축):** enum + OTHER + otherLabel (Zod refinement).

---

## D-005 · shared-password 인증 (Vercel 배포 순간부터)
- **상태:** accepted
- **결정:** Vercel 배포 시점(Review Phase 6)부터 필수. `REVIEW_SHARED_PASSWORD` env, HttpOnly 세션 30일. OAuth 없음.

---

## D-006 · Row-level 캐시는 localStorage
- **상태:** accepted
- **결정:** Review Phase에서 Supabase·IndexedDB 미사용. Phase 3부터 localStorage row-level 캐시. 키 = SHA-256(draft + ␞ + (refOriginal ?? "") + ␞ + promptVersion). 강제 재분석 없이 재호출 안 함. 빈 draft는 캐시·API 모두 없음.

---

## D-007 · Claude 응답은 서버가 스키마 재검증 · 등급 재계산
- **상태:** accepted
- **결정:** 서버 API가 Zod 검증. `hygiene.passedCount`·`hygiene.grade`·`finalVerdict`는 서버가 재계산해 덮어씀. 매핑: `4→A, 3→B, 0-2→FAIL`. Final Verdict 규칙은 D-022.

---

## D-008 · 파일 파싱은 브라우저에서, 서버에는 텍스트만
- **상태:** accepted

---

## D-009 · Claude 모델은 env `ANTHROPIC_MODEL` 관리, 하드코딩 금지
- **상태:** accepted
- **결정:** `process.env.ANTHROPIC_MODEL`에서만. env 비면 서버 에러. `.env.local.example`은 값 비움. 응답 `meta.model`은 실제 사용 ID.

---

## D-010 · Scout는 공식 Threads API가 1차, 크롤링은 부차
- **상태:** accepted

---

## D-011 · AI는 근거 없는 수치·값을 만들지 않는다
- **상태:** accepted
- **결정:** 임의 스코어 필드 금지. boolean/enum + 짧은 근거로 대체. Scout에서 공식 API가 주지 않는 값(view count 등)은 `null` + `UNAVAILABLE`.

---

## D-012 · Scout의 목적은 "새 구조 발견", 검색량이 아니다
- **상태:** accepted

---

## D-013 · Scout 초기엔 단일 recommendation 공식을 만들지 않는다
- **상태:** accepted
- **결정:** quality/novelty/similarity를 개별 컬럼으로 저장. 결합 공식은 실 데이터가 쌓인 뒤.

---

## D-014 · Search Family와 Hook Code는 별도 체계
- **상태:** accepted
- **결정:** Family = 탐색, Hook = 분류. `scout_candidates`에 `family_id`와 `hook/classification`을 별개 컬럼.

---

## D-015 · NEW_PATTERN_CANDIDATE는 자동 확정되지 않는다
- **상태:** accepted
- **결정:** `pattern_candidates`에 누적. 사용자 승인 시에만 새 Hook Code 승격.

---

## D-016 · Semantic Clustering은 최소 방식으로 시작, Vector DB 도입 금지(MVP)
- **상태:** accepted

---

## D-017 · Diversity Quota와 Exploit/Explore는 설정값
- **상태:** accepted
- **결정:** 상한 N, Exploit/Explore 초기 70~80/20~30 모두 코드 하드코딩 없이 설정값.

---

## D-018 · Hook Code 승격 절차 (사용자 승인)
- **상태:** accepted
- **결정:** `pattern_candidates.state = APPROVED` + `approved_hook_code` 지정 → `HOOK_CODES.md`, DATA_CONTRACT enum, `promptVersion` 상승.

---

## D-019 · Optional Engagement Verification: 안전 규칙 절대 준수
- **상태:** accepted
- **결정:** 공개 상태 로그인 없이 확인 가능한 데이터만. 로그인/CAPTCHA/Rate Limit/접근 제한 우회 금지. 미확인 후보는 삭제 없이 `views: null, viewSource: "UNAVAILABLE"`. 이 모듈이 고장나도 Scout 나머지는 정상.

---

## D-020 · MVP 오버엔지니어링 금지 목록
- **상태:** accepted (2026-08-21 확장)
- **결정:** MVP에서 만들지 않는다.
  - 복잡한 Vector DB / 대규모 Queue / Microservice
  - OAuth
  - 자동 ML 추천 시스템
  - 무리한 크롤링 / 브라우저 자동화 우회 사용
  - 초기부터 복잡한 단일 추천 공식(D-013)
  - **Review Final Verdict의 임의 100점 점수 방식(D-022)**
  - 불필요한 상태관리 라이브러리

---

## D-021 · Review Phase 순서 (Phase 1~6)
- **상태:** accepted (2026-08-21 개정)
- **결정:**
  1. Phase 1 — Next.js 초기화 + `/review` + Excel 업로드 + Header 자동 감지 + 행 표시 (AI 없음)
  2. Phase 2 — 한 행 AI 분석 + Zod + **Hygiene + Critical Gate + Final Verdict**
  3. Phase 3 — 배치 + localStorage row-level cache + 강제 재분석
  4. Phase 4 — Portfolio Analysis (Critical 분포 포함)
  5. Phase 5 — ANALYZED Excel 다운로드
  6. Phase 6 — Vercel 배포 + shared-password + 실 업무 테스트

---

## D-022 · Critical Gate와 Final Verdict (신규)
- **상태:** accepted (신규)
- **날짜:** 2026-08-21
- **맥락:** Hygiene(구 Core Gate) 4개만으로는 "잘 쓰인 Threads 글"만 검증할 수 있다. 하지만 Review의 최상위 목적은 레퍼런스의 심리적 엔진을 새 소재로 옮겨오고, 사람들이 실제로 검색 행동까지 하게 만들었는가이다.
- **결정 (Critical Gate):**
  - `referenceCoreAppeal`(단순 주제 요약 금지, 심리적 소구 한 문장) + `referenceViralEngine`을 refOriginal이 있을 때 먼저 추출.
  - `draftCoreAppeal`을 draft에서 추출.
  - `appealTransfer.value ∈ STRONG | PARTIAL | MISMATCH` + `evidence` + `deviationPoint`. 표면 문장 복제가 아니라 심리적 엔진 이전 성공 여부.
  - `productCuriosity.value ∈ STRONG | MEDIUM | WEAK` + `evidence`.
  - `searchMotivation.value ∈ STRONG | MEDIUM | WEAK` + `evidence` + `liftDirection`. Product Curiosity보다 엄격. 정보량 기반 STRONG 금지. 본문 미완성/댓글 유도로 만든 궁금증 STRONG 금지.
- **결정 (Final Verdict, 서버 결정적):**
  - `finalVerdict.value ∈ READY | NEEDS_REVISION | FAIL`.
  - **임의 100점 점수 방식 금지.**
  - 규칙 (refExists = refOriginal 존재):
    - **FAIL** — 아래 중 하나라도 참: `hygiene.grade === "FAIL"` · `searchMotivation === "WEAK"` · `refExists && appealTransfer === "MISMATCH"`.
    - **READY** — FAIL 아니고, 모두 참: `hygiene.grade === "A"` · `searchMotivation === "STRONG"` · `refExists ? appealTransfer === "STRONG" : true`.
    - 그 외 — **NEEDS_REVISION**.
  - `productCuriosity`는 finalVerdict를 직접 게이팅하지 않고 UI/Portfolio에서 별도 표시.
  - 서버가 `reasons[]`에 사람이 읽는 원인을 채운다.
- **UI:** 레퍼런스가 있는 경우 한 화면에 8개 항목(SPEC §1.6) 배치.
- **Portfolio:** 코드가 `appealTransfer`/`productCuriosity`/`searchMotivation`/`finalVerdict` 분포와 `MISMATCH_HEAVY`/`SEARCH_WEAK_HEAVY`/`FORMAT_VS_SEARCH` 경고를 계산.
- **대안:**
  - Critical을 gate로 두지 않고 참고 지표로만 → 탈락. 사용자 목적("검색 행동까지 유도")과 어긋남.
  - Hygiene에 Critical을 통합 → 탈락. 구조 완성도와 소구 이전은 다른 축.
  - 단일 100점 점수 → 탈락. 근거 없는 가중치가 굳음.
- **비고:** 규칙 튜닝은 이 문서 D-022에 append. `promptVersion` 상승 없이 조정 가능(순수 규칙 변경 시). Critical Gate·스키마 변경 시 `promptVersion` 상승 필요.

---

## D-023 · JSON 스키마 필드 `core` → `hygiene`, promptVersion v2
- **상태:** accepted (신규)
- **날짜:** 2026-08-21
- **맥락:** "Core Gate"라는 이름이 Critical Gate와 혼동을 일으킨다. `docs/SPEC.md`에서 이미 4개 게이트를 "Hygiene Gate"로 명명했고, JSON도 그에 맞춘다.
- **결정:**
  - `RowAnalysis` 응답의 `core` 필드를 `hygiene`으로 개명.
  - Critical Gate 도입에 맞춰 `promptVersion`을 `v1` → `v2`.
  - 캐시 프리픽스 `viral-lab:review:v1:` → `viral-lab:review:v2:` (자동 무효화).
  - ANALYZED Excel의 컬럼 `등급` → `Hygiene등급`.
- **비고:** 아직 코드가 없으므로 마이그레이션 부담 없음.

---

## 열려 있는 결정(미정)

- **없음.** Phase 착수에 필요한 설계 원칙 모두 확정.
- 튜닝 값(실운영 데이터로 조정):
  - Portfolio 경고 임계 (`OVERUSE` 0.40, `MISMATCH_HEAVY` 0.30, `SEARCH_WEAK_HEAVY` 0.35, `FORMAT_VS_SEARCH` 조건)
  - Diversity Quota N (Family/Hook/화자/공개방식/Cluster)
  - Exploit/Explore 초기 default (예: 75/25)
  - Optional Engagement Verification 최소 조회수 default (예: 제한 없음)
  - Semantic Clustering 구체 방식 (Scout Phase D에서 확정)
  - Final Verdict 규칙 조정 (실사용 후 D-022에 append)
