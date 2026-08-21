# CLAUDE.md — Viral Lab 프로젝트 운영 규칙

이 파일은 이 저장소에서 작업하는 Claude 세션이 매번 지켜야 하는 규칙이다.
프로젝트 소유자는 웹개발 초보자이며, "잘못된 구조로 시작해서 나중에 갈아엎는 것"을 반드시 피하고 싶어한다.
모든 결정과 코드는 이 문서를 최우선으로 따른다.

---

## 1. 프로젝트 한 줄 정의

Threads 바이럴 콘텐츠 업무를 위한 내부 웹도구.
하나의 Next.js 프로젝트 안에 두 기능이 있다.

- `/review` — 내가 작성한 Threads 콘텐츠를 내 평가 원칙에 따라 분석
- `/scout` — Threads에서 새 레퍼런스를 수집·평가

**개발 순서는 고정이다: `/review` 완성 → 그 다음에만 `/scout` 시작.**
Scout 관련 코드/의존성/폴더는 Review Phase가 끝날 때까지 저장소에 넣지 않는다.

---

## 2. 절대 어기지 말 것 (Hard Rules)

1. **API Key는 서버 전용.** `NEXT_PUBLIC_` 접두어가 붙은 환경변수에 절대 넣지 않는다.
   Claude 호출은 반드시 Next.js API Route(서버 코드)에서만 실행한다.
   > 용어: `NEXT_PUBLIC_...`는 브라우저에 그대로 노출되는 환경변수. 여기에 키를 두면 유출.

2. **원본 Excel 파일은 절대 덮어쓰지 않는다.**
   결과는 항상 별도의 `..._ANALYZED_YYYYMMDD_HHmm.xlsx` 파일로 다운로드한다.

3. **Excel 파싱은 브라우저에서 한다.**
   서버 API에는 분석에 필요한 텍스트 필드만 JSON으로 보낸다. 파일 자체를 서버로 업로드하지 않는다.

4. **AI 응답은 반드시 정해진 JSON schema로만 받는다.**
   응답을 Zod로 검증한다. 검증 실패 시 자동 재시도(최대 2회) 후 사용자에게 에러로 노출.
   > 용어: Zod = TypeScript용 데이터 검증 라이브러리. "이 JSON이 내가 기대한 모양인가?"를 코드로 확인.

5. **Excel Header 자동 감지.**
   - 첫 행을 Header로 가정하지 않는다. 처음 20행에서 필수 Header를 모두 포함한 행을 찾는다.
   - 셀 문자열은 `trim`(앞뒤 공백 제거) 후 비교.
   - **필수 Header (3종):** `순서`, `/제목`, `리뷰내용`.
   - **별칭 허용:**
     - `/제목` = `레퍼런스 링크`
     - `리뷰내용` = `작성안` = `작성한 글`
   - **선택 Header:** `이미지 파일명`, `레퍼런스 원문`. 둘 다 없어도 분석 가능.

6. **Core Grade 등급은 `A | B | FAIL` 3종만.**
   - passedCount 4 → `A`
   - passedCount 3 → `B`
   - passedCount 0–2 → `FAIL`
   - **C·D 등급은 존재하지 않는다.** 어떤 코드·프롬프트·문서에도 넣지 말 것.
   - 등급 계산은 서버가 gates 결과로 항상 재계산해 덮어쓴다.

7. **Diagnostic 3축은 처음부터 enum + OTHER + otherLabel.**
   - Hook Code: `A~M` (OTHER 없음, `docs/HOOK_CODES.md` 참조)
   - 감정태도: `절박함 | 시크함 | 순수감탄 | 놀람 | OTHER`
   - 화자: `본인 1인칭 | 딸-엄마 관찰 | 친구-친구 관찰 | 순수 목격자 | OTHER`
   - 정보공개방식: `직접서술 | 리스트 | 대화체 | 선언문 | OTHER`
   - OTHER를 반환할 때는 `otherLabel`을 반드시 함께 반환. `value !== "OTHER"`이면 `otherLabel === null`. Zod refinement로 검증.

8. **Phase 단위 개발.**
   - 각 Phase는 `docs/ACCEPTANCE_TESTS.md`의 해당 Phase 테스트를 모두 통과해야 완료.
   - 완료 시 Git commit 1개. 커밋 메시지 prefix: `phase(N): ...`
   - **다음 Phase로 절대 자동 진행 금지.** 명시적 승인 대기.

9. **Scout는 Review 완성 전에는 손대지 않는다.**

10. **Threads URL 자동 스크래핑을 핵심 의존성으로 만들지 않는다.**
    Scout에서 자동 읽기가 실패해도 원문을 직접 textarea에 붙여넣을 수 있는 fallback을 항상 둔다.

11. **자동 수집(cron)은 마지막에만.** "수집 실행" 버튼 수동 검증 이후.

12. **비용 폭주 방지.** 배치는 동시성 3. 사용자에게 예상 호출 건수(캐시 히트 반영)를 먼저 보여주고 확인.

13. **Claude 모델은 env `ANTHROPIC_MODEL`로만 관리.**
    코드에 모델 ID 문자열(`claude-sonnet-4-5` 등)을 절대 하드코딩하지 않는다.
    env가 비면 서버 시작 시 명확한 에러. 응답 `meta.model`은 실제 사용된 값을 실어 감사에 대비.

14. **인증 정책.**
    - Phase 1~2 (Claude endpoint 없음): 인증 없음.
    - Phase 3 이후: **shared-password 인증 필수.** `REVIEW_SHARED_PASSWORD` env와 비교, 성공 시 HttpOnly 세션 쿠키(30일).
    - OAuth 등 복잡한 인증은 도입하지 않는다.

15. **분석 결과 캐시.**
    - Supabase·IndexedDB는 사용하지 않는다.
    - Phase 4부터 **localStorage row-level 캐시** 도입.
    - 키: `SHA-256(draft + ␞ + (refOriginal ?? "") + ␞ + promptVersion)`.
    - 동일 입력은 사용자가 강제 재분석하지 않는 한 Claude를 다시 호출하지 않는다.
    - 새로고침·재업로드 후 결과 복구 가능해야 한다.

---

## 3. 기술 스택 (확정)

- Next.js (App Router) + TypeScript
- Tailwind CSS
- SheetJS (`xlsx`) — Excel 읽기/쓰기, 브라우저에서 동작
- Zod — AI 응답 및 사용자 입력 검증
- Anthropic SDK (`@anthropic-ai/sdk`) — 서버에서만 호출
- Git + GitHub + Vercel(배포)
- **Scout Phase에서만 추가:** Supabase (Postgres 관리형)
- **Threads 수집:** 공식 Threads API 우선

새 라이브러리 도입 전 반드시 이유·대안을 설명하고 승인받는다.

---

## 4. 폴더 구조 (초기 목표)

```
viral-lab/
  app/
    login/
      page.tsx              # shared-password 입력 (Phase 3부터)
    review/
      page.tsx              # /review UI
      components/           # Review 전용 UI 조각
    api/
      auth/
        login/route.ts      # shared-password 검증 (Phase 3)
      review/
        analyze-row/route.ts
        portfolio/route.ts
  lib/
    excel/                  # header 감지, 파싱, ANALYZED 생성
    review/
      prompts/              # 프롬프트 상수 (Hook 코드 정의 임베드)
      cache/                # localStorage row-level cache
    schema/                 # Zod schema
    auth/                   # shared-password 세션 유틸
  docs/
    SPEC.md
    DATA_CONTRACT.md
    ACCEPTANCE_TESTS.md
    DECISIONS.md
    HOOK_CODES.md
  CLAUDE.md
```

Scout 폴더(`app/scout/`, `lib/scout/`, `lib/supabase/`)는 Review 완성 전에는 존재하지 않는다.

---

## 5. Claude API 사용 규칙

- 모델 ID는 **`process.env.ANTHROPIC_MODEL`에서만** 읽는다. 하드코딩 금지.
- 모든 프롬프트는 `lib/review/prompts/` 하위 상수로 분리. 긴 프롬프트 문자열을 UI/route 코드 안에 두지 않는다.
- AI 응답은 JSON 모드로 받고 Zod 검증. 실패 시 최대 2회 자동 재시도.
- 온도(temperature) 기본 0.2. 창의 서술 필드가 아니면 낮게 유지.
- 응답 `meta.model`에 실제 사용된 모델 ID를 실어 반환.

---

## 6. 환경변수 (서버 전용)

| 이름 | 시점 | 용도 |
|---|---|---|
| `ANTHROPIC_API_KEY` | Phase 3부터 | Claude 호출 |
| `ANTHROPIC_MODEL` | Phase 3부터 | 사용 모델 ID (하드코딩 금지) |
| `REVIEW_SHARED_PASSWORD` | Phase 3부터 | shared-password 인증 |

**`NEXT_PUBLIC_` 접두어 금지.** `.env.local.example`은 값을 비워둔다.

---

## 7. Git 커밋 규칙

- 커밋 prefix:
  - `phase(N): ...` — Phase 완료 커밋
  - `fix: ...` `chore: ...` `docs: ...` `wip: ...`
- Phase 완료 커밋은 반드시 별도로.
- `git push`는 항상 `-u origin claude/viral-lab-architecture-6248iv`.
- 사용자 명시 승인 없이 다른 브랜치로 push 금지.
- Pull Request는 사용자가 명시적으로 요청할 때만 생성.

---

## 8. 대화·응답 규칙

- 사용자는 초보자다. 전문용어가 나오면 그 자리에서 한 줄로 뜻을 설명한다.
- 새 라이브러리·서비스·폴더 구조 제안 시 항상 "왜 필요한지 + 더 단순한 대안"을 함께.
- 각 Phase 시작 전에 그 Phase의 목표·산출물·수용 테스트를 다시 확인한다.
- 사소한 결정(파일명, 변수명 등)은 알아서 정하고 결과만 보고.

---

## 9. 현재 확정된 Phase 목록 (Review 부분)

자세한 내용은 `docs/ACCEPTANCE_TESTS.md`.

- Phase 0 — 문서 설계 (완료)
- Phase 1 — Next.js 프로젝트 초기화 + `/review` 빈 페이지 + Vercel 첫 배포 확인 (인증 없음)
- Phase 2 — Excel 업로드 + Header 자동 감지 (AI 호출 없음, 인증 없음)
- Phase 3 — 단일 행 AI 분석 API + Zod 검증 + **shared-password 인증 도입**
- Phase 4 — 배치 분석 + 진행률 + **localStorage row-level 캐시**
- Phase 5 — Portfolio Analysis (등급 `A|B|FAIL`)
- Phase 6 — ANALYZED Excel 다운로드
- Phase 7 — Review UX 다듬기 + 실제 파일로 최종 검증

Scout Phase는 Phase 7 완료 후 별도 설계.

---

## 10. 이 문서 자체의 갱신

- 규칙이 바뀌면 이 문서를 먼저 고치고, 그 커밋에 이유를 남긴다.
- 새 결정은 `docs/DECISIONS.md`에도 append.
- 초판을 뒤엎는 결정은 이전 결정을 `superseded`로 표시하고 새 항목을 추가.
