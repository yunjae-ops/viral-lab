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

**산출물:** `CLAUDE.md`, `docs/SPEC.md`, `docs/DATA_CONTRACT.md`, `docs/ACCEPTANCE_TESTS.md`, `docs/DECISIONS.md`

**통과 기준:**
- [ ] 5개 문서가 저장소에 존재
- [ ] 사용자가 읽고 "이 방향으로 만들자" 승인
- [ ] `phase(0): design docs` 커밋 완료 후 push

---

## Phase 1 — 프로젝트 초기화 + 배포 파이프라인 검증

**목표:** 아무 로직 없이도 "코드 → GitHub → Vercel → 브라우저 확인"까지 흐름을 먼저 확인.

**산출물:**
- Next.js(App Router) + TypeScript + Tailwind 프로젝트
- `/review` 페이지 — "Viral Lab · Review (Phase 1 OK)" 문구만 표시
- `.env.local.example`에 `ANTHROPIC_API_KEY=` 자리만 만들어 두기(값 없음)
- Vercel에 배포 성공 + `ANTHROPIC_API_KEY` 환경변수를 Vercel 대시보드에 등록 (코드에는 아직 안 씀)

**통과 기준:**
- [ ] 로컬 `pnpm dev`로 `/review` 페이지가 뜨고 문구가 보인다
- [ ] `NEXT_PUBLIC_ANTHROPIC_API_KEY` 같은 잘못된 이름이 저장소 어디에도 없다 (grep 확인)
- [ ] Vercel 배포 URL에서도 같은 페이지가 뜬다
- [ ] `phase(1): scaffold + first deploy` 커밋

---

## Phase 2 — Excel 업로드 + Header 자동 감지 (AI 호출 없음)

**목표:** 파싱 신뢰성 먼저 확보. Claude 호출은 아직 안 함.

**산출물:**
- `/review` 페이지에 파일 업로드 컴포넌트
- SheetJS로 브라우저에서 파싱
- Header 자동 감지 로직 (`docs/DATA_CONTRACT.md` §1.3)
- 감지된 Header 행 번호를 화면에 표시
- 데이터 행 개수, 첫 3행 미리보기 표

**통과 기준:**
- [ ] 실제 사용자 Excel 파일을 업로드하면 Header 행이 정확히 감지된다
- [ ] 앞쪽에 빈 행/안내문이 있어도 감지된다
- [ ] 필수 Header가 빠진 파일을 넣으면 명확한 에러가 뜬다
- [ ] `리뷰내용`이 비어 있는 행은 데이터 개수에서 빠진다
- [ ] 파일 업로드 과정에서 네트워크 탭에 파일 자체가 서버로 전송되지 않는다 (파싱은 순수 브라우저)
- [ ] `phase(2): excel parsing + header autodetect` 커밋

---

## Phase 3 — 단일 행 Claude 분석 + Zod 검증

**목표:** 1행만 정확히 분석되게 만든다. 배치 처리는 다음 Phase.

**산출물:**
- `/api/review/analyze-row` route
- `lib/schema/rowAnalysis.ts` — Zod 스키마
- `lib/review/prompts/analyzeRow.v1.ts` — 프롬프트 상수
- 미리보기 표의 첫 행에 "이 행 분석" 버튼

**통과 기준:**
- [ ] 버튼 클릭 → 몇 초 후 결과 JSON이 화면에 예쁘게 표시됨
- [ ] 결과가 `DATA_CONTRACT.md §2.2` 스키마와 100% 일치
- [ ] Zod 검증 실패를 일부러 유도(프롬프트 임시 훼손)했을 때 최대 2회 재시도 후 에러 UI가 뜬다
- [ ] `core.passedCount`가 gates의 true 개수와 일치 (서버 재계산 확인)
- [ ] `refOriginal`이 null인 행에서는 `similarityToReference.applicable`이 false
- [ ] 브라우저 DevTools에서 API 키가 응답·요청 어디에도 노출되지 않음
- [ ] `phase(3): single-row analyzer` 커밋

---

## Phase 4 — 배치 분석 + 진행률

**산출물:**
- "전체 분석" 버튼
- 시작 전 확인 다이얼로그: "총 N건, Claude 호출 최대 N건. 예상 소요 ~M분. 계속?"
- 동시성 3으로 순차 배치 처리
- 진행률 바 + `47 / 120` 텍스트
- 실패한 행 목록 + 각 행 재시도 버튼
- 결과 표: 원본 컬럼 + 등급/게이트/진단 컬럼

**통과 기준:**
- [ ] 20행 이상 파일에서 전 행 결과가 표에 채워진다
- [ ] 중간에 브라우저 새로고침해도 이미 분석 완료한 행의 결과는 잃지 않는다 (localStorage 등에 임시 저장) — *만약 구현 복잡하면 D-006 참조, 다음 버전으로 미룰 수 있음*
- [ ] 하나 이상 실패해도 나머지는 완주
- [ ] 재시도 버튼이 실패한 행만 다시 처리
- [ ] `phase(4): batch analyzer` 커밋

---

## Phase 5 — Portfolio Analysis

**산출물:**
- `/api/review/portfolio` route
- 집계·경고는 서버 코드가 결정적으로 계산
- `recommendation.text`만 Claude가 생성
- 화면 상단 Portfolio 카드 (막대차트는 기초적인 CSS 막대로 충분, Chart 라이브러리 도입 금지 — D-003)

**통과 기준:**
- [ ] 배치 분석 완료 후 Portfolio 카드가 자동 표시된다
- [ ] 카테고리 개수 합이 총 행 수와 일치
- [ ] 특정 카테고리 비율이 임계치(초기 40%) 초과 시 경고가 표시된다
- [ ] AI 추천 문단이 표시된다 (스키마 검증 통과)
- [ ] `phase(5): portfolio analysis` 커밋

---

## Phase 6 — ANALYZED Excel 다운로드

**산출물:**
- "결과 다운로드" 버튼
- SheetJS로 새 xlsx 생성 (`DATA_CONTRACT.md §4`)
- 파일명 규칙 준수

**통과 기준:**
- [ ] 다운로드된 파일에 시트 3개(원본/`Analysis`/`Portfolio`)가 있다
- [ ] 원본 시트는 셀 값이 원본과 정확히 동일 (한 글자도 변형 없음)
- [ ] Analysis 시트에 추가 컬럼이 모두 채워져 있다
- [ ] Portfolio 시트가 UI와 같은 숫자를 보여준다
- [ ] 원본 파일 자체는 저장소·서버·클라이언트 스토리지 어디에도 남지 않는다 (업로드 즉시 메모리에서만 처리)
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

- Phase 8 — Threads API 연동 검증 (수동 트리거, 결과를 화면에만 표시, 저장 없음)
- Phase 9 — Supabase 프로젝트 생성 + `scout_items` 테이블 + 저장/중복제거
- Phase 10 — 검색 UI + 수동 "수집 실행" 버튼
- Phase 11 — 원문 수동 붙여넣기 fallback + 메모/태그
- Phase 12 — Review로 밀어넣기(선택)
- Phase 13 — Vercel Cron 자동화 (마지막)

각 Phase의 세부 수용 테스트는 Phase 7 종료 시점에 추가한다.
