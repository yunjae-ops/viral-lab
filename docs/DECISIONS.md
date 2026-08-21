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
- **날짜:** 2026-08-21
- **결정:** Review가 실사용 검증(Review Phase 6)까지 끝난 뒤에만 Scout 관련 폴더·의존성(Supabase 포함)을 추가.
- **대안:** 병행 개발 / Scout 먼저 → 모두 탈락.
- **비고:** Review 안정 전에는 `app/scout`, `lib/scout`, `@supabase/*` 없어야 함.

---

## D-002 · Portfolio·Scout 집계는 코드가 계산, AI는 해석/추천만

- **상태:** accepted
- **날짜:** 2026-08-21
- **맥락:** 개수·비율·경고·유사도·과사용은 결정적이며 AI가 하면 오차·비용 문제.
- **결정:** 코드로 계산 가능한 통계는 전부 코드가 결정적으로 계산. AI는 "다음 방향 추천" 자유서술만.
- **대안:** 전부 AI → 탈락. 전부 코드 → 탈락(추천 서술은 규칙화 어려움).
- **비고:** AI가 근거 없는 수치를 만들지 않는다는 원칙(D-011)과 짝.

---

## D-003 · 초기 차트는 Chart 라이브러리 없이 CSS 막대

- **상태:** accepted
- **결정:** Portfolio·Scout 초기 차트는 Tailwind div bar. 필요 명확할 때만 라이브러리.

---

## D-004 · Core Grade는 A/B/FAIL, Hook은 A~M + NEW_PATTERN_CANDIDATE, Diagnostic 3축은 enum + OTHER

- **상태:** accepted (2026-08-21 개정, 초판·1차 개정 supersede)
- **날짜:** 2026-08-21
- **결정 (Core Grade):**
  - 4개 통과 → **A**, 3개 → **B**, 0–2개 → **FAIL**.
  - C·D 없음. 등급은 서버가 재계산해 덮어쓴다.
  - Gate 2는 예시 단어(`근데`, `그런데`, `알고 보니`, `웃긴 건`, `실제로 해보니`)의 **존재 여부**가 아니라 **의미상 전환**을 판단.
- **결정 (Hook Code):** `A~M` 정의는 `docs/HOOK_CODES.md`로 고정. A~M에 명확히 속하지 않으면 `NEW_PATTERN_CANDIDATE`로 반환하고 4개 부가 필드(`whyDifferent`, `structureSummary`, `proposedName`, `linguisticFeatures[]`) 함께 반환.
- **결정 (Diagnostic 3축):** 처음부터 enum + OTHER + otherLabel. Zod refinement로 강제.
  - 감정: `절박함 | 시크함 | 순수감탄 | 놀람 | OTHER`
  - 화자: `본인 1인칭 | 딸-엄마 관찰 | 친구-친구 관찰 | 순수 목격자 | OTHER`
  - 공개방식: `직접서술 | 리스트 | 대화체 | 선언문 | OTHER`
- **왜 enum인가:** 자유서술 시 "시크 / 시크함 / 무심함 / 관찰자적 태도"처럼 표기가 분산되어 Portfolio 집계가 불가능해진다.
- **대안:** enum 없이 자유서술 → 탈락. C·D 등급 유지 → 탈락. A~M에 억지로 끼워 맞추기 → 탈락(NEW_PATTERN 상실).

---

## D-005 · shared-password 인증 (Vercel 배포 순간부터)

- **상태:** accepted (2026-08-21 개정, 초판·1차 개정 supersede)
- **날짜:** 2026-08-21
- **결정:**
  - Review Phase 1~5는 **로컬 개발**만. 로컬에서만 도는 동안엔 인증 없음.
  - Vercel에 배포되는 순간(Review Phase 6)부터 shared-password 필수.
  - `REVIEW_SHARED_PASSWORD` env와 비교, HttpOnly 세션 쿠키(30일).
  - Google OAuth 등 복잡 인증은 MVP에서 도입 안 함.
- **주의:** Phase 2~5 중 어떤 코드라도 Vercel에 배포하려면 그 배포부터 shared-password가 이미 적용된 상태여야 한다.
- **대안:** OAuth → 탈락. 인증 계속 없음 → 탈락(API 남용 위험).

---

## D-006 · Row-level 캐시는 localStorage

- **상태:** accepted (2026-08-21 개정, 초판·1차 개정 supersede)
- **날짜:** 2026-08-21
- **결정:**
  - Review Phase에서 Supabase·IndexedDB 미사용.
  - Phase 3부터 localStorage row-level 캐시 도입.
  - 캐시 키: `SHA-256(draft + ␞ + (refOriginal ?? "") + ␞ + promptVersion)`.
  - 동일 입력은 사용자 강제 재분석이 아니면 Claude 재호출 안 함.
  - 새로고침·재업로드 후에도 결과 복구.
  - 빈 draft 행은 캐시 항목·API 호출 모두 만들지 않음.
  - 전체 재분석 시작 전 예상 호출 개수(캐시 히트 포함) 표시.
  - 향후 서버 DB로 확장 가능한 구조 유지.
- **대안:** IndexedDB 초기 도입 → 탈락. Supabase → 탈락(Scout 전 도입 금지). 저장 안 함 → 탈락.

---

## D-007 · Claude 응답은 서버가 스키마 재검증 · 등급 재계산

- **상태:** accepted
- **결정:** 서버 API가 응답을 Zod로 검증하고, `passedCount`·`grade`는 gates로 재계산해 덮어쓴다. 매핑: `4→A, 3→B, 0-2→FAIL`.
- **비고:** "AI는 관찰자, 규칙은 코드가 판정한다."

---

## D-008 · 파일 파싱은 브라우저에서, 서버에는 텍스트만

- **상태:** accepted
- **결정:** SheetJS로 브라우저 파싱. API에는 분석 대상 텍스트 최소 필드만.

---

## D-009 · Claude 모델은 env `ANTHROPIC_MODEL` 관리, 하드코딩 금지

- **상태:** accepted
- **결정:** `process.env.ANTHROPIC_MODEL`에서만 읽는다. env가 비면 서버 시작 에러. `.env.local.example`은 값 비움. 응답 `meta.model`에 실제 사용 ID 실어 감사.
- **대안:** 코드 하드코딩 → 탈락. env fallback 기본값 → 탈락(실사용 모델 흐려짐).

---

## D-010 · Scout는 공식 Threads API가 1차, 크롤링은 부차

- **상태:** accepted
- **결정:** 공식 keyword search가 유일한 자동 수집 경로. 원문은 사용자 textarea fallback.
- **대안:** Puppeteer 상시 크롤링 → 탈락(정책 위험).

---

## D-011 · AI는 근거 없는 수치·값을 만들지 않는다

- **상태:** accepted (신규)
- **날짜:** 2026-08-21
- **맥락:** 초판 스키마엔 `salesRatioPercent`처럼 AI가 직관으로 만들어내야 하는 백분율이 있었다. 이 값은 재현성·신뢰성이 낮다.
- **결정:**
  - 임의 스코어 필드 제거. 가능한 곳은 boolean/enum + 짧은 근거로 대체.
    - 판매 튐 여부: `salesMessageStandsOut: { pass, evidence }`
    - 레퍼런스 복제 위험: `referenceCloneRisk: { applicable, level: "low"|"medium"|"high", quotedFragments[] }`
  - Scout에서 조회수 등 공식 API가 주지 않는 값은 AI가 만들어내지 않는다. `null`로 저장하고 `viewSource: "UNAVAILABLE"`.
- **비고:** 향후 진짜 스코어가 필요해지면 계산 근거를 코드로 명세한 뒤 도입.

---

## D-012 · Scout의 목적은 "새 구조 발견", 검색량이 아니다

- **상태:** accepted (신규)
- **날짜:** 2026-08-21
- **결정:** Scout의 핵심 KPI는 "새 콘텐츠 구조를 얼마나 계속 발견하는가". 단순히 후보 수집량을 늘리는 파라미터(더 많은 검색어, 더 큰 페이지, 더 잦은 실행)를 KPI로 삼지 않는다. 파이프라인은 Novelty/Diversity/Exploration을 1등 시민으로 다룬다(SCOUT_DESIGN §2, §7, §8, §9).
- **대안:** 검색량 극대화 → 탈락(같은 글 반복 수집으로 다양성 붕괴).

---

## D-013 · Scout 초기엔 단일 recommendation 공식을 만들지 않는다

- **상태:** accepted (신규)
- **날짜:** 2026-08-21
- **결정:** `quality_score`, `novelty_score`, `similarity_max`, `family_id`, `hook`, `classification`은 개별 컬럼으로 저장. 이들을 하나의 recommendation score로 합치는 공식은 실사용 데이터가 쌓인 뒤 조정.
- **대안:** 처음부터 `final_score = 0.4*q + 0.3*n - 0.2*s + ...` 같은 공식 → 탈락(경험 없이 잘못된 가중치를 굳힘).

---

## D-014 · Search Family와 Hook Code는 별도 체계

- **상태:** accepted (신규)
- **날짜:** 2026-08-21
- **결정:**
  - Search Family = "새 콘텐츠를 찾기 위한 탐색" 체계. 검색어 그룹.
  - Hook Code = "발견된 콘텐츠 분류" 체계. A~M + NEW_PATTERN_CANDIDATE.
  - 두 축을 동일하게 만들지 않는다. `scout_candidates`에 `family_id`(탐색 origin)와 `classification/hook`(발견된 구조)을 별개 컬럼으로 유지.
- **대안:** Family로 Hook까지 대체 → 탈락(범주 오염).

---

## D-015 · NEW_PATTERN_CANDIDATE는 자동 확정되지 않는다

- **상태:** accepted (신규)
- **날짜:** 2026-08-21
- **결정:**
  - AI가 A~M에 안 맞는 콘텐츠를 만나면 `NEW_PATTERN_CANDIDATE`로 표시하고 4필드(`whyDifferent`, `structureSummary`, `proposedName`, `linguisticFeatures[]`)를 제안.
  - `pattern_candidates` 테이블에 관찰 누적.
  - **사용자 승인 없이 새 Hook Code로 자동 승격되지 않는다.** 승격 시 `docs/HOOK_CODES.md`, DATA_CONTRACT enum, `promptVersion`을 함께 갱신(D-018).

---

## D-016 · Semantic Clustering은 최소 방식으로 시작, Vector DB 도입 금지(MVP)

- **상태:** accepted (신규)
- **날짜:** 2026-08-21
- **결정:**
  - Cluster 판정 초기 방식(택1 예시, 실제 방식은 Scout D 시작 시 확정):
    - 단순 lexical 유사도(문자 n-gram Jaccard) + AI가 뽑은 짧은 "구조 키" 매칭
    - 또는 SAVE·후보를 batch로 AI에게 넘겨 "같은 구조 후보끼리 묶기"
  - Vector DB(Pinecone, Weaviate, pgvector)를 MVP에서 도입하지 않는다.
- **대안:** 처음부터 pgvector → 탈락(운영·비용·개념 부담).
- **비고:** 실제 필요가 확인되면 도입 검토.

---

## D-017 · Diversity Quota와 Exploit/Explore는 설정값

- **상태:** accepted (신규)
- **날짜:** 2026-08-21
- **결정:**
  - Diversity Quota(동일 Family/Hook/화자/공개방식/Cluster 상한 N) 및 Exploit/Explore 비율(초기 70–80% / 20–30%)은 코드가 아니라 설정값(env 또는 관리 UI)으로 관리.
  - Explore 슬롯은 quality가 조금 낮아도 novelty가 높으면 선정될 수 있다.

---

## D-018 · Hook Code 승격 절차 (사용자 승인)

- **상태:** accepted (신규)
- **날짜:** 2026-08-21
- **결정:** 새 Hook Code 승격 시 아래를 함께 진행.
  1. `pattern_candidates.state = APPROVED` + `approved_hook_code` 지정.
  2. `docs/HOOK_CODES.md`에 항목 추가.
  3. `docs/DATA_CONTRACT.md` `hookCode` enum 갱신.
  4. `promptVersion` 상승.
  5. 캐시 자연 무효화.
- **비고:** AI가 이 절차를 자동 실행하지 않는다.

---

## D-019 · Optional Engagement Verification: 안전 규칙 절대 준수

- **상태:** accepted (신규)
- **날짜:** 2026-08-21
- **결정:**
  - 상위 후보에 한해, 공개 상태에서 로그인 없이 확인 가능한 조회수만 사용.
  - **금지:** 로그인·CAPTCHA·Rate Limit·접근 제한 우회.
  - 못 구한 값은 `views: null, viewSource: "UNAVAILABLE"`. 후보 삭제 금지.
  - 이 모듈이 고장나도 Scout의 검색·분석·저장은 정상 동작해야 한다(격리된 실패 도메인).
  - 최소 조회수 필터(`제한 없음 | 1,000+ | 10,000+ | 100,000+`)는 설정값.
- **대안:** 조회수를 Scout의 필수 의존성으로 → 탈락(공식 API 미제공 시 시스템 전체 붕괴).

---

## D-020 · MVP 오버엔지니어링 금지 목록

- **상태:** accepted (신규)
- **날짜:** 2026-08-21
- **결정:** 다음은 실제 필요가 확인되기 전에는 만들지 않는다.
  - 복잡한 Vector DB / 대규모 Queue / Microservice
  - OAuth
  - 자동 ML 추천 시스템
  - 무리한 크롤링 / 브라우저 자동화의 우회적 사용
  - 초기부터 복잡한 단일 추천 공식(D-013)
  - 불필요한 상태관리 라이브러리
- **비고:** "지금 필요한 만큼보다 무거운 것을 만드는 것이 잘못된 구조로 갈아엎게 되는 첫 번째 이유다."

---

## D-021 · Review Phase 순서 개편 (Phase 1~6)

- **상태:** accepted (신규)
- **날짜:** 2026-08-21
- **맥락:** 이전 안(1~7)은 "scaffold + first deploy"를 Phase 1로 두고 Excel 파싱을 Phase 2로 미뤘다. 사용자가 확정한 새 순서는 로컬 개발 5단계 + 배포/인증/실사용 1단계다.
- **결정:** Review Phase 목록을 다음으로 개편.
  1. Phase 1 — Next.js 초기화 + `/review` + Excel 업로드 + Header 자동 감지 + 행 표시 (AI 없음)
  2. Phase 2 — 한 행 AI 분석 + Zod
  3. Phase 3 — 배치 분석 + localStorage row-level cache + 강제 재분석
  4. Phase 4 — Portfolio Analysis
  5. Phase 5 — ANALYZED Excel 다운로드
  6. Phase 6 — Vercel 배포 + shared-password + 실제 업무 테스트
- **비고:** 인증은 원래 Vercel 배포와 붙어야 한다는 원칙(D-005)에 맞게 자연스럽게 정렬됨.

---

## 열려 있는 결정(미정)

- **없음.** Phase 착수에 필요한 설계 원칙은 모두 확정.
- 다음 값들은 **설계가 아니라 튜닝**이므로 실운영 데이터로 나중에 결정:
  - Portfolio 과사용 경고 임계 비율의 확정 값(초기 40% 임시)
  - Diversity Quota의 정확한 N 값
  - Exploit/Explore 정확한 비율의 초기 default (초기 예: 75/25)
  - Optional Engagement Verification 최소 조회수 필터의 default (초기 예: 제한 없음)
