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

**산출물:** `CLAUDE.md`, `docs/SPEC.md`, `docs/DATA_CONTRACT.md`, `docs/ACCEPTANCE_TESTS.md`, `docs/DECISIONS.md`, `docs/HOOK_CODES.md`, `docs/SCOUT_DESIGN.md`

**통과 기준:**
- [x] 7개 문서 존재
- [x] Critical Gate(Appeal Transfer / Product Curiosity / Search Motivation) 및 Final Verdict 규칙이 SPEC/DATA_CONTRACT/DECISIONS에 일관되게 반영
- [x] 사용자 방향 승인
- [x] `phase(0): design docs` 커밋

---

## Phase 1 — 프로젝트 초기화 + Excel 파싱 (AI 없음)

**목표:** 로컬에서 파일 흐름 완결. AI 없음 → 인증 없음.

**산출물:**
- Next.js(App Router) + TypeScript + Tailwind
- `/review` 페이지
  - 파일 업로드 (브라우저에서만 파싱)
  - Header 자동 감지 (`DATA_CONTRACT.md §1.2`)
    - `trim`, 필수 3종 + 별칭 매칭
  - 감지된 Header 행 번호 + 선택 컬럼 유무 표시
  - 데이터 행 개수 + 첫 3행 미리보기
- `.env.local.example` (값 비움):
  ```
  ANTHROPIC_API_KEY=
  ANTHROPIC_MODEL=
  REVIEW_SHARED_PASSWORD=
  ```

**통과 기준:**
- [ ] `pnpm dev`로 `/review` 로드
- [ ] 사용자 실제 파일에서 Header 정확히 감지
- [ ] 앞쪽 빈 행/안내문 있어도 감지
- [ ] 셀 앞뒤 공백 있어도 감지 (trim)
- [ ] `/제목` 대신 `레퍼런스 링크` 감지
- [ ] `리뷰내용` 대신 `작성안`/`작성한 글` 감지
- [ ] `이미지 파일명` 없어도 정상 파싱 (필드 null)
- [ ] `레퍼런스 원문` 없어도 정상 파싱
- [ ] 필수 3종 하나라도 빠지면 명확한 에러
- [ ] `리뷰내용` 빈 행은 데이터 개수 제외
- [ ] 네트워크 탭에 파일이 서버로 전송되지 않음
- [ ] grep: `NEXT_PUBLIC_ANTHROPIC_...`·`NEXT_PUBLIC_REVIEW_...` 없음
- [ ] grep: 모델 ID 하드코딩(`claude-*`) 없음
- [ ] `phase(1): scaffold + excel parsing + header autodetect` 커밋

---

## Phase 2 — 한 행 AI 분석 + Hygiene + Critical Gate + Final Verdict

**목표:** 1행만 정확히 분석. `hygiene` + `critical`(Appeal Transfer / Product Curiosity / Search Motivation) + 서버 결정적 `finalVerdict` 계산.

**산출물:**
- `/api/review/analyze-row` route
- `lib/schema/rowAnalysis.ts` — Zod 스키마 (`DATA_CONTRACT.md §2.2`)
  - `hygiene.grade ∈ A|B|FAIL`
  - `critical.reference` / `critical.appealTransfer`는 `refOriginal` null이면 `null`; 아니면 필수
  - `critical.productCuriosity` / `critical.searchMotivation` 항상 필수
  - `hookCode`에 `NEW_PATTERN_CANDIDATE` 포함 및 `newPatternCandidate` refinement
  - Diagnostic enum + OTHER refinement
- `lib/review/verdict/finalVerdict.ts` — `DATA_CONTRACT §2.4` 규칙을 코드로 구현 (READY/NEEDS_REVISION/FAIL + reasons)
- `lib/review/prompts/analyzeRow.v2.ts` — 프롬프트 상수
  - Hook Code 정의(`HOOK_CODES.md`) 텍스트 임베드
  - Gate 2는 **의미상 전환** 판단이라고 명시
  - `referenceCoreAppeal`은 단순 주제 요약 금지 (BAD/GOOD 예시 포함)
  - Search Motivation: 정보량 기반 STRONG 금지, 본문 미완성/댓글 유도로 만든 궁금증 STRONG 금지
- **모델 사용:** `process.env.ANTHROPIC_MODEL` 필수 (없으면 서버 시작 에러)
- 미리보기 표 첫 행에 "이 행 분석" 버튼 + 결과 상세 뷰

**통과 기준 — 스키마·규칙:**
- [ ] 결과가 `DATA_CONTRACT §2.2` 스키마와 100% 일치
- [ ] `hygiene.grade ∈ A|B|FAIL` (다른 값 스키마 오류)
- [ ] `hygiene.passedCount`가 gates true 개수와 일치 (서버 재계산 확인)
- [ ] `hookCode ∈ A~M | NEW_PATTERN_CANDIDATE`
- [ ] `NEW_PATTERN_CANDIDATE`일 때 `newPatternCandidate` 4필드 존재, 아니면 `null`
- [ ] Diagnostic 3축이 각 enum 또는 OTHER 중 하나
- [ ] OTHER 시 `otherLabel` 문자열, 비-OTHER 시 `null`
- [ ] `referenceCloneRisk.applicable === (refOriginal !== null)`
- [ ] 임의 백분율 필드(`salesRatioPercent` 등) 존재하지 않음

**통과 기준 — Critical Gate:**
- [ ] `refOriginal`이 있는 케이스: `critical.reference.coreAppeal`, `critical.reference.viralEngine`, `critical.appealTransfer` 모두 채워짐
- [ ] `refOriginal`이 없는 케이스: `critical.reference === null`, `critical.appealTransfer === null`, `critical.draftCoreAppeal`은 여전히 채워짐
- [ ] `appealTransfer.value ∈ STRONG|PARTIAL|MISMATCH` + `evidence` 문자열
- [ ] `productCuriosity.value ∈ STRONG|MEDIUM|WEAK` + `evidence`
- [ ] `searchMotivation.value ∈ STRONG|MEDIUM|WEAK` + `evidence` + `liftDirection`
- [ ] `referenceCoreAppeal`이 단순 주제 요약이 아닌 심리적 소구 문장인지 사용자 육안 확인 (실 케이스 3건 이상)
- [ ] 본문을 일부러 미완성으로 만든 샘플에서 `searchMotivation`이 STRONG으로 나오지 않음 (프롬프트 규칙 준수 확인)

**통과 기준 — Final Verdict:**
- [ ] `finalVerdict.value ∈ READY|NEEDS_REVISION|FAIL`
- [ ] 서버가 §2.4 규칙으로 재계산 (AI 반환값 무시)
- [ ] `hygiene.grade === "FAIL"` → `finalVerdict === "FAIL"`
- [ ] `searchMotivation === "WEAK"` → `finalVerdict === "FAIL"`
- [ ] `refExists && appealTransfer === "MISMATCH"` → `finalVerdict === "FAIL"`
- [ ] `hygiene = A + searchMotivation = STRONG + (refExists ? appealTransfer = STRONG : true)` → `finalVerdict === "READY"`
- [ ] 그 외 → `NEEDS_REVISION`
- [ ] `finalVerdict.reasons`에 원인이 사람 읽을 수 있게 채워짐

**통과 기준 — 안정성:**
- [ ] Zod 실패 유도(프롬프트 훼손) 시 최대 2회 재시도 후 에러 UI, 다른 행 영향 없음
- [ ] DevTools에서 API 키 노출 없음
- [ ] `meta.model`이 `ANTHROPIC_MODEL` env 값과 일치
- [ ] `meta.promptVersion === "v2"`
- [ ] grep: 모델 ID 하드코딩 없음
- [ ] `phase(2): single-row analyzer + hygiene + critical + verdict` 커밋

---

## Phase 3 — 전체 배치 분석 + localStorage row-level cache

**산출물:**
- "전체 분석" 버튼 + 시작 전 확인 다이얼로그 (`총 N건, 캐시 히트 K건, 실제 호출 (N-K)건. 계속?`)
- 동시성 3 배치
- 진행률 바 + `47 / 120` + `캐시 히트 12`
- 실패 행 목록 + 각 행 재시도 버튼
- "이 행 강제 재분석", "전체 강제 재분석", "캐시 비우기"
- localStorage row-level 캐시 (`DATA_CONTRACT §5`)
  - 키: SHA-256(draft + ␞ + (refOriginal ?? "") + ␞ + promptVersion)
  - 프리픽스: `viral-lab:review:v2:`
- 결과 표: 원본 컬럼 + Hygiene/Gates/Critical(요약)/최종판정/Diagnostic 요약
- 각 행 상세 뷰(§1.6 UI): 레퍼런스 있을 때 Reference/Draft Core Appeal, Appeal Transfer, Product Curiosity, Search Motivation, 이탈지점, 수정방향을 한 화면에

**통과 기준:**
- [ ] 20행 이상 파일에서 전 행 결과 채워짐
- [ ] 실패 있어도 나머지 완주
- [ ] 재시도 버튼이 실패 행만 다시 처리
- [ ] 새로고침 + 같은 파일 재업로드 → **Claude 호출 없이** 결과 즉시 복구
- [ ] draft 1자 수정한 행은 캐시 미스
- [ ] `promptVersion` 상승 시 전 행 캐시 무효화 (프리픽스 변경 확인)
- [ ] 빈 draft 행은 API·캐시 모두 없음
- [ ] "이 행 강제 재분석" 시 캐시 무시 후 갱신
- [ ] "캐시 비우기" 후 전 행 새 호출
- [ ] 4MB 근접 시 오래된 엔트리 축출
- [ ] 각 행 상세 UI에서 §1.6 8개 항목이 모두 한 화면에 표시 (레퍼런스 있을 때)
- [ ] 레퍼런스 없는 행 상세에서는 Reference/Appeal Transfer 관련 항목이 숨겨짐
- [ ] `phase(3): batch analyzer + localStorage cache + row detail UI` 커밋

---

## Phase 4 — Portfolio Analysis (Critical Gate 분포 포함)

**산출물:**
- `/api/review/portfolio` route
- 통계·경고는 서버 코드 결정적 계산 — `DATA_CONTRACT §3.2` 그대로
- `recommendation.text`·`suggestedAngles`만 Claude 1회
- 상단 Portfolio 카드 (Tailwind div bar)
- Hook 카운트에 `NEW_PATTERN_CANDIDATE` 포함
- 감정/화자/공개방식 enum + `OTHER` 별도
- **appealTransfer / productCuriosity / searchMotivation / finalVerdict / hygieneGrade 분포 카드**
- 경고: `OVERUSE` · `MISMATCH_HEAVY` · `SEARCH_WEAK_HEAVY` · `FORMAT_VS_SEARCH`

**통과 기준:**
- [ ] 카테고리 개수 합이 총 행 수와 일치
- [ ] `hygieneGrade`에 C·D 없음
- [ ] `appealTransfer` 분포에 `N/A`가 refOriginal 없는 행 수와 일치
- [ ] `finalVerdict` 분포가 `DATA_CONTRACT §2.4` 규칙과 부합
- [ ] `SEARCH_WEAK_HEAVY` 임계치 초과 케이스에서 경고 표시
- [ ] `FORMAT_VS_SEARCH`(포맷 다양 + Search WEAK 다수)가 조건 만족 시 표시, "포맷은 다양하지만 제품 관심으로 이어지지 않는 소재가 많다" 카피
- [ ] `MISMATCH_HEAVY` 임계치 초과 시 표시
- [ ] AI 추천 문단이 스키마 검증 통과
- [ ] `phase(4): portfolio analysis + critical distributions` 커밋

---

## Phase 5 — ANALYZED Excel 다운로드

**산출물:**
- "결과 다운로드" 버튼
- SheetJS로 새 xlsx 생성 (`DATA_CONTRACT §4`)

**통과 기준:**
- [ ] 다운로드 파일에 시트 3개(원본/`Analysis`/`Portfolio`)
- [ ] 원본 시트가 원본과 셀 단위 일치
- [ ] `Analysis` 시트에 `DATA_CONTRACT §4.1` 컬럼 전부 채워짐:
  - Hygiene등급/G1~G4
  - 참조소구/참조바이럴엔진/작성안소구
  - AppealTransfer/근거/이탈지점
  - 제품호기심/근거
  - 검색동기/근거/수정방향
  - 최종판정/판정근거
  - Hook/NewPatternName
  - 감정/화자/공개방식(각 _기타라벨)
  - 판매튐/유사도/건강주장/구조문제점/구조수정방향
- [ ] `Portfolio` 시트가 UI와 같은 숫자
- [ ] 원본 파일은 저장소·서버·클라이언트 스토리지 어디에도 남지 않음
- [ ] `phase(5): analyzed export` 커밋

---

## Phase 6 — Vercel 배포 + shared-password + 실제 업무 테스트

**산출물:**
- `/login` 페이지
- 서버 route: `REVIEW_SHARED_PASSWORD` 비교 → HttpOnly 세션 쿠키(30일)
- `/review`, `/api/review/*` 세션 없으면 `/login` 또는 401
- Vercel 프로젝트 + env 3종 등록
- 실 파일 3회 왕복 테스트

**통과 기준:**
- [ ] Vercel URL에서 `/login` → 비밀번호 통과 후 `/review` 정상
- [ ] 잘못된 비밀번호 거부
- [ ] 로그인 없이 `/review` 접근 시 리다이렉트
- [ ] 로그인 없이 `/api/review/*` 호출 시 401
- [ ] 세션 쿠키 HttpOnly + Secure
- [ ] 사용자가 "실 업무에 쓸 수 있다" 판단
- [ ] `phase(6): vercel deploy + shared-password + real-use validation` 커밋
- [ ] 이 시점에서 **Scout Phase 착수 여부 명시 확인**

---

# Scout Phase (Review Phase 6 완료 + 명시 승인 후에만)

`docs/SCOUT_DESIGN.md`. 요약 통과 기준.

## Scout A — Search Family + Seed Query 관리 + 수동 검색
- [ ] 코드 변경 없이 Family/Seed 추가·수정·비활성화
- [ ] 공식 Threads API 결과 표시, 저장 없음
- [ ] AI가 만들지 않은 값(view count 등) 임의 생성 없음
- [ ] `phase(scout-a): family + seed + manual search` 커밋

## Scout B — SAVE/REJECT + Supabase + Exact Dedup
- [ ] SAVE/REJECT가 Supabase에 반영
- [ ] 같은 permalink 재수집 시 중복 저장 안 됨
- [ ] `phase(scout-b): supabase + save/reject + exact dedup` 커밋

## Scout C — AI 분류 + Novelty
- [ ] quality/novelty/similarity 개별 저장
- [ ] Diagnostic 3축 enum(+OTHER+otherLabel) 준수
- [ ] 향후 `saved_references.core_appeal`/`viral_engine` 컬럼 사용 가능(Review와 개념 재사용)
- [ ] `phase(scout-c): ai classification + novelty` 커밋

## Scout D — Semantic Clustering + Diversity Quota + Explore 슬롯
- [ ] 같은 cluster 후보 수가 상한 이하
- [ ] Family/Hook/화자/공개방식 각 상한 준수
- [ ] Explore 슬롯에 낮은 quality + 높은 novelty 후보 포함
- [ ] 임계값·비율 설정값 (하드코딩 없음)
- [ ] `phase(scout-d): clustering + diversity + explore` 커밋

## Scout E — Query Candidate + NEW_PATTERN_CANDIDATE + Query Performance
- [ ] AI 제안 Query 자동 ACTIVE 안 됨 (`CANDIDATE`만)
- [ ] 사용자 승인 UI로 `ACTIVE`/`REJECTED` 전환
- [ ] 새 Hook Code 자동 확정 없음 (사용자 승인 필요)
- [ ] Query별 실행/후보/SAVE 개수 조회 가능
- [ ] `phase(scout-e): query candidate + new pattern + performance` 커밋

## Scout F — Optional Public Engagement Verification
- [ ] 조회수 확인 못한 후보 삭제 안 됨 (`views: null, viewSource: "UNAVAILABLE"`)
- [ ] 로그인/CAPTCHA/Rate Limit/접근 제한 우회 시도 없음(코드 리뷰)
- [ ] 이 모듈 강제 OFF에서도 Scout A~E 전부 정상
- [ ] `phase(scout-f): optional engagement verification` 커밋

## Scout G — Cron 자동 수집
- [ ] Scout A~F가 최소 2주 이상 안정 수동 운영 후에만
- [ ] 자동 수집 실패가 조용히 사라지지 않음 (관리자 로그)
- [ ] Cron 중단/재개 관리자 UI 하나
- [ ] `phase(scout-g): cron auto-collect` 커밋
