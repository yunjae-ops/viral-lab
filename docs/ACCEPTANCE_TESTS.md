# ACCEPTANCE_TESTS.md — Phase별 수용 테스트

각 Phase의 모든 항목을 **수동으로** 사용자가 눈으로 확인해 통과해야 그 Phase가 "완료".
Phase 완료 후:
1. `phase(N): ...` 커밋
2. 사용자에게 결과 스크린샷·설명 보고
3. 사용자의 명시적 "다음 Phase 진행" 승인 대기

승인 없이 다음 Phase 코드에 손대지 않는다.

---

# Review Phase (선행)

## Phase 0 — 문서 설계

**산출물:** `CLAUDE.md`, `docs/SPEC.md`, `docs/DATA_CONTRACT.md`, `docs/ACCEPTANCE_TESTS.md`, `docs/DECISIONS.md`, `docs/HOOK_CODES.md`, `docs/SCOUT_DESIGN.md`, **`docs/RECONSTRUCTION_RULES.md`**

**통과 기준:**
- [x] 8개 문서 존재
- [x] Critical Gate (Appeal Transfer / Product Curiosity / Search Motivation) 및 Reconstruction Quality (Persona/Event/Trigger/Ending/Obstacle/SurfaceCloneRisk) 및 Final Verdict 규칙이 SPEC/DATA_CONTRACT/RECONSTRUCTION_RULES/DECISIONS에 일관되게 반영
- [x] `phase(0): design docs` 커밋

---

## Phase 1 — 프로젝트 초기화 + Excel 파싱 (AI 없음)

**목표:** 로컬 파일 흐름 완결. AI 없음 → 인증 없음.

**산출물:**
- Next.js(App Router) + TypeScript + Tailwind
- `/review` 페이지: 파일 업로드(브라우저 파싱) + Header 자동 감지(trim + 별칭) + 감지 결과 표시 + 첫 3행 미리보기
- `.env.local.example`(값 비움): `ANTHROPIC_API_KEY=`, `ANTHROPIC_MODEL=`, `REVIEW_SHARED_PASSWORD=`

**통과 기준:**
- [ ] `pnpm dev`로 `/review` 로드
- [ ] Header 자동 감지 (앞쪽 빈 행·안내문 · 셀 앞뒤 공백 · 별칭 파일 · 이미지파일명 부재 · 레퍼런스원문 부재 모두 정상)
- [ ] 필수 3종 하나라도 빠지면 명확한 에러
- [ ] 리뷰내용 빈 행은 데이터 개수 제외
- [ ] 파일이 서버로 전송되지 않음
- [ ] grep: `NEXT_PUBLIC_ANTHROPIC_...` · `NEXT_PUBLIC_REVIEW_...` · 모델 ID 하드코딩 없음
- [ ] `phase(1): scaffold + excel parsing + header autodetect` 커밋

---

## Phase 2 — 한 행 AI 분석 + Hygiene + Critical + Reconstruction + Final Verdict

**목표:** 1행만 정확히 분석. Hygiene(4개) + Critical(Appeal Transfer / Product Curiosity / Search Motivation) + **Reconstruction(4축 + Obstacle + SurfaceCloneRisk)** + 서버 결정적 `finalVerdict` 계산.

**산출물:**
- `/api/review/analyze-row` route
- `lib/schema/rowAnalysis.ts` — Zod 스키마 (`DATA_CONTRACT §2.2`, §2.3, §2.3.1)
- `lib/review/verdict/finalVerdict.ts` — `DATA_CONTRACT §2.4` 규칙 구현 (Reconstruction FAIL/READY 조건 포함)
- `lib/review/verdict/reconstruction.ts` — unchangedCount / applicableCount / verdict 서버 계산
- `lib/review/prompts/analyzeRow.v3.ts` — 프롬프트 상수
  - Hook Code 정의(`HOOK_CODES.md`) 임베드
  - Gate 2는 **의미상 전환**
  - `referenceCoreAppeal`은 심리적 소구, 주제 요약 금지 (BAD/GOOD 예시)
  - Search Motivation: 정보량 STRONG 금지 · 본문 미완성/댓글 유도 STRONG 금지
  - **Reconstruction: `RECONSTRUCTION_RULES §5` 단순 단어 치환 금지 규칙(엄마→이모, 3년→2년, 119→응급실 등) 그대로 삽입**
  - **Reconstruction: 억지 비극·과장된 위험 상황을 사실처럼 제시하는 Deficiency Trigger는 좋은 재구성으로 평가 금지**
  - **AI는 verdict/unchangedCount를 스스로 확정하지 말 것 명시**
- **모델:** `process.env.ANTHROPIC_MODEL` 필수

**통과 기준 — 스키마·규칙:**
- [ ] 결과가 `DATA_CONTRACT §2.2` 스키마와 100% 일치
- [ ] `hygiene.grade ∈ A|B|FAIL`, `passedCount`가 gates true 개수와 일치 (서버 재계산 확인)
- [ ] `hookCode ∈ A~M | NEW_PATTERN_CANDIDATE` + `newPatternCandidate` refinement
- [ ] Diagnostic 3축 enum + OTHER refinement
- [ ] `diagnostic.referenceCloneRisk` 필드가 존재하지 않음 (`critical.reconstruction.surfaceCloneRisk`로 이동됨)
- [ ] 임의 백분율 필드 없음
- [ ] `meta.promptVersion === "v3"`

**통과 기준 — Critical Gate:**
- [ ] `refExists` 케이스: `critical.reference.coreAppeal/viralEngine`, `critical.appealTransfer` 채워짐
- [ ] `!refExists`: `critical.reference === null`, `critical.appealTransfer === null`, `critical.draftCoreAppeal`은 채워짐
- [ ] `appealTransfer.value ∈ STRONG|PARTIAL|MISMATCH` + evidence
- [ ] `productCuriosity.value ∈ STRONG|MEDIUM|WEAK` + evidence
- [ ] `searchMotivation.value ∈ STRONG|MEDIUM|WEAK` + evidence + liftDirection
- [ ] `referenceCoreAppeal`이 심리적 소구 문장인지 육안 확인 3건 이상

**통과 기준 — Reconstruction (`refExists`일 때):**
- [ ] `critical.reconstruction` 객체가 스키마 그대로 채워짐
- [ ] Persona/Event/Ending: value ∈ CHANGED|SAME|NOT_APPLICABLE, referenceSummary/draftSummary/evidence 필수
- [ ] Ending: `referenceType`·`draftType`이 endingType enum 중 하나
- [ ] DeficiencyTrigger: value ∈ CHANGED|SAME|ADDED|NOT_APPLICABLE, `value === "ADDED"`일 때 `referenceSummary === null`
- [ ] Obstacle: `referenceHasObstacle === false`이면 `functionPreserved === null && detailsTransformed === null`; 아니면 boolean
- [ ] `surfaceCloneRisk.value ∈ LOW|MEDIUM|HIGH`, `quotedFragments` 배열, evidence 문자열
- [ ] 서버가 `unchangedCount` = SAME 개수(N/A 제외), `applicableCount` = non-N/A 개수, `verdict`를 재계산해 덮어씀 (`0→TRANSFORMED, 1→BORDERLINE, 2+→TOO_CLOSE`)
- [ ] `!refExists`: `critical.reconstruction === null`

**통과 기준 — Reconstruction Case Suite (`RECONSTRUCTION_RULES §11`):**
아래 6개 케이스를 실 파일 또는 수동 입력으로 통과.

- [ ] **Case 1** — 제품명·단어만 몇 개 변경, Persona/Event/Trigger/Ending 사실상 동일 → **verdict = TOO_CLOSE**, `finalVerdict = FAIL`
- [ ] **Case 2** — Core Appeal/Viral Engine 유지 + 4축 모두 새로 설계 → **appealTransfer = STRONG + verdict = TRANSFORMED** (다른 조건 충족 시 `finalVerdict = READY`)
- [ ] **Case 3** — 스토리는 완전히 새롭지만 Reference Core Appeal 상실 → **verdict = TRANSFORMED + appealTransfer = MISMATCH → finalVerdict = FAIL**
- [ ] **Case 4** — Reference 장애물 나열이 있는데 Draft에서 장애물 삭제 → `obstacle.functionPreserved === false` + `topProblems`에 반영
- [ ] **Case 5** — Reference 장애물 기능 유지 + 실패 방법·사건은 새로 구성 → `functionPreserved === true && detailsTransformed === true`
- [ ] **Case 6** — 문장은 대부분 바뀌었지만 특이한 숫자/사건/순서/디테일 그대로 남음 → **surfaceCloneRisk = MEDIUM 또는 HIGH**, HIGH이면 `finalVerdict = FAIL`

**통과 기준 — Final Verdict:**
- [ ] `finalVerdict.value ∈ READY|NEEDS_REVISION|FAIL`, 서버가 `DATA_CONTRACT §2.4` 규칙으로 재계산
- [ ] `hygiene.grade === "FAIL"` → FAIL
- [ ] `searchMotivation === "WEAK"` → FAIL
- [ ] `refExists && appealTransfer === "MISMATCH"` → FAIL
- [ ] `refExists && reconstruction.verdict === "TOO_CLOSE"` → FAIL
- [ ] `refExists && surfaceCloneRisk === "HIGH"` → FAIL
- [ ] READY 조건 모두 충족 시 READY (Reconstruction TRANSFORMED · surfaceCloneRisk != HIGH 포함)
- [ ] BORDERLINE인 경우 절대 READY가 아니라 NEEDS_REVISION 이상
- [ ] `reasons[]`에 원인이 사람 읽을 수 있게 채워짐 (예: `"reconstruction.verdict = TOO_CLOSE (persona SAME + event SAME)"`)

**통과 기준 — 안정성:**
- [ ] Zod 실패 유도 시 최대 2회 재시도 후 에러 UI, 다른 행 영향 없음
- [ ] DevTools에서 API 키 노출 없음
- [ ] `meta.model === env ANTHROPIC_MODEL`
- [ ] grep: 모델 ID 하드코딩 없음
- [ ] `phase(2): single-row analyzer + hygiene + critical + reconstruction + verdict` 커밋

---

## Phase 3 — 전체 배치 분석 + localStorage row-level cache + 상세 UI

**산출물:**
- "전체 분석" + 확인 다이얼로그 (`총 N건, 캐시 히트 K건, 실제 호출 (N-K)건. 계속?`)
- 동시성 3
- 진행률 + 실패 재시도 + 강제 재분석 + 캐시 비우기
- localStorage row-level 캐시 (`DATA_CONTRACT §5`)
  - 키: SHA-256(draft + ␞ + (refOriginal ?? "") + ␞ + promptVersion)
  - 프리픽스: `viral-lab:review:v3:`
- 결과 표: Hygiene/Gates/Critical(요약)/Reconstruction(요약)/최종판정/Diagnostic 요약
- **각 행 상세 뷰** (`SPEC §1.6`, `RECONSTRUCTION_RULES §8`): 레퍼런스 있을 때
  - CRITICAL GATE 섹션 (Reference/Draft Core Appeal, Viral Engine, Appeal Transfer, Product Curiosity, Search Motivation, 이탈지점, 검색동기 수정방향)
  - RECONSTRUCTION 섹션 (4축 Reference→Draft, endingType, Obstacle 두 boolean, SurfaceCloneRisk, Unchanged {N}/{applicable}, verdict, 겹침 지점, 재구성 수정방향)
  - Appeal Transfer와 Reconstruction은 반드시 **독립된 두 값**으로 표시 (합치지 말 것)

**통과 기준:**
- [ ] 20행+ 전 행 결과 채워짐
- [ ] 실패 있어도 완주
- [ ] 새로고침 + 같은 파일 재업로드 → **Claude 호출 없이** 결과 복구
- [ ] draft 1자 변경 → 캐시 미스
- [ ] `promptVersion` 상승 시 전 행 캐시 무효화 (v2 → v3 프리픽스 변경 확인)
- [ ] 빈 draft 행은 API·캐시 없음
- [ ] 강제 재분석 · 캐시 비우기 정상 동작
- [ ] 4MB 근접 축출
- [ ] 각 행 상세에 CRITICAL GATE + RECONSTRUCTION 두 섹션이 한 화면에 (`SPEC §1.6`, `RECONSTRUCTION_RULES §8`)
- [ ] 레퍼런스 없는 행 상세에서는 Reference/AppealTransfer/Reconstruction 항목 숨김 (Product Curiosity/Search Motivation은 표시)
- [ ] **Case Suite 재검증:** Phase 2의 6개 케이스가 배치 실행에서도 각각 예상 verdict/finalVerdict를 유지
- [ ] `phase(3): batch analyzer + localStorage cache + detail ui` 커밋

---

## Phase 4 — Portfolio Analysis (Critical + Reconstruction 분포·훈련 지표)

**산출물:**
- `/api/review/portfolio` route
- 통계·경고는 서버 결정적 계산 (`DATA_CONTRACT §3.2`)
- `recommendation.text`·`suggestedAngles`만 Claude 1회
- 상단 Portfolio 카드 (Tailwind div bar)
- Hook 카운트에 `NEW_PATTERN_CANDIDATE`
- Diagnostic 분포 + hygieneGrade + appealTransfer(N/A 포함) + productCuriosity + searchMotivation + finalVerdict
- **Reconstruction 훈련 지표 (레퍼런스 있는 행만):**
  - `reconstructionVerdict` 분포 (TRANSFORMED/BORDERLINE/TOO_CLOSE)
  - `surfaceCloneRisk` 분포 (LOW/MEDIUM/HIGH)
  - 축별 SAME 횟수 + applicable 분모 (`persona`/`event`/`deficiencyTrigger`/`ending`)
  - 컬럼 준비: `obstacleDeleted`, `obstacleDetailCloned`
- 경고: `OVERUSE`, `MISMATCH_HEAVY`, `SEARCH_WEAK_HEAVY`, `FORMAT_VS_SEARCH`, `RECONSTRUCTION_TOO_CLOSE_HEAVY`, `SURFACE_CLONE_HEAVY`, `AXIS_WEAK`

**통과 기준:**
- [ ] 카테고리 개수 합 = 총 행 수
- [ ] hygieneGrade에 C·D 없음
- [ ] appealTransfer `N/A` 개수 = refOriginal 없는 행 수
- [ ] finalVerdict 분포가 `DATA_CONTRACT §2.4` 규칙과 부합
- [ ] `reconstructionVerdict` · `surfaceCloneRisk` 분포는 refOriginal 있는 행만 대상
- [ ] 축별 SAME 카운트가 각 축의 applicable 분모로 표시됨
- [ ] 경고 종류 6+가 조건 만족 시 정확히 표시
  - `RECONSTRUCTION_TOO_CLOSE_HEAVY` (0.35+)
  - `SURFACE_CLONE_HEAVY` (0.15+)
  - `AXIS_WEAK` (축별 SAME 비율 0.50+)
- [ ] AI 추천 문단이 카운트 데이터를 참조한 훈련 피드백을 포함 (예: "사건과 결핍 계기를 새로 만드는 능력이 가장 부족")
- [ ] AI가 별도 카운트를 만들지 않음 (서버 계산값만 사용)
- [ ] `phase(4): portfolio analysis + reconstruction training metrics` 커밋

---

## Phase 5 — ANALYZED Excel 다운로드

**산출물:**
- SheetJS로 새 xlsx (`DATA_CONTRACT §4`)

**통과 기준:**
- [ ] 시트 3개(원본/`Analysis`/`Portfolio`)
- [ ] 원본 시트 = 원본 셀 단위 일치
- [ ] `Analysis` 시트에 모든 신규 컬럼 존재:
  - Hygiene등급/G1~G4
  - 참조소구/참조바이럴엔진/작성안소구/AppealTransfer(+근거/이탈지점)/제품호기심(+근거)/검색동기(+근거/수정방향)
  - **재구성판정 · Unchanged · Persona · Event · 결핍계기 · EndingMethod · Reference결말유형 · Draft결말유형**
  - **장애물_기능유지 · 장애물_세부재구성**
  - **SurfaceCloneRisk · SurfaceClone인용**
  - **재구성겹침지점 · 재구성수정방향**
  - 최종판정/판정근거
  - Hook/NewPatternName/감정(+_기타라벨)/화자(+_기타라벨)/공개방식(+_기타라벨)
  - 판매튐/건강주장/구조문제점/구조수정방향
- [ ] 레퍼런스 없는 행은 재구성/참조/AppealTransfer 관련 셀 공란
- [ ] Portfolio 시트 = UI와 같은 숫자
- [ ] 원본 파일이 저장소·서버·로컬 스토리지 어디에도 남지 않음
- [ ] `phase(5): analyzed export` 커밋

---

## Phase 6 — Vercel 배포 + shared-password + 실제 업무 테스트

**산출물:**
- `/login` + `REVIEW_SHARED_PASSWORD` 세션 (HttpOnly, 30일)
- `/review`·`/api/review/*` 인증 게이팅
- Vercel env 3종 등록
- 실 파일 3회+ 왕복 테스트

**통과 기준:**
- [ ] Vercel `/login` 정상, 잘못된 비밀번호 거부, 인증 없이 접근 시 리다이렉트/401
- [ ] 세션 쿠키 HttpOnly + Secure
- [ ] Reconstruction Case Suite (Phase 2 §6개)가 배포판에서도 동일하게 예상 결과
- [ ] 사용자가 "실 업무에 쓸 수 있다" 판단
- [ ] `phase(6): vercel deploy + shared-password + real-use validation` 커밋
- [ ] **Scout Phase 착수 여부 명시 확인**

---

# Scout Phase (Review Phase 6 완료 + 명시 승인 후)

세부는 `docs/SCOUT_DESIGN.md`. Review에서 축적된 Reconstruction 데이터는 향후 Scout novelty 판정의 입력으로 사용 가능 (`SCOUT_DESIGN §4a`).

## Scout A — Search Family + Seed Query 관리 + 수동 검색
- [ ] 코드 변경 없이 Family/Seed CRUD
- [ ] 공식 Threads API 결과 표시, 저장 없음
- [ ] AI가 만들지 않은 값(view count 등) 임의 생성 없음
- [ ] `phase(scout-a): family + seed + manual search` 커밋

## Scout B — SAVE/REJECT + Supabase + Exact Dedup
- [ ] SAVE/REJECT Supabase 반영, permalink unique 중복 없음
- [ ] `phase(scout-b): supabase + save/reject + exact dedup` 커밋

## Scout C — AI 분류 + Novelty
- [ ] quality/novelty/similarity 개별 저장
- [ ] Diagnostic enum(+OTHER+otherLabel) 준수
- [ ] `saved_references.core_appeal`/`viral_engine` 컬럼 사용 가능 (Review 개념 재사용)
- [ ] `phase(scout-c): ai classification + novelty` 커밋

## Scout D — Semantic Clustering + Diversity Quota + Explore 슬롯
- [ ] cluster 상한, Family/Hook/화자/공개방식 상한 준수
- [ ] Explore 슬롯에 낮은 quality + 높은 novelty 포함
- [ ] 설정값 (하드코딩 없음)
- [ ] `phase(scout-d): clustering + diversity + explore` 커밋

## Scout E — Query Candidate + NEW_PATTERN_CANDIDATE + Query Performance
- [ ] AI 제안 Query 자동 ACTIVE 안 됨
- [ ] 사용자 승인 UI 존재
- [ ] 새 Hook Code 자동 확정 없음
- [ ] Query별 실행/후보/SAVE 개수 조회 가능
- [ ] `phase(scout-e): query candidate + new pattern + performance` 커밋

## Scout F — Optional Public Engagement Verification
- [ ] 조회수 확인 못한 후보 삭제 안 됨 (`views: null, viewSource: "UNAVAILABLE"`)
- [ ] 로그인/CAPTCHA/Rate Limit/접근 제한 우회 없음(코드 리뷰)
- [ ] 이 모듈 강제 OFF에서도 Scout A~E 정상
- [ ] `phase(scout-f): optional engagement verification` 커밋

## Scout G — Cron 자동 수집
- [ ] Scout A~F가 2주+ 안정 수동 운영 후에만
- [ ] 실패가 조용히 사라지지 않음
- [ ] Cron 중단/재개 관리자 UI
- [ ] `phase(scout-g): cron auto-collect` 커밋
