# ACCEPTANCE_TESTS.md — Phase별 수용 테스트

각 Phase의 모든 항목을 **수동으로** 사용자가 눈으로 확인해서 통과해야 그 Phase를 "완료"로 본다.
Phase 완료 후에는 반드시:
1. `phase(N): ...` 커밋
2. 사용자에게 결과 스크린샷·설명 보고
3. 사용자의 명시적 "다음 Phase 진행" 승인 대기

승인 없이 다음 Phase 코드에 손대지 않는다.

> 용어: "수용 테스트(Acceptance Test)" = 개발자가 아니라 사용자 관점에서 "이거면 됐다"고 인정할 조건 목록.

---

## Phase 0 — 문서 설계

**산출물:** `CLAUDE.md`, `docs/SPEC.md`, `docs/DATA_CONTRACT.md`, `docs/ACCEPTANCE_TESTS.md`, `docs/DECISIONS.md`, `docs/HOOK_CODES.md`

**통과 기준:**
- [x] 6개 문서가 저장소에 존재
- [x] 사용자가 읽고 "이 방향으로 만들자" 승인
- [x] `phase(0): design docs` 커밋 완료 후 push

---

## Phase 1 — 프로젝트 초기화 + 배포 파이프라인 검증

**목표:** 아무 로직 없이도 "코드 → GitHub → Vercel → 브라우저 확인"까지 흐름을 먼저 확인.
이 단계에는 아직 Claude API endpoint가 없으므로 **인증 없음**.

**산출물:**
- Next.js(App Router) + TypeScript + Tailwind 프로젝트
- `/review` 페이지 — "Viral Lab · Review (Phase 1 OK)" 문구만 표시
- `.env.local.example`에 자리만 만들어 두기 (값 없음):
  ```
  ANTHROPIC_API_KEY=
  ANTHROPIC_MODEL=
  REVIEW_SHARED_PASSWORD=
  ```
- Vercel에 배포 성공 + 위 3개 환경변수 자리를 Vercel 대시보드에도 등록(값은 Phase 3 시작 시 채움)

**통과 기준:**
- [ ] 로컬 `pnpm dev`로 `/review` 페이지가 뜨고 문구가 보인다
- [ ] 저장소 어디에도 `NEXT_PUBLIC_ANTHROPIC_...`, `NEXT_PUBLIC_REVIEW_...` 같은 잘못된 이름이 없다 (grep 확인)
- [ ] 저장소 어디에도 모델 ID(예: `claude-sonnet-4-5`) 문자열이 하드코딩되어 있지 않다 (grep 확인)
- [ ] Vercel 배포 URL에서도 같은 페이지가 뜬다
- [ ] `phase(1): scaffold + first deploy` 커밋

---

## Phase 2 — Excel 업로드 + Header 자동 감지 (AI 호출 없음)

**목표:** 파싱 신뢰성 먼저 확보. Claude 호출은 아직 없음 → 인증도 아직 없음.

**산출물:**
- `/review`에 파일 업로드 컴포넌트
- SheetJS로 브라우저에서 파싱
- Header 자동 감지 로직 (`DATA_CONTRACT.md §1.2`)
  - trim 수행
  - 필수 3종 + 별칭 매칭
- 감지된 Header 행 번호를 화면에 표시
- 감지된 선택 컬럼 목록(있음/없음) 표시
- 데이터 행 개수, 첫 3행 미리보기 표

**통과 기준:**
- [ ] 실제 사용자 Excel 파일을 업로드하면 Header 행이 정확히 감지된다
- [ ] 앞쪽에 빈 행/안내문이 있어도 감지된다
- [ ] 셀 앞뒤에 공백이 있어도 감지된다 (trim)
- [ ] `/제목` 대신 `레퍼런스 링크`가 쓰인 파일도 감지된다
- [ ] `리뷰내용` 대신 `작성안` 또는 `작성한 글`이 쓰인 파일도 감지된다
- [ ] `이미지 파일명`이 없는 파일도 정상 파싱된다 (필드는 null)
- [ ] `레퍼런스 원문`이 없는 파일도 정상 파싱된다
- [ ] 필수 3종 중 하나라도 빠지면 명확한 에러
- [ ] `리뷰내용`이 비어 있는 행은 데이터 개수에서 빠진다
- [ ] 네트워크 탭에 파일 자체가 서버로 전송되지 않음
- [ ] `phase(2): excel parsing + header autodetect` 커밋

---

## Phase 3 — 단일 행 Claude 분석 + Zod 검증 + shared-password 인증

**목표:** 1행만 정확히 분석. 이 Phase부터 Claude endpoint가 공개되므로 **shared-password 인증 도입**.

**산출물:**
- `/api/review/analyze-row` route
- `lib/schema/rowAnalysis.ts` — Zod 스키마 (등급 `A|B|FAIL`, diagnostic enum + OTHER+otherLabel refinement)
- `lib/review/prompts/analyzeRow.v1.ts` — 프롬프트 상수 (Hook Code 정의는 `docs/HOOK_CODES.md` 텍스트 임베드)
- **모델 사용:** `process.env.ANTHROPIC_MODEL`을 읽어 사용. 코드에 모델 ID 하드코딩 금지.
- **shared-password 인증:**
  - `/login` 페이지 (비밀번호 1칸)
  - 서버 route: 입력값과 `REVIEW_SHARED_PASSWORD`(env) 비교 → 성공 시 HttpOnly 세션 쿠키(30일)
  - `/review`와 `/api/review/*`는 세션 없으면 `/login`으로 리다이렉트 또는 401
- 미리보기 표의 첫 행에 "이 행 분석" 버튼

**통과 기준:**
- [ ] `/login`에서 잘못된 비밀번호는 거부, 올바른 비밀번호는 통과
- [ ] 로그인 없이 `/review` 접근 시 `/login`으로 리다이렉트
- [ ] 로그인 없이 `/api/review/analyze-row` 호출 시 401
- [ ] 로그인 후 "이 행 분석" 클릭 → 결과 JSON이 화면에 예쁘게 표시
- [ ] 결과가 `DATA_CONTRACT.md §2.2` 스키마와 100% 일치
- [ ] `core.grade`가 `A|B|FAIL` 중 하나 (다른 값은 스키마 오류)
- [ ] `core.passedCount`가 gates의 true 개수와 일치 (서버 재계산 확인)
- [ ] diagnostic 3축이 각 enum 또는 OTHER 중 하나
- [ ] OTHER를 반환했을 때 `otherLabel`이 비어 있지 않은 문자열
- [ ] OTHER가 아닐 때 `otherLabel`이 `null`
- [ ] Zod 검증 실패 유도(프롬프트 임시 훼손) 시 최대 2회 재시도 후 에러 UI
- [ ] `refOriginal`이 null인 행에서 `similarityToReference.applicable`이 false
- [ ] DevTools에서 API 키가 응답·요청 어디에도 노출되지 않음
- [ ] `meta.model`이 `ANTHROPIC_MODEL` env 값과 일치
- [ ] 저장소 grep 결과, 모델 ID 하드코딩 없음
- [ ] `phase(3): single-row analyzer + shared-password auth` 커밋

---

## Phase 4 — 배치 분석 + 진행률 + localStorage row-level 캐시

**산출물:**
- "전체 분석" 버튼
- 시작 전 확인 다이얼로그: "총 N건, 캐시 히트 K건. 실제 Claude 호출 (N-K)건. 계속?"
- 동시성 3으로 순차 배치 처리
- 진행률 바 + `47 / 120` + `캐시 히트 12`
- 실패한 행 목록 + 각 행 재시도 버튼
- 각 행별 "강제 재분석" 버튼 + 상단 "전체 강제 재분석" 버튼
- 상단 "캐시 비우기" 버튼
- **localStorage row-level 캐시** 구현 (`DATA_CONTRACT.md §5`)
  - 키: SHA-256(draft + ␞ + (refOriginal ?? "") + ␞ + promptVersion)
  - 프리픽스: `viral-lab:review:v1:`
- 결과 표: 원본 컬럼 + 등급/게이트/진단 컬럼

**통과 기준:**
- [ ] 20행 이상 파일에서 전 행 결과가 표에 채워진다
- [ ] 하나 이상 실패해도 나머지는 완주
- [ ] 재시도 버튼이 실패한 행만 다시 처리
- [ ] 분석 후 새로고침하고 같은 파일을 다시 업로드하면 **Claude 호출 없이** 결과가 즉시 복구됨 (네트워크 탭 확인)
- [ ] draft 한 글자만 바꾼 행은 캐시 미스로 새 호출
- [ ] `ANTHROPIC_MODEL`을 바꿔도 그 자체로는 캐시 무효화가 되지 않지만, promptVersion을 올리면 무효화됨 (의도된 동작 확인)
- [ ] "이 행 강제 재분석" 시 캐시 무시하고 새 호출 후 캐시 갱신
- [ ] "캐시 비우기" 후 다시 분석 시 모든 행이 새 호출
- [ ] localStorage 값 크기가 4MB에 근접하면 오래된 엔트리부터 제거됨
- [ ] `phase(4): batch analyzer + localStorage cache` 커밋

---

## Phase 5 — Portfolio Analysis

**산출물:**
- `/api/review/portfolio` route
- 집계·경고는 서버 코드가 결정적으로 계산 (등급은 `A|B|FAIL`)
- `recommendation.text`만 Claude가 생성
- 화면 상단 Portfolio 카드 (막대차트는 Tailwind div bar — D-003)
- Hook Code A~M 13개 막대
- 감정/화자/공개방식은 enum 값 + OTHER를 별도 표시

**통과 기준:**
- [ ] 배치 분석 완료 후 Portfolio 카드가 자동 표시
- [ ] 카테고리 개수 합이 총 행 수와 일치
- [ ] 등급 분포에 C·D가 절대 나타나지 않음 (`A`, `B`, `FAIL`만)
- [ ] 특정 카테고리 비율이 임계치(40%) 초과 시 경고 표시
- [ ] AI 추천 문단이 스키마 검증 통과
- [ ] `phase(5): portfolio analysis` 커밋

---

## Phase 6 — ANALYZED Excel 다운로드

**산출물:**
- "결과 다운로드" 버튼
- SheetJS로 새 xlsx 생성 (`DATA_CONTRACT.md §4`)
- 파일명 규칙 준수

**통과 기준:**
- [ ] 다운로드 파일에 시트 3개(원본/`Analysis`/`Portfolio`)
- [ ] 원본 시트가 원본과 셀 단위 일치
- [ ] `Analysis` 시트에 등급(`A|B|FAIL`), Gates, Diagnostic(enum + `_기타라벨`), 리스트 필드가 모두 채워져 있다
- [ ] `Portfolio` 시트가 UI와 같은 숫자
- [ ] 원본 파일은 저장소·서버·클라이언트 스토리지 어디에도 남지 않는다
- [ ] `phase(6): analyzed export` 커밋

---

## Phase 7 — Review 최종 UX 다듬기 + 실사용 검증

**산출물:**
- 실제 사용자 파일 전체(대용량 포함)로 최소 3회 왕복 테스트
- 로딩 상태, 에러 카피, 빈 상태 처리
- 반응형 최소 지원 (데스크톱 우선)

**통과 기준:**
- [ ] 사용자가 "이제 실제 업무에 쓸 수 있다" 판단
- [ ] `phase(7): review UX polish + real-file validation` 커밋
- [ ] 이 시점에서 사용자에게 **"Scout Phase 착수 여부"를 명시적으로 확인**

---

## Phase 8+ — Scout (별도 설계 후 진행)

Phase 7 완료 승인 후에만 시작. 여기서는 Phase 목록만 대략:

- Phase 8 — Threads API 연동 검증 (수동 트리거, 화면 표시만, 저장 없음)
- Phase 9 — Supabase 프로젝트 + `scout_items` 테이블 + 저장/중복제거
- Phase 10 — 검색 UI + 수동 "수집 실행" 버튼
- Phase 11 — 원문 수동 붙여넣기 fallback + 메모/태그
- Phase 12 — Review로 밀어넣기(선택)
- Phase 13 — Vercel Cron 자동화 (마지막)

세부 수용 테스트는 Phase 7 종료 시점에 추가.
