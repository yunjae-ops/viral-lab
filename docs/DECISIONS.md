# DECISIONS.md — 설계 결정 기록 (ADR)

각 결정은 다음 형식.

- **상태:** proposed / accepted / superseded
- **날짜:** YYYY-MM-DD
- **맥락:** 왜 이 결정이 필요한가
- **결정:** 무엇을 하기로 했는가
- **대안:** 고려했지만 안 쓴 것들
- **비고:** 초보자 관점 부연

> 용어: ADR = Architecture Decision Record. "이 결정을 왜 했는지"를 나중에도 알 수 있게 남겨두는 짧은 노트.

---

## D-001 · 개발 순서는 Review → Scout 고정

- **상태:** accepted
- **날짜:** 2026-08-21
- **맥락:** 두 기능을 병행하면 초보자 입장에서 코드베이스가 급격히 복잡해지고, 잘못된 구조가 조기에 굳는다.
- **결정:** Review가 실사용 검증(Phase 7)까지 끝난 뒤에만 Scout 관련 폴더·의존성(Supabase 포함)을 추가한다.
- **대안:**
  - 병행 개발 → 탈락.
  - Scout 먼저 → 탈락.
- **비고:** Review 안정 전까지 `app/scout`, `lib/scout`, `@supabase/*` 없어야 함.

---

## D-002 · Portfolio 집계는 코드가 계산, AI는 자유서술만

- **상태:** accepted
- **날짜:** 2026-08-21
- **맥락:** 개수·비율·경고 판정은 결정적이며 AI가 하면 오차·비용 문제.
- **결정:** 카테고리별 개수·비율·과사용 경고 → 서버 코드. "다음 방향 추천" 자유서술만 Claude 1회 호출.
- **대안:** 전부 AI → 탈락. 전부 코드 → 탈락.
- **비고:** Portfolio는 항상 결정적으로 검증 가능.

---

## D-003 · 초기 차트는 Chart 라이브러리 없이 CSS 막대로 그린다

- **상태:** accepted
- **날짜:** 2026-08-21
- **결정:** Phase 5의 막대차트는 Tailwind `w-[35%]` 같은 단순 div bar. 필요 명확해질 때만 라이브러리.
- **대안:** Recharts 초기 도입 → 탈락.

---

## D-004 · Core Grade는 A / B / FAIL만, Diagnostic 3축은 처음부터 enum

- **상태:** accepted (2026-08-21 개정, 초판 supersede)
- **날짜:** 2026-08-21
- **맥락:** 초판(D-004 v1)은 Core Grade에 C·D를 두고, Diagnostic을 자유서술로 시작하는 안이었다. 사용자가 실제 판정 원칙과 카테고리 목록을 확정해줬으므로 지금 굳힌다.
- **결정 (Core Grade):**
  - passedCount 4 → **A**
  - passedCount 3 → **B**
  - passedCount 0–2 → **FAIL**
  - **C·D 등급은 존재하지 않는다.**
- **결정 (Hook Code):** A~M 13개 정의는 `docs/HOOK_CODES.md`로 고정. enum에 OTHER 없음.
- **결정 (Diagnostic 3축):** 모두 처음부터 enum + OTHER 허용.
  - 감정태도: `절박함 | 시크함 | 순수감탄 | 놀람 | OTHER`
  - 화자: `본인 1인칭 | 딸-엄마 관찰 | 친구-친구 관찰 | 순수 목격자 | OTHER`
  - 정보공개방식: `직접서술 | 리스트 | 대화체 | 선언문 | OTHER`
- **결정 (OTHER 강제):** `value === "OTHER"`면 `otherLabel`은 비어 있지 않은 문자열, 아니면 `null`. Zod refinement로 검증.
- **대안:** 자유서술로 시작 후 승격 → 탈락. 카테고리가 이미 확정됐다면 처음부터 enum이 정확하다.
- **비고:** 새 카테고리 필요 시 이 문서와 스키마·`promptVersion`을 함께 갱신.

---

## D-005 · 초기 인증 정책: shared-password (Phase 3부터 적용)

- **상태:** accepted (2026-08-21 개정, 초판 supersede)
- **날짜:** 2026-08-21
- **맥락:** 초판은 "URL 비공개, 인증 없음"이었지만 Claude API endpoint가 Vercel에 공개되는 순간 유출·남용 위험이 있다.
- **결정:**
  - **Phase 1~2 (Claude API 미도입, 빈 UI):** 인증 없음.
  - **Phase 3부터:** 최소한의 **shared-password 인증**을 도입.
    - 서버 env `REVIEW_SHARED_PASSWORD`와 브라우저 입력을 비교.
    - 성공 시 HttpOnly 세션 쿠키(30일) 발급.
    - `/review` 및 `/api/review/*`는 세션 없으면 접근 불가.
  - Google OAuth 등 복잡한 인증은 사용하지 않는다.
- **대안:**
  - 계속 인증 없음 → 탈락. API 남용 위험.
  - OAuth → 탈락. 초보자 유지비 큼.
- **비고:** shared-password는 팀 전원이 같은 비밀번호를 안다는 뜻. 유출되면 즉시 env 값 교체.

---

## D-006 · 로컬 캐시 정책: localStorage row-level cache

- **상태:** accepted (2026-08-21 개정, 초판 supersede)
- **날짜:** 2026-08-21
- **맥락:** 초판은 "결과를 저장하지 않고 새로고침 시 사라짐 허용"이었지만, 배치 처리 비용과 사용 편의를 감안해 정책을 강화한다.
- **결정:**
  - Supabase·IndexedDB는 여전히 사용하지 않는다.
  - **localStorage 기반 row-level 캐시**를 도입 (Phase 4).
  - 캐시 키: `SHA-256(draft + ␞ + (refOriginal ?? "") + ␞ + promptVersion)`.
  - 동일 입력은 사용자가 강제 재분석하지 않는 한 Claude를 다시 호출하지 않는다.
  - 새로고침·재업로드 후에도 결과가 즉시 복구된다.
  - "이 행 강제 재분석", "전체 강제 재분석", "캐시 비우기" 버튼 제공.
  - 크기 관리는 초기에는 단순 timestamp 기준 LRU-lite.
- **대안:**
  - IndexedDB → 탈락. 지금은 오버스펙.
  - Supabase → 탈락. Scout 전에는 도입 안 함(D-001).
  - 계속 저장 안 함 → 탈락. 배치 반복 시 비용/시간 낭비.
- **비고:** localStorage는 도메인·브라우저별로 분리되므로 다른 팀원은 자기 결과가 없다. 팀 공유가 필요해지면 그때 Supabase로 승격 검토.

---

## D-007 · Claude 응답은 항상 서버가 스키마 재검증·등급 재계산

- **상태:** accepted
- **날짜:** 2026-08-21
- **결정:** 서버 API가 응답을 Zod로 검증하고, `core.grade`·`passedCount`는 서버가 gates 결과로 재계산해 덮어쓴다. 등급 매핑은 `4→A, 3→B, 0-2→FAIL`.
- **대안:** AI 값을 그대로 사용 → 탈락.
- **비고:** "AI는 관찰자, 규칙은 코드가 판정한다"는 원칙.

---

## D-008 · 파일 파싱은 브라우저에서, 서버에는 텍스트만

- **상태:** accepted
- **결정:** SheetJS로 브라우저 파싱. API에는 분석 대상 텍스트 최소 필드만.
- **비고:** 원본 Excel이 사용자 컴퓨터 밖으로 나가지 않음 (프라이버시 이점).

---

## D-009 · Claude 모델은 env `ANTHROPIC_MODEL`로 관리, 코드 하드코딩 금지

- **상태:** accepted (2026-08-21 개정, 초판 supersede)
- **날짜:** 2026-08-21
- **맥락:** 초판은 코드에 `claude-sonnet-4-5`를 상수로 두는 안이었다. 하지만 모델 교체(가격, 품질, 신모델 출시)가 잦아질 수 있어 코드 재배포 없이 바꿀 수 있어야 한다.
- **결정:**
  - 서버는 `process.env.ANTHROPIC_MODEL`을 읽어 사용한다.
  - env가 비어 있으면 서버 시작 시 명확한 에러(팀 온보딩 시 실수 방지).
  - 저장소에는 모델 ID 문자열이 코드로 존재하지 않는다.
  - `.env.local.example`에도 값은 비워둔다(예시 값이 잘못된 기본값처럼 굳는 것 방지).
  - 응답의 `meta.model`은 실제 사용된 값을 그대로 실어 감사에 대비.
- **대안:**
  - 코드에 하드코딩 → 탈락. 재배포 없이는 변경 불가.
  - env에 기본값 fallback → 탈락. 팀별 실제 사용 모델이 무엇인지 흐려짐.
- **비고:** 모델 변경 시 `docs/DECISIONS.md`에 새 항목을 추가할 필요는 없다(코드 결정이 아님). 다만 프롬프트 자체를 바꿨다면 `promptVersion`을 올려야 한다.

---

## D-010 · Scout는 공식 Threads API만, URL 크롤링은 부차 기능

- **상태:** accepted
- **결정:** Threads 공식 keyword search API가 유일한 자동 수집 경로. 원문은 사용자 textarea fallback.
- **대안:** Puppeteer/Playwright → 탈락. 유지비·정책 위험.

---

## 열려 있는 결정(미정)

- 없음. Phase 1~7까지의 모든 설계 결정이 확정되었다.
