import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";

// /review, /api/review/*를 shared-password 세션으로 게이팅한다 (CLAUDE.md §2-17).
// /login, /api/auth/*는 이 matcher에 포함되지 않으므로 무한 리다이렉트가 생기지 않는다.
export const config = {
  matcher: ["/review/:path*", "/api/review/:path*"],
};

export async function middleware(req: NextRequest) {
  const isApi = req.nextUrl.pathname.startsWith("/api/");
  const password = process.env.REVIEW_SHARED_PASSWORD;

  if (!password) {
    const detail = "REVIEW_SHARED_PASSWORD 환경변수가 설정되지 않았습니다. 배포 환경에서는 반드시 설정해야 합니다.";
    if (isApi) {
      return NextResponse.json({ error: "ENV_MISSING", detail }, { status: 500 });
    }
    return new NextResponse(detail, { status: 500 });
  }

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const authenticated = await verifySessionToken(password, token);
  if (authenticated) {
    return NextResponse.next();
  }

  if (isApi) {
    return NextResponse.json({ error: "UNAUTHORIZED", detail: "로그인이 필요합니다." }, { status: 401 });
  }

  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("redirect", req.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}
