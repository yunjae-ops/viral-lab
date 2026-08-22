import { NextRequest, NextResponse } from "next/server";
import { getSharedPassword, MissingEnvError } from "@/lib/auth/env";
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS, createSessionToken, timingSafeEqual } from "@/lib/auth/session";

export async function POST(req: NextRequest) {
  let password: string;
  try {
    password = getSharedPassword();
  } catch (err) {
    if (err instanceof MissingEnvError) {
      return NextResponse.json({ error: "ENV_MISSING", detail: err.message }, { status: 500 });
    }
    throw err;
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON", detail: "요청 본문이 JSON이 아닙니다." }, { status: 400 });
  }

  const input =
    typeof body === "object" && body !== null && "password" in body && typeof (body as { password: unknown }).password === "string"
      ? (body as { password: string }).password
      : "";

  if (!timingSafeEqual(input, password)) {
    return NextResponse.json({ error: "INVALID_PASSWORD", detail: "비밀번호가 올바르지 않습니다." }, { status: 401 });
  }

  const expiresAtMs = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
  const token = await createSessionToken(password, expiresAtMs);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return res;
}
