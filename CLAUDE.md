# CLAUDE.md — Viral Lab 프로젝트 운영 규칙

이 파일은 이 저장소에서 작업하는 Claude 세션이 매번 지켜야 하는 규칙이다.
프로젝트 소유자는 웹개발 초보자이며, "잘못된 구조로 시작해서 나중에 갈아엎는 것"을 반드시 피하고 싶어한다.
모든 결정과 코드는 이 문서를 최우선으로 따른다.

---

## 1. 프로젝트 한 줄 정의

Threads 바이럴 콘텐츠 업무를 위한 내부 웹도구.
하나의 Next.js 프로젝트 안에 두 기능이 있다.

- **`/review`** — 내가 Excel에 수동 작성한 Threads 콘텐츠를 업로드하면 내 바이럴 원칙에 얼마나 부합하는지 AI가 분석.
- **`/scout`** — Threads에서 새 바이럴 레퍼런스를 지속적으로 발굴. **"내가 아직 확보하지 않은 새로운 콘텐츠 구조"를 계속 발견**하는 것이 핵심 목적. 단순히 비슷한 글을 많이 모으는 프로그램이 아니다.

**개발 순서는 고정이다: `/review` 완성 → 실제 업무 검증 → `/scout` 개발.**
Scout 관련 코드/의존성/폴더는 Review 실사용 검증(Review Phase 6)이 끝날 때까지 저장소에 넣지 않는다.

---

## 2. 절대 어기지 말 것 (Hard Rules)

1. **API Key는 서버 전용.** `NEXT_PUBLIC_` 접두어 금지. Claude 호출은 반드시 Next.js API Route(서버)에서만.
   > 용어: `NEXT_PUBLIC_...`는 브라우저 번들에 실려 유출되는 환경변수.

2. **Claude 모델 ID를 코드에 하드코딩하지 않는다.** `process.env.ANTHROPIC_MODEL`로만 읽는다. env가 비면 서버 시작 시 에러. 응답 `meta.model`은 실제 사용된 값을 실어 감사에 대비.

3. **원본 Excel 파일은 절대 덮어쓰지 않는다.** 결과는 항상 `..._ANALYZED_YYYYMMDD_HHmm.xlsx` 새 파일.

4. **Excel 파싱은 브라우저에서 한다.** 서버 API에는 분석에 필요한 텍스트만 JSON으로 보낸다.

5. **AI 응답은 정해진 JSON schema로만.** Zod 검증. 실패 시 최대 2회 재시도, 그래도 실패면 해당 행만 실패 표시(전체 분석은 계속).

6. **AI는 grade/passedCount를 임의로 확정하지 않는다.** 각 Gate의 boolean만 반환하고, `passedCount`와 `grade`는 서버 코드가 재계산해 덮어쓴다.

7. **Excel Header 자동 감지.**
   - 첫 20행 탐색, 셀 문자열은 `trim` 후 비교.
   - **필수 3종:** `순서`, `/제목`, `리뷰내용`.
   - **별칭:** `/제목` = `레퍼런스 링크` · `리뷰내용` = `작성안` = `작성한 글`.
   - **선택 2종:** `이미지 파일명`, `레퍼런스 원문` — 없어도 분석 정상 동작.
   - `레퍼런스 원문`이 있으면 레퍼런스 vs 작성안 구조 비교, 없으면 작성안 단독 분석.

8. **Core Grade 등급은 `A | B | FAIL` 3종만.** C·D 없음.
   - passedCount 4 → `A`, 3 → `B`, 0–2 → `FAIL`.
   - Gate 2(발견/전환)는 예시 단어(`근데`, `그런데`, `알고 보니`, `웃긴 건`, `실제로 해보니` 등)의 **존재 여부**가 아니라 **의미상 전환**을 판단한다.
   - Core Grade와 Diagnostic은 UI에서 반드시 분리 표시.

9. **Diagnostic은 처음부터 enum + OTHER + otherLabel.**
   - Hook: `A~M | NEW_PATTERN_CANDIDATE` (OTHER 없음. 자세한 정의는 `docs/HOOK_CODES.md`.)
   - 감정태도: `절박함 | 시크함 | 순수감탄 | 놀람 | OTHER`
   - 화자: `본인 1인칭 | 딸-엄마 관찰 | 친구-친구 관찰 | 순수 목격자 | OTHER`
   - 정보공개방식: `직접서술 | 리스트 | 대화체 | 선언문 | OTHER`
   - OTHER면 `otherLabel` 필수, 아니면 `null`. Zod refinement로 강제.
   - **A~M은 지금까지 발견된 분류일 뿐**이며 세상의 모든 콘텐츠가 A~M에 속한다고 가정하지 않는다. 새 코드 확정은 사용자 승인 필요.

10. **Phase 단위 개발.** 완료 시 `phase(N): ...` 커밋 1개. 다음 Phase 자동 진행 금지. 사용자 명시 승인 대기.

11. **Scout는 Review 실사용 검증(Review Phase 6) 완료 전에는 손대지 않는다.** `app/scout/`, `lib/scout/`, `lib/supabase/`, `@supabase/*` 모두 존재 금지.

12. **Portfolio·Scout 파이프라인의 통계는 코드가 계산.** AI는 데이터를 받아 "다음 방향 추천" 같은 해석/추천만 담당. AI가 근거 없는 점수를 만들지 않는다.

13. **캐시.**
    - Supabase·IndexedDB는 Review Phase에서 사용하지 않는다.
    - **localStorage row-level 캐시** (Review Phase 3부터).
    - 캐시 키: `SHA-256(draft + ␞ + (refOriginal ?? "") + ␞ + promptVersion)`.
    - 동일 입력은 사용자 강제 재분석이 아니면 Claude를 재호출하지 않는다.
    - 빈 Excel 행은 API 호출도, 캐시 항목도 만들지 않는다.
    - 전체 재분석 시작 전 예상 분석 개수·캐시 히트를 사용자에게 표시.
    - 향후 서버 DB 저장으로 확장 가능한 구조 유지.

14. **인증.**
    - Claude API endpoint가 Vercel에 공개된 순간부터 **shared-password 필수.**
    - `REVIEW_SHARED_PASSWORD` env와 비교, 성공 시 HttpOnly 세션 쿠키(30일).
    - Google OAuth 등 복잡 인증은 MVP에서 도입하지 않는다.
    - Review Phase 1~5까지 로컬 개발 단계에서는 인증 없어도 되지만, 그 코드를 Vercel에 배포하는 즉시 이미 auth를 적용한 상태여야 한다.

15. **Scout 수집.**
    - 공식 Threads API keyword search를 우선. 임의 URL 크롤링을 핵심 의존성으로 만들지 않는다.
    - 공식 API가 주지 않는 값(예: 타인의 view count)을 AI가 만들어내지 않는다. 없으면 `null`.
    - **자동 수집(cron)은 마지막(Scout Phase G)에만.**

16. **Optional Engagement Verification (조회수 확인) 안전 규칙 — 절대 준수.**
    - **로그인 우회 금지, CAPTCHA 우회 금지, Rate Limit 우회 금지, 접근 제한 우회 금지.**
    - 공개 상태에서 로그인 없이 확인 가능한 데이터만 사용.
    - 조회수를 확인할 수 없으면 후보를 삭제하지 말고 `views: null, viewSource: "UNAVAILABLE"`로 저장.
    - 이 모듈이 고장나도 Scout의 검색·분석·저장은 정상 동작해야 한다.

17. **비용 폭주 방지.** 배치는 동시성 3. 사용자에게 예상 호출 건수(캐시 히트 반영)를 먼저 보여주고 확인.

18. **오버엔지니어링 금지 (MVP 원칙).** 다음은 MVP에서 만들지 않는다:
    - 복잡한 Vector DB / 대규모 Queue / Microservice
    - OAuth / 자동 ML 추천 시스템
    - 무리한 크롤링 / 브라우저 자동화의 우회적 사용
    - 초기부터 복잡한 단일 추천 공식 (Scout는 quality/novelty/similarity 등을 개별 저장; 추천식은 데이터가 쌓인 뒤 조정)
    - 불필요한 상태관리 라이브러리

---

## 3. 기술 스택 (확정)

- Next.js (App Router) + TypeScript
- Tailwind CSS
- SheetJS (`xlsx`) — 브라우저에서 Excel 읽기/쓰기
- Zod — 응답·입력 검증
- Anthropic SDK (`@anthropic-ai/sdk`) — 서버에서만
- Git + GitHub + Vercel
- **Scout Phase에서만 추가:** Supabase (Postgres 관리형)
- **Threads 수집:** 공식 Threads API 우선
- **Optional view verification 후보 도구 (Scout Phase F 검토):** Playwright 등. 안전 규칙 §2-16 준수 전제.

새 라이브러리 도입 전 반드시 이유·대안을 설명하고 승인받는다.

---

## 4. 폴더 구조 (초기 목표)

```
viral-lab/
  app/
    login/                         # shared-password (Vercel 배포 시점부터)
    review/
      page.tsx
      components/
    api/
      auth/login/route.ts
      review/
        analyze-row/route.ts
        portfolio/route.ts
  lib/
    excel/                         # header 감지, 파싱, ANALYZED 생성
    review/
      prompts/                     # 프롬프트 상수
      cache/                       # localStorage row-level cache
    schema/                        # Zod schema
    auth/                          # shared-password 세션 유틸
  docs/
    SPEC.md
    DATA_CONTRACT.md
    ACCEPTANCE_TESTS.md
    DECISIONS.md
    HOOK_CODES.md
    SCOUT_DESIGN.md
  CLAUDE.md
```

Scout 폴더(`app/scout/`, `lib/scout/`, `lib/supabase/`)는 Review 실사용 검증 완료 후에만 생성.

---

## 5. Claude API 사용 규칙

- 모델 ID는 **`process.env.ANTHROPIC_MODEL`에서만.** 하드코딩 금지.
- 프롬프트는 `lib/review/prompts/` 하위 상수. UI/route 코드에 긴 프롬프트 문자열 두지 않는다.
- JSON 모드 + Zod 검증. 실패 시 최대 2회 재시도.
- 온도(temperature) 기본 0.2.
- 응답 `meta.model`은 실제 사용된 ID.

---

## 6. 환경변수 (서버 전용)

| 이름 | 시점 | 용도 |
|---|---|---|
| `ANTHROPIC_API_KEY` | Review Phase 2부터 | Claude 호출 |
| `ANTHROPIC_MODEL` | Review Phase 2부터 | 사용 모델 ID (하드코딩 금지) |
| `REVIEW_SHARED_PASSWORD` | Vercel 배포 순간부터 | shared-password 인증 |
| `THREADS_ACCESS_TOKEN` (예정) | Scout Phase A부터 | Threads API |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (예정) | Scout Phase B부터 | 저장 |

**`NEXT_PUBLIC_` 접두어 금지.** `.env.local.example`은 값 비움.

---

## 7. Git 커밋 규칙

- Prefix: `phase(N): ...` · `fix: ...` · `chore: ...` · `docs: ...` · `wip: ...`.
- Phase 완료 커밋은 별도.
- `git push`는 `-u origin claude/viral-lab-architecture-6248iv`.
- 다른 브랜치 push·PR 생성은 사용자 명시 요청 시에만.

---

## 8. 대화·응답 규칙

- 사용자는 초보자다. 전문용어는 그 자리에서 한 줄로 뜻 설명.
- 새 라이브러리·서비스·폴더 구조 제안 시 항상 "왜 필요한지 + 더 단순한 대안"을 함께.
- 각 Phase 시작 전에 목표·산출물·수용 테스트를 다시 확인.
- 사소한 결정(파일명, 변수명)은 알아서 정하고 결과만 보고.

---

## 9. 현재 확정된 Phase 목록

자세한 내용은 `docs/ACCEPTANCE_TESTS.md`.

**Review (선행):**
- Phase 0 — 문서 설계 (완료)
- Phase 1 — Next.js 초기화 + `/review` + Excel 업로드 + Header 자동 감지 + 행 화면 표시 (AI 없음)
- Phase 2 — 한 행 AI 분석 + Zod 검증
- Phase 3 — 전체 배치 분석 + localStorage row-level cache + 강제 재분석
- Phase 4 — Portfolio Analysis
- Phase 5 — ANALYZED Excel 다운로드
- Phase 6 — Vercel 배포 + shared-password + 실제 업무 테스트

**Scout (Review Phase 6 완료 및 사용자 명시 승인 후에만):**
- Phase A — Search Family + Seed Query 관리 + 수동 검색 + Threads API 결과 화면
- Phase B — SAVE/REJECT + Supabase + Exact Dedup
- Phase C — AI 분류(Hook/감정/화자/공개방식) + 기존 레퍼런스 대비 Novelty
- Phase D — Semantic Clustering + Diversity Quota + Explore 슬롯
- Phase E — 신규 Query Candidate 제안 + NEW_PATTERN_CANDIDATE + Query Performance
- Phase F — Optional Public Engagement Verification (조회수 필터)
- Phase G — Cron 자동 수집 (모든 수동 과정 안정화 이후에만)

---

## 10. 이 문서 자체의 갱신

- 규칙이 바뀌면 이 문서를 먼저 고치고, 그 커밋에 이유를 남긴다.
- 새 결정은 `docs/DECISIONS.md`에도 append.
- 초판을 뒤엎는 결정은 이전 결정을 `superseded`로 표시하고 새 항목 추가.
