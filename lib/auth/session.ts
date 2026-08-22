// Shared-password 세션 유틸 (CLAUDE.md §2-17). Vercel Edge Middleware와 Node API Route
// 양쪽에서 동일하게 동작해야 하므로 Web Crypto(`crypto.subtle`)만 사용한다 —
// Node 전용 `crypto` 모듈은 Edge 런타임에서 쓸 수 없다.

export const SESSION_COOKIE_NAME = "viral_lab_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30일

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function sign(secret: string, payload: string): Promise<string> {
  const key = await hmacKey(secret);
  const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return toHex(sigBuf);
}

// 상수 시간 비교 — 세션 서명·비밀번호 비교에 공용으로 쓴다.
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// 세션 쿠키 값 = `${만료시각}.${HMAC서명}`. 서버(REVIEW_SHARED_PASSWORD)만 서명을
// 검증할 수 있으므로 별도 세션 저장소(DB) 없이도 위조를 막을 수 있다.
export async function createSessionToken(secret: string, expiresAtMs: number): Promise<string> {
  const payload = String(expiresAtMs);
  const sig = await sign(secret, payload);
  return `${payload}.${sig}`;
}

export async function verifySessionToken(secret: string, token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const dot = token.indexOf(".");
  if (dot === -1) return false;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  const expiresAtMs = Number(payload);
  if (!Number.isFinite(expiresAtMs) || Date.now() > expiresAtMs) return false;

  const expectedSig = await sign(secret, payload);
  return timingSafeEqual(sig, expectedSig);
}
