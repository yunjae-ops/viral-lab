# Viral Lab

Threads 바이럴 콘텐츠 업무용 내부 웹도구. 자세한 제품 스펙은 `docs/SPEC.md`, `docs/DATA_CONTRACT.md`를 참고하세요. 이 문서는 실행·배포에 필요한 최소 정보만 다룹니다.

## 로컬 실행

```bash
pnpm install
cp .env.local.example .env.local   # 값을 채운 뒤
pnpm dev                            # http://localhost:3000
```

검증 명령:

```bash
pnpm typecheck
pnpm test
pnpm build
```

## 환경변수

`.env.local.example` 참고. 모두 서버 전용이며 `NEXT_PUBLIC_` 접두어를 쓰지 않습니다(브라우저에 노출 금지, CLAUDE.md §2-1).

| 이름 | 용도 | 비고 |
|---|---|---|
| `VIRAL_LAB_ANTHROPIC_API_KEY` | Claude API 호출 | Claude Code 자체 인증용 `ANTHROPIC_API_KEY`와 충돌 방지를 위해 접두어를 붙임 |
| `VIRAL_LAB_ANTHROPIC_MODEL` | 사용할 Claude 모델 ID | 코드에 하드코딩 금지 — 이 값으로만 읽음 |
| `REVIEW_SHARED_PASSWORD` | `/review`, `/api/review/*` shared-password 로그인 | 비어 있으면 해당 경로가 500으로 막힘(fail-closed) — 로컬 개발도 이 값을 설정해야 접근 가능 |

세 값 모두 로컬 `.env.local`과 Vercel 프로젝트의 Production/Preview 환경변수에 등록해야 합니다. `.env.local`은 `.gitignore`에 포함되어 있어 Git에 커밋되지 않습니다.

## Vercel 배포 구조

- Framework: Next.js (App Router), Node.js 런타임 API Route + Edge 런타임 Middleware(로그인 게이팅)
- Build Command: `pnpm build` (기본값), Package Manager: pnpm (기본 자동 감지)
- Production 브랜치: `main`
- 필요한 환경변수 3종(`VIRAL_LAB_ANTHROPIC_API_KEY`, `VIRAL_LAB_ANTHROPIC_MODEL`, `REVIEW_SHARED_PASSWORD`)을 Vercel 프로젝트 Settings → Environment Variables에 Production/Preview 둘 다 등록
- Production URL: https://viral-lab-git-main-marketcommerce1.vercel.app
- 배포 상태: main(`19ee03d`) 기준 Production 배포 완료. shared-password 로그인 → `/review` 진입은 사용자가 실제 브라우저로 직접 확인함(이 세션은 네트워크 정책상 해당 도메인에 접속할 수 없어 직접 검증하지 못함).

## Secret 관리 주의사항

- API Key/비밀번호를 코드나 커밋에 절대 넣지 않습니다. `.env.local`, `.env` 등은 모두 `.gitignore`에 있습니다.
- Vercel 환경변수는 Vercel 대시보드에서만 관리하고, 값을 커밋 메시지·이슈·PR 본문에 붙여넣지 않습니다.
- 키가 실수로라도 노출됐다면(채팅, 로그 등) Anthropic 콘솔에서 즉시 재발급(rotate)하세요.
