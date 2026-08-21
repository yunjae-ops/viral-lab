# ACCEPTANCE_TESTS.md — Phase별 수용 테스트

각 Phase의 모든 항목을 **수동으로** 사용자가 눈으로 확인해서 통과해야 그 Phase를 "완료"로 본다.
Phase 완료 후:
1. `phase(N): ...` 커밋
2. 사용자에게 결과 스크린샷·설명 보고
3. 사용자의 명시적 "다음 Phase 진행" 승인 대기

승인 없이 다음 Phase 코드에 손대지 않는다.

> "수용 테스트(Acceptance Test)" = 개발자가 아니라 사용자 관점에서 "이거면 됐다"고 인정할 조건 목록.

---

# Review Phase (선행)

## Phase 0 — 문서 설계

**산출물:** `CLAUDE.md`, `docs/SPEC.md`, `docs/DATA_CONTRACT.md`, `docs/ACCEPTANCE_TESTS.md`, `docs/DECISIONS.md`, `docs/HOOK_CODES.md`, `docs/SCOUT_DESIGN.md`

**통과 기준:**
- [x] 7개 문서가 저장소에 존재
- [x] 사용자가 읽고 방향 승인
- [x] `phase(0): design docs` 커밋

---

## Phase 1 — 프로젝트 초기화 + Excel 파싱 (AI 없음)

**목표:** 로컬에서 파일 흐름이 완결되는 것 확인. AI 호출 없음 → 인증 없음.

**산출물:**
- Next.js(App Router) + TypeScript + Tailwind 프로젝트
- `/review` 페이지
  - 파일 업로드 컴포넌트
  - SheetJS로 브라우저에서 파싱
  - Header 자동 감지 (`DATA_CONTRACT.md §1.2`)
    - trim 수행
    - 필수 3종 + 별칭 매칭
  - 감지된 Header 행 번호 표시
  - 감지된 선택 컬럼 목록(있음/없음) 표시
  - 데이터 행 개수 + 첫 3행 미리보기 표
- `.env.local.example`에 자리만 만들어 두기(값 없음):
  ```
  ANTHROPIC_API_KEY=
  ANTHROPIC_MODEL=
  REVIEW_SHARED_PASSWORD=
  ```

**통과 기준:**
- [ ] `pnpm dev`로 `/review` 페이지 정상 로드
- [ ] 실제 사용자 Excel 파일에서 Header 행 정확히 감지
- [ ] 앞쪽에 빈 행/안내문이 있어도 감지됨
- [ ] 셀 앞뒤 공백이 있어도 감지됨 (trim)
- [ ] `/제목` 대신 `레퍼런스 링크` 파일 감지됨
- [ ] `리뷰내용` 대신 `작성안` 또는 `작성한 글` 파일 감지됨
- [ ] `이미지 파일명`이 없는 파일도 정상 파싱 (필드는 null)
- [ ] `레퍼런스 원문`이 없는 파일도 정상 파싱
- [ ] 필수 3종 중 하나라도 빠지면 명확한 에러
- [ ] `리뷰내용`이 빈 행은 데이터 개수에서 제외
- [ ] 네트워크 탭에 파일 자체가 서버로 전송되지 않음
- [ ] 저장소 grep: `NEXT_PUBLIC_ANTHROPIC_...`·`NEXT_PUBLIC_REVIEW_...` 없음
- [ ] 저장소 grep: 모델 ID 하드코딩(`claude-*`) 없음
- [ ] `phase(1): scaffold + excel parsing + header autodetect` 커밋

---

## Phase 2 — 한 행 AI 분석 + Zod 검증

**목표:** 1행만 정확히 분석. Claude endpoint 등장 → 로컬 개발 전제.

**산출물:**
- `/api/review/analyze-row` route
- `lib/schema/rowAnalysis.ts` — Zod 스키마 (`grade: A|B|FAIL`, `hookCode`에 `NEW_PATTERN_CANDIDATE` 포함, `newPatternCandidate` refinement, diagnostic enum + OTHER refinement)
- `lib/review/prompts/analyzeRow.v1.ts` — 프롬프트 상수 (Hook Code 정의는 `docs/HOOK_CODES.md` 텍스트 임베드; Gate 2는 예시 단어 존재가 아니라 **의미상 전환** 판단이라고 명시)
- **모델 사용:** `process.env.ANTHROPIC_MODEL` 필수 (없으면 서버 시작 에러)
- 미리보기 표의 첫 행에 "이 행 분석" 버튼

**통과 기준:**
- [ ] 버튼 클릭 → 결과 JSON이 화면에 예쁘게 표시
- [ ] 결과가 `DATA_CONTRACT.md §2.2` 스키마와 100% 일치
- [ ] `core.grade` ∈ `A|B|FAIL` (다른 값 스키마 오류)
- [ ] `core.passedCount`가 gates true 개수와 일치 (서버 재계산 확인)
- [ ] `hookCode`가 `A~M` 또는 `NEW_PATTERN_CANDIDATE` 중 하나
- [ ] `hookCode === "NEW_PATTERN_CANDIDATE"`일 때 `newPatternCandidate` 4필드 존재, 아니면 `null`
- [ ] diagnostic 3축이 각 enum 또는 OTHER 중 하나
- [ ] OTHER 반환 시 `otherLabel`이 비어 있지 않은 문자열
- [ ] 비-OTHER 반환 시 `otherLabel === null`
- [ ] `refOriginal`이 null인 행에서 `referenceCloneRisk.applicable === false`
- [ ] `salesRatioPercent` 같은 임의 백분율 필드가 응답에 존재하지 않음(구조화 필드로 대체됐음을 확인)
- [ ] Zod 실패 유도(프롬프트 임시 훼손) 시 최대 2회 재시도 후 에러 UI, 다른 행에 영향 없음
- [ ] DevTools에서 API 키 요청·응답 어디에도 노출 없음
- [ ] `meta.model`이 `ANTHROPIC_MODEL` env 값과 일치
- [ ] 저장소 grep: 모델 ID 하드코딩 없음
- [ ] `phase(2): single-row analyzer + zod` 커밋

---

## Phase 3 — 전체 배치 분석 + localStorage row-level cache

**목표:** 실제 배치 처리 안정화 + 재분석 비용 최소화.

**산출물:**
- "전체 분석" 버튼
- 시작 전 확인 다이얼로그: `"총 N건, 캐시 히트 K건, 실제 Claude 호출 (N-K)건. 계속?"`
- 동시성 3 배치
- 진행률 바 + `47 / 120` + `캐시 히트 12`
- 실패 행 목록 + 각 행 재시도 버튼
- "이 행 강제 재분석", "전체 강제 재분석", "캐시 비우기" 버튼
- localStorage row-level 캐시 (`DATA_CONTRACT.md §5`)
  - 키: SHA-256(draft + ␞ + (refOriginal ?? "") + ␞ + promptVersion)
  - 프리픽스: `viral-lab:review:v1:`
- 결과 표: 원본 컬럼 + 등급/게이트/진단 컬럼

**통과 기준:**
- [ ] 20행 이상 파일에서 전 행 결과 채워짐
- [ ] 하나 이상 실패해도 나머지 완주
- [ ] 재시도 버튼이 실패 행만 다시 처리
- [ ] 분석 후 새로고침 + 같은 파일 재업로드 → **Claude 호출 없이** 결과 즉시 복구 (네트워크 탭 확인)
- [ ] draft 한 글자만 바꾼 행은 캐시 미스로 새 호출
- [ ] promptVersion 상승 시 전 행 캐시 무효화 (의도된 동작)
- [ ] 빈 draft 행은 API 호출·캐시 항목 모두 만들지 않음
- [ ] "이 행 강제 재분석" 시 캐시 무시하고 새 호출 후 캐시 갱신
- [ ] "캐시 비우기" 후 다시 분석 시 전 행 새 호출
- [ ] localStorage 4MB 근접 시 오래된 엔트리부터 제거
- [ ] `phase(3): batch analyzer + localStorage cache` 커밋

---

## Phase 4 — Portfolio Analysis

**산출물:**
- `/api/review/portfolio` route
- 통계·경고는 서버 코드 결정적 계산
- `recommendation.text`·`suggestedAngles`만 Claude 호출 1회
- 화면 상단 Portfolio 카드 (막대차트는 Tailwind div bar — D-003)
- Hook 카운트 표시에 `NEW_PATTERN_CANDIDATE` 포함
- 감정/화자/공개방식 enum + `OTHER` 별도 표시

**통과 기준:**
- [ ] 배치 완료 후 Portfolio 카드 자동 표시
- [ ] 카테고리 개수 합이 총 행 수와 일치
- [ ] 등급 분포에 C·D가 절대 나타나지 않음 (`A`, `B`, `FAIL`만)
- [ ] 특정 카테고리 비율이 임계치(40%) 초과 시 경고 표시
- [ ] `NEW_PATTERN_CANDIDATE` 개수 표시됨
- [ ] AI 추천 문단이 스키마 검증 통과
- [ ] `phase(4): portfolio analysis` 커밋

---

## Phase 5 — ANALYZED Excel 다운로드

**산출물:**
- "결과 다운로드" 버튼
- SheetJS로 새 xlsx 생성 (`DATA_CONTRACT.md §4`)
- 파일명 규칙 준수

**통과 기준:**
- [ ] 다운로드 파일에 시트 3개(원본/`Analysis`/`Portfolio`)
- [ ] 원본 시트가 원본과 셀 단위 일치
- [ ] `Analysis` 시트에 등급(`A|B|FAIL`), Gates, Hook(NewPatternName 별도 컬럼), 감정/화자/공개방식(_기타라벨), 판매튐/유사도/건강주장/문제점/수정방향 모두 채워짐
- [ ] `Portfolio` 시트가 UI와 같은 숫자
- [ ] 원본 파일은 저장소·서버·클라이언트 스토리지 어디에도 남지 않음
- [ ] `phase(5): analyzed export` 커밋

---

## Phase 6 — Vercel 배포 + shared-password + 실제 업무 테스트

**목표:** 실 서비스 준비 완료. shared-password는 이 배포와 함께 반드시 도입.

**산출물:**
- `/login` 페이지 (비밀번호 1칸)
- 서버 route: 입력값과 `REVIEW_SHARED_PASSWORD` env 비교 → 성공 시 HttpOnly 세션 쿠키(30일)
- `/review` 및 `/api/review/*`: 세션 없으면 `/login` 리다이렉트 또는 401
- Vercel 프로젝트 연결 + env 3종(`ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `REVIEW_SHARED_PASSWORD`) 등록
- 실제 사용자 파일 전체(대용량 포함)로 왕복 테스트 최소 3회
- 로딩 상태·에러 카피·빈 상태 처리
- 반응형 최소 지원 (데스크톱 우선)

**통과 기준:**
- [ ] Vercel 배포 URL에서 `/login` → 비밀번호 통과 후 `/review` 정상 동작
- [ ] 잘못된 비밀번호는 거부
- [ ] 로그인 없이 `/review` 접근 시 `/login` 리다이렉트
- [ ] 로그인 없이 `/api/review/*` 호출 시 401
- [ ] 세션 쿠키가 HttpOnly + Secure
- [ ] 실제 파일 3회 왕복 성공, 결과 신뢰 가능
- [ ] 사용자가 "실제 업무에 쓸 수 있다" 판단
- [ ] `phase(6): vercel deploy + shared-password + real-use validation` 커밋
- [ ] 이 시점에서 사용자에게 **"Scout Phase 착수 여부"를 명시적으로 확인**

---

# Scout Phase (Review Phase 6 완료 + 명시 승인 후에만)

세부 설계는 `docs/SCOUT_DESIGN.md`. 여기서는 각 Phase의 산출물·통과 기준 요약.

## Scout A — Search Family + Seed Query 관리 + 수동 검색

**산출물:**
- `/scout` 페이지
- Family/Seed CRUD UI (하드코딩 없이 관리)
- Seed 상태: `ACTIVE | CANDIDATE | REJECTED | DISABLED`
- 검색 실행 UI (Family/Seed 선택, TOP/RECENT, 개수 상한)
- **저장 없음** — Threads API 결과를 화면에만 표시
- Threads API 실패 시 명확한 에러

**통과 기준:**
- [ ] 코드 변경 없이 Family/Seed 추가·수정·비활성화 가능
- [ ] 공식 Threads API 호출 성공, 결과 표시
- [ ] AI가 만들지 않은 값(view count 등)이 응답에 임의로 나타나지 않음
- [ ] `phase(scout-a): family + seed + manual search` 커밋

## Scout B — SAVE / REJECT + Supabase + Exact Dedup

**산출물:**
- Supabase 프로젝트 + `search_families`, `seed_queries`, `scout_candidates`, `saved_references`, `rejected_candidates`, `query_runs`, `pattern_candidates` 테이블 (`DATA_CONTRACT.md §6`)
- 후보 SAVE/REJECT UI
- Exact Dedup: `permalink` unique

**통과 기준:**
- [ ] SAVE/REJECT가 Supabase에 반영
- [ ] 같은 permalink 재수집 시 중복 저장 안 됨
- [ ] `phase(scout-b): supabase + save/reject + exact dedup` 커밋

## Scout C — AI 분류 + Novelty

**산출물:**
- 후보에 대한 AI 분류(Hook/감정/화자/공개방식) + 근거
- 기존 `saved_references` 대비 similarity/novelty 개별 저장 (단일 공식 없음)

**통과 기준:**
- [ ] 각 후보에 quality/novelty/similarity 값이 개별로 붙음
- [ ] Diagnostic 3축이 enum 규칙(+OTHER+otherLabel) 준수
- [ ] `phase(scout-c): ai classification + novelty` 커밋

## Scout D — Semantic Clustering + Diversity Quota + Explore 슬롯

**산출물:**
- Cluster 판정 (초기 최소 방식, Vector DB 없이 — `SCOUT_DESIGN §7`)
- Diversity Quota (Family/Hook/화자/공개방식/Cluster 상한, 설정값)
- Exploit ≈ 70–80% / Explore ≈ 20–30% 슬롯 분리

**통과 기준:**
- [ ] 같은 Cluster에서 추천되는 후보 수가 상한을 초과하지 않음
- [ ] 동일 Family/Hook/화자/공개방식 각각 상한 준수
- [ ] Explore 슬롯이 낮은 quality라도 높은 novelty면 추천됨
- [ ] 임계값·비율이 모두 설정값으로 관리됨 (코드 하드코딩 없음)
- [ ] `phase(scout-d): clustering + diversity + explore` 커밋

## Scout E — Query Candidate + NEW_PATTERN_CANDIDATE + Query Performance

**산출물:**
- SAVE 이벤트에서 AI가 검색어 후보 자동 제안 → `seed_queries.state = CANDIDATE`
- `NEW_PATTERN_CANDIDATE` 누적 → `pattern_candidates` 테이블
- Query Performance 뷰 (실행/후보/SAVE 수 집계)

**통과 기준:**
- [ ] AI 제안 Query가 자동으로 ACTIVE가 되지 않음 (`CANDIDATE`만)
- [ ] 사용자 승인 UI로 `ACTIVE`/`REJECTED` 전환 가능
- [ ] 새 Hook Code는 사용자 승인 없이 자동 확정되지 않음
- [ ] Query별 실행/후보/SAVE 개수가 UI에서 조회 가능
- [ ] `phase(scout-e): query candidate + new pattern + performance` 커밋

## Scout F — Optional Public Engagement Verification (조회수)

**산출물:**
- 상위 후보에 한해 공개 permalink 확인으로 조회수 조회 시도
- `views`, `viewSource` (`PUBLIC_UI | MANUAL | UNAVAILABLE`), `viewCheckedAt` 저장
- 최소 조회수 필터 (`제한 없음 | 1,000+ | 10,000+ | 100,000+`) 설정값
- 이 모듈 실패 시 Scout의 검색·분석·저장은 정상 동작

**통과 기준:**
- [ ] 조회수 확인 못한 후보가 삭제되지 않음 (`views: null, viewSource: "UNAVAILABLE"`)
- [ ] 로그인/CAPTCHA/Rate Limit/접근 제한 우회 시도 없음 (코드 리뷰로 확인)
- [ ] 이 모듈을 강제로 끈 상태에서도 Scout A~E 기능 전부 정상
- [ ] `phase(scout-f): optional engagement verification` 커밋

## Scout G — Cron 자동 수집

**산출물:**
- Vercel Cron 1개 (또는 최소 개수)
- 관리자용 실패 로그 페이지

**통과 기준:**
- [ ] Scout A~F가 최소 2주 이상 수동 운영으로 안정된 뒤에만 착수
- [ ] 자동 수집 실패가 조용히 사라지지 않음 (로그 페이지에 남음)
- [ ] Cron 중단/재개가 관리자 UI 하나로 가능
- [ ] `phase(scout-g): cron auto-collect` 커밋
