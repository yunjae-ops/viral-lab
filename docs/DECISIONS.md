# DECISIONS.md — 설계 결정 기록 (ADR)

각 결정 형식:
- **상태:** proposed / accepted / superseded
- **날짜:** YYYY-MM-DD
- **맥락 / 결정 / 대안 / 비고**

---

## D-001 · 개발 순서는 Review → Scout 고정
- **상태:** accepted
- **결정:** Review Phase 6까지 끝난 뒤에만 Scout 관련 폴더·의존성 추가.

## D-002 · Portfolio·Scout 집계는 코드가 계산, AI는 해석/추천만
- **상태:** accepted
- **결정:** 코드로 계산 가능한 통계는 코드가 결정적으로 계산. AI는 자유서술만.

## D-003 · 초기 차트는 Chart 라이브러리 없이 CSS 막대
- **상태:** accepted

## D-004 · Hygiene Grade는 A/B/FAIL, Hook은 A~M + NEW_PATTERN_CANDIDATE, Diagnostic 3축은 enum + OTHER
- **상태:** accepted (2026-08-21 개정)
- **결정 (Hygiene, 옛 Core Grade):** 4→A, 3→B, 0~2→FAIL. Gate 2는 의미상 전환.
- **결정 (Hook):** `A~M` + `NEW_PATTERN_CANDIDATE`.
- **결정 (Diagnostic 3축):** enum + OTHER + otherLabel.

## D-005 · shared-password 인증 (Vercel 배포 순간부터)
- **상태:** accepted

## D-006 · Row-level 캐시는 localStorage
- **상태:** accepted
- **결정:** SHA-256(draft + ␞ + (refOriginal ?? "") + ␞ + promptVersion).

## D-007 · Claude 응답은 서버가 스키마 재검증 · 등급/verdict 재계산
- **상태:** accepted (2026-08-21 확장)
- **결정:** Zod 검증. `hygiene.passedCount`·`hygiene.grade`·`finalVerdict`·`reconstruction.unchangedCount`·`reconstruction.applicableCount`·`reconstruction.verdict`는 모두 서버가 재계산해 덮어씀.

## D-008 · 파일 파싱은 브라우저에서, 서버에는 텍스트만
- **상태:** accepted

## D-009 · Claude 모델은 env `VIRAL_LAB_ANTHROPIC_MODEL` 관리, 하드코딩 금지
- **상태:** accepted (2026-08-21 개정 · D-026 반영, env 변수명 변경)

## D-010 · Scout는 공식 Threads API가 1차, 크롤링은 부차
- **상태:** accepted

## D-011 · AI는 근거 없는 수치·값을 만들지 않는다
- **상태:** accepted

## D-012 · Scout의 목적은 "새 구조 발견", 검색량이 아니다
- **상태:** accepted

## D-013 · Scout 초기엔 단일 recommendation 공식을 만들지 않는다
- **상태:** accepted

## D-014 · Search Family와 Hook Code는 별도 체계
- **상태:** accepted

## D-015 · NEW_PATTERN_CANDIDATE는 자동 확정되지 않는다
- **상태:** accepted

## D-016 · Semantic Clustering은 최소 방식으로 시작, Vector DB 도입 금지(MVP)
- **상태:** accepted

## D-017 · Diversity Quota와 Exploit/Explore는 설정값
- **상태:** accepted

## D-018 · Hook Code 승격 절차 (사용자 승인)
- **상태:** accepted

## D-019 · Optional Engagement Verification: 안전 규칙 절대 준수
- **상태:** accepted

## D-020 · MVP 오버엔지니어링 금지 목록
- **상태:** accepted (2026-08-21 확장)
- **결정:** MVP에서 만들지 않는다.
  - 복잡한 Vector DB / 대규모 Queue / Microservice
  - OAuth
  - 자동 ML 추천 시스템
  - 무리한 크롤링 / 브라우저 자동화 우회 사용
  - 초기부터 복잡한 단일 추천 공식(D-013)
  - Review Final Verdict의 임의 100점 점수 방식(D-022)
  - **Reconstruction verdict를 "법적 표절 판정"으로 사용하는 것(D-024)**
  - 불필요한 상태관리 라이브러리

## D-021 · Review Phase 순서 (Phase 1~6)
- **상태:** accepted

## D-022 · Critical Gate와 Final Verdict — Reconstruction 반영
- **상태:** accepted (2026-08-21 개정 · D-024 반영)
- **결정 (Critical Gate):** referenceCoreAppeal/referenceViralEngine/draftCoreAppeal + appealTransfer(STRONG/PARTIAL/MISMATCH) + productCuriosity(STRONG/MEDIUM/WEAK) + searchMotivation(STRONG/MEDIUM/WEAK).
- **결정 (Final Verdict, 서버 결정적, Reconstruction 반영):**

  Let `refExists = (refOriginal !== null && refOriginal !== "")`.

  - **FAIL** — 아래 중 하나:
    - `hygiene.grade === "FAIL"`
    - `searchMotivation.value === "WEAK"`
    - `refExists && appealTransfer.value === "MISMATCH"`
    - `refExists && reconstruction.verdict === "TOO_CLOSE"`
    - `refExists && reconstruction.surfaceCloneRisk.value === "HIGH"`
  - **READY** — FAIL 아니고 모두 참:
    - `hygiene.grade === "A"`
    - `searchMotivation.value === "STRONG"`
    - `refExists ? appealTransfer.value === "STRONG" : true`
    - `refExists ? reconstruction.verdict === "TRANSFORMED" : true`
    - `refExists ? reconstruction.surfaceCloneRisk.value !== "HIGH" : true`
  - 그 외: **NEEDS_REVISION** (BORDERLINE 포함).
- **비고:** 임의 100점 점수 금지. 규칙 조정은 이 문서에 append. `promptVersion` 상승 필요 없음(순수 서버 규칙 변경 시).

## D-023 · JSON 스키마 필드 `core` → `hygiene`, promptVersion v2
- **상태:** accepted (그대로 유지)

## D-024 · Reconstruction Quality (신규)
- **상태:** accepted
- **날짜:** 2026-08-21
- **맥락:** 기존 Appeal Transfer와 referenceCloneRisk만으로는 "심리적 엔진은 옮겼지만 표면 서사는 그대로 베낌" 같은 상태를 정확히 잡을 수 없다. 사용자의 목적은 재구성 훈련 도구이기도 하므로 표면 서사 재구성 여부를 명시적으로 축으로 삼는다.
- **결정 (역할 분리):**
  - **Appeal Transfer** — 심리적 엔진(Core Appeal + Viral Engine) 이전 성공 여부. (기존)
  - **Reconstruction Quality** — 표면 서사(Persona/Event/DeficiencyTrigger/EndingMethod) 및 장애물이 새로 설계됐는가. (신규)
  - **Surface Clone Risk** — 원문의 실제 표현·고유 디테일이 지나치게 복제됐는가. **기존 `diagnostic.referenceCloneRisk`를 `critical.reconstruction.surfaceCloneRisk`로 이동·재명명. enum도 `low/medium/high` → `LOW/MEDIUM/HIGH` 통일.**
- **결정 (Reconstruction 스키마):**
  - 4개 축: Persona / Event / DeficiencyTrigger / EndingMethod.
    - value enum:
      - Persona · Event · EndingMethod: `CHANGED | SAME | NOT_APPLICABLE`
      - DeficiencyTrigger: `CHANGED | SAME | ADDED | NOT_APPLICABLE`
    - EndingMethod는 `endingType` enum 추가: `정보 질문 | 감정 질문 | 선언 | 관찰 | 추천 | 반전 | 결론 | 리스트 마감 | OTHER`. `disclosureMode`(글 전체 표현 형식)와 절대 통합하지 않는다.
    - 각 축에 근거·요약 문자열 필드.
  - Obstacle: `referenceHasObstacle`, `draftHasObstacle`, `functionPreserved`(boolean|null), `detailsTransformed`(boolean|null), `evidence`.
  - SurfaceCloneRisk: `value ∈ LOW|MEDIUM|HIGH` + `quotedFragments[]` + `evidence`.
  - AI는 verdict/unchangedCount를 확정하지 않는다.
- **결정 (서버 계산):**
  - `unchangedCount` = 4축 중 `SAME` 개수 (`NOT_APPLICABLE` 제외).
  - `applicableCount` = 4축 중 `NOT_APPLICABLE`이 아닌 개수 (Portfolio 축별 SAME 비율 분모).
  - `verdict`: `0 → TRANSFORMED`, `1 → BORDERLINE`, `2+ → TOO_CLOSE`.
- **결정 (Obstacle 판정 원칙):**
  - 레퍼런스에 없으면 `functionPreserved = null, detailsTransformed = null`.
  - 레퍼런스에 있는데 Draft에서 삭제하면 `functionPreserved = false` + `topProblems` 반영.
  - 이름만 치환은 `functionPreserved = true, detailsTransformed = false`.
  - 이상: `functionPreserved = true, detailsTransformed = true`.
- **결정 (단순 단어 치환 금지):** 엄마→이모, 3년→2년, 119→응급실 등 명사·숫자만 치환은 CHANGED로 인정하지 않는다. 프롬프트 상수에 예시 삽입.
- **결정 (억지 비극 금지):** 제품 판매를 위해 과장된 위험 상황을 사실처럼 제시하는 DeficiencyTrigger는 좋은 재구성으로 평가하지 않는다.
- **결정 (Final Verdict 반영):** D-022 규칙에 5개 조건 추가 (FAIL 2개, READY 2개, BORDERLINE 처리).
- **결정 (Portfolio 훈련 지표):** `reconstructionVerdict` 분포, `surfaceCloneRisk` 분포, 축별 SAME/applicable 카운트, `obstacleDeleted`/`obstacleDetailCloned` 카운트. `AXIS_WEAK`, `RECONSTRUCTION_TOO_CLOSE_HEAVY`, `SURFACE_CLONE_HEAVY` 경고 신설.
- **결정 (판정 목적):** 이 판정은 내부 재구성 훈련 기준이며, **AI가 "법적 표절이다/아니다"라고 단정하지 않는다.** UI 카피는 "단순 각색/치환에 가까움. 다시 작성 권장" 형태.
- **대안:**
  - Appeal Transfer 안에 흡수 → 탈락 (심리적 엔진 이전과 표면 서사 재구성은 서로 독립 축).
  - referenceCloneRisk만 강화 → 탈락 (문장 유사도만으로는 Persona/Event 구조 변화 판정 불가).
  - AI가 verdict 직접 확정 → 탈락 (D-007 원칙 위반).
- **비고:** 완전한 규칙은 `docs/RECONSTRUCTION_RULES.md`.

## D-025 · promptVersion v3 (Reconstruction 도입)
- **상태:** accepted
- **날짜:** 2026-08-21
- **결정:** Reconstruction 필드·EndingMethod endingType·surfaceCloneRisk 대소문자 변경 등 스키마 확장에 따라 `promptVersion`을 `v2` → `v3`으로 올린다. 캐시 프리픽스 `viral-lab:review:v2:` → `viral-lab:review:v3:` 로 자동 무효화. ANALYZED Excel에는 재구성 관련 컬럼이 추가된다.
- **비고:** 앞으로 Reconstruction 규칙(단순 단어 치환 예시, 축별 판정 임계 등) 조정 시에도 프롬프트가 바뀌면 promptVersion 상승. 순수 서버 규칙(임계값·finalVerdict) 조정은 상승 불필요.

## D-026 · 앱 환경변수 `ANTHROPIC_API_KEY`/`ANTHROPIC_MODEL` → `VIRAL_LAB_ANTHROPIC_API_KEY`/`VIRAL_LAB_ANTHROPIC_MODEL`
- **상태:** accepted
- **날짜:** 2026-08-21
- **결정:** Viral Lab 앱이 Claude API 호출에 사용하는 env 이름을 `ANTHROPIC_API_KEY`/`ANTHROPIC_MODEL`에서 `VIRAL_LAB_ANTHROPIC_API_KEY`/`VIRAL_LAB_ANTHROPIC_MODEL`로 변경한다.
- **이유:** `ANTHROPIC_API_KEY`는 Claude Code 자체 실행 인증에도 사용될 수 있는 이름이라, 앱의 API 호출용 secret과 Claude Code 실행 인증을 분리한다.
- **영향:** `.env.local.example`, `lib/review/env.ts`, `CLAUDE.md §5/§6`, `DATA_CONTRACT.md §2.2/§7`. `NEXT_PUBLIC_` 접두어는 여전히 금지. promptVersion 변경 없음(순수 env 이름 변경이며 프롬프트·스키마는 바뀌지 않음).
- **비고:** D-009를 개정.

---

## 열려 있는 결정(미정)

- **없음.** 튜닝 값은 실운영 데이터로 조정하며 이 문서에 append:
  - Portfolio 경고 임계 (`OVERUSE` 0.40, `MISMATCH_HEAVY` 0.30, `SEARCH_WEAK_HEAVY` 0.35, `RECONSTRUCTION_TOO_CLOSE_HEAVY` 0.35, `SURFACE_CLONE_HEAVY` 0.15, `AXIS_WEAK` 0.50, `FORMAT_VS_SEARCH` 조건)
  - Diversity Quota N
  - Exploit/Explore 초기 default
  - Optional Engagement Verification 최소 조회수 default
  - Semantic Clustering 구체 방식 (Scout Phase D에서 확정)
  - Final Verdict 규칙 조정
  - Reconstruction Case Suite 실 데이터 확장
