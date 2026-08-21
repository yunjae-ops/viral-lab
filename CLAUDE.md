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
   첫 행을 Header로 가정하지 않는다. 처음 20행 중에서 필수 Header(`순서`, `리뷰내용` 등)를 모두 포함한 행을 찾아 Header 행으로 사용한다.

6. **Phase 단위 개발.**
   - 각 Phase는 `docs/ACCEPTANCE_TESTS.md`의 해당 Phase 테스트를 모두 통과해야 완료.
   - 완료 시 Git commit 1개를 만든다. 커밋 메시지 prefix: `phase(N): ...`
   - **다음 Phase로 절대 자동 진행 금지.** 사용자에게 결과를 보여주고, 명시적 승인("다음 Phase로 가자" 등)을 받은 뒤에만 진행.

7. **Scout는 Review 완성 전에는 손대지 않는다.** 이 규칙은 사용자가 명시적으로 뒤집기 전까지 유효하다.

8. **Threads URL 자동 스크래핑을 핵심 의존성으로 만들지 않는다.**
   Scout에서 자동 읽기가 실패해도 원문을 직접 textarea에 붙여넣을 수 있는 fallback을 항상 둔다.

9. **자동 수집(cron/스케줄러)은 마지막에만 붙인다.** "수집 실행" 버튼으로 수동 검증이 끝난 뒤에만.

10. **비용 폭주 방지.** 배치 AI 호출은 동시성 제한(초기값 3)을 둔다. 사용자에게 예상 호출 건수를 먼저 보여주고 확인받은 뒤 실행.

---

## 3. 기술 스택 (확정)

- Next.js (App Router) + TypeScript
- Tailwind CSS
- SheetJS (`xlsx`) — Excel 읽기/쓰기, 브라우저에서 동작
- Zod — AI 응답 및 사용자 입력 검증
- Anthropic SDK (`@anthropic-ai/sdk`) — Claude API 호출, 서버에서만
- Git + GitHub + Vercel(배포)
- **Scout Phase에서만 추가:** Supabase (Postgres + 인증 관리형)
- **Threads 수집:** 공식 Threads API 우선

새 라이브러리를 넣기 전에 반드시 사용자에게 이유와 대안을 설명하고 승인받는다.

---

## 4. 폴더 구조 (초기 목표)

```
viral-lab/
  app/
    review/
      page.tsx              # /review UI
      components/           # Review 전용 UI 조각
    api/
      review/
        analyze-row/route.ts    # 한 행 분석 (Claude 호출)
        portfolio/route.ts      # 포트폴리오 분석 (Claude 호출)
  lib/
    excel/                  # header 감지, 파싱, ANALYZED 생성
    review/                 # Core Grade / Diagnostic 로직, prompt
    schema/                 # Zod schema (AI 응답, 행 데이터)
  docs/
    SPEC.md
    DATA_CONTRACT.md
    ACCEPTANCE_TESTS.md
    DECISIONS.md
  CLAUDE.md
```

Scout 폴더(`app/scout/`, `lib/scout/`, `lib/supabase/`)는 Review 완성 전에는 존재하지 않는다.

---

## 5. Claude API 사용 규칙

- 모델은 프로젝트 시작 시 `claude-sonnet-4-5`로 고정. 변경 시 `docs/DECISIONS.md`에 이유 기록.
- 모든 프롬프트는 `lib/review/prompts/` 하위에 상수로 분리. 코드 안에 하드코딩된 긴 프롬프트 문자열 금지.
- AI 응답은 반드시 JSON 모드로 받고 Zod 검증. 실패 시 최대 2회 자동 재시도.
- 온도(temperature)는 기본 0.2. 창의 서술이 필요한 필드가 아니면 낮게 유지.

---

## 6. Git 커밋 규칙

- 커밋 prefix:
  - `phase(N): ...` — Phase 완료 커밋
  - `fix: ...` `chore: ...` `docs: ...` `wip: ...` — 소소한 변경
- 한 Phase 안에서 여러 wip 커밋은 허용하되, Phase 완료 커밋은 반드시 별도로.
- `git push`는 항상 `-u origin claude/viral-lab-architecture-6248iv` (현재 지정 브랜치)로.
- 사용자 명시 승인 없이 다른 브랜치로 push 금지.
- Pull Request는 사용자가 명시적으로 요청할 때만 생성.

---

## 7. 대화·응답 규칙

- 사용자는 초보자다. 전문용어가 나오면 그 자리에서 한 줄로 뜻을 설명한다.
- 새 라이브러리·새 서비스·새 폴더 구조 제안 시, 항상 "왜 필요한지 + 더 단순한 대안"을 함께 제시한다.
- 코드로 곧장 뛰어들지 말고, 각 Phase 시작 전에 그 Phase의 목표·산출물·수용 테스트를 다시 확인한다.
- 결정이 애매하면 물어보되, 사소한 것(파일명, 변수명 등)은 알아서 정하고 결과만 보고한다.

---

## 8. 현재 확정된 Phase 목록 (Review 부분)

자세한 내용은 `docs/ACCEPTANCE_TESTS.md`.

- Phase 0 — 문서 설계 (지금 이 작업)
- Phase 1 — Next.js 프로젝트 초기화 + `/review` 빈 페이지 + Vercel 첫 배포 확인
- Phase 2 — Excel 업로드 + Header 자동 감지 + 행 미리보기 (AI 호출 없음)
- Phase 3 — 단일 행 AI 분석 API + Zod 검증 (1건만)
- Phase 4 — 전체 행 배치 분석 (동시성 제한, 진행률 표시)
- Phase 5 — Portfolio Analysis (전체 집계 + AI 요약)
- Phase 6 — ANALYZED Excel 다운로드
- Phase 7 — Review UX 다듬기 + 실제 파일로 최종 검증

Scout Phase는 Phase 7 완료 후 별도 설계.

---

## 9. 이 문서 자체의 갱신

- 규칙이 바뀌면 이 문서를 먼저 고치고, 그 커밋에 이유를 남긴다.
- 새 결정은 `docs/DECISIONS.md`에도 append.
