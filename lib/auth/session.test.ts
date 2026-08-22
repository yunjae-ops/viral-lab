import { describe, it, expect } from "vitest";
import { createSessionToken, verifySessionToken, timingSafeEqual } from "./session";

describe("timingSafeEqual", () => {
  it("동일 문자열은 true", () => {
    expect(timingSafeEqual("abc123", "abc123")).toBe(true);
  });
  it("다른 문자열은 false", () => {
    expect(timingSafeEqual("abc123", "abc124")).toBe(false);
  });
  it("길이가 다르면 false", () => {
    expect(timingSafeEqual("abc", "abcd")).toBe(false);
  });
});

describe("createSessionToken / verifySessionToken", () => {
  it("올바른 비밀번호로 만든 토큰은 검증을 통과한다", async () => {
    const token = await createSessionToken("secret-pw", Date.now() + 60_000);
    expect(await verifySessionToken("secret-pw", token)).toBe(true);
  });

  it("다른 비밀번호로 검증하면 실패한다", async () => {
    const token = await createSessionToken("secret-pw", Date.now() + 60_000);
    expect(await verifySessionToken("other-pw", token)).toBe(false);
  });

  it("만료된 토큰은 실패한다", async () => {
    const token = await createSessionToken("secret-pw", Date.now() - 1000);
    expect(await verifySessionToken("secret-pw", token)).toBe(false);
  });

  it("토큰이 없거나 형식이 이상하면 실패한다", async () => {
    expect(await verifySessionToken("secret-pw", undefined)).toBe(false);
    expect(await verifySessionToken("secret-pw", "")).toBe(false);
    expect(await verifySessionToken("secret-pw", "no-dot-here")).toBe(false);
    expect(await verifySessionToken("secret-pw", "not-a-number.abcdef")).toBe(false);
  });

  it("서명이 변조되면 실패한다", async () => {
    const token = await createSessionToken("secret-pw", Date.now() + 60_000);
    const [payload] = token.split(".");
    const tampered = `${payload}.deadbeef`;
    expect(await verifySessionToken("secret-pw", tampered)).toBe(false);
  });

  it("만료 시각(payload)을 늘려서 위조하면 서명이 안 맞아 실패한다", async () => {
    const token = await createSessionToken("secret-pw", Date.now() + 60_000);
    const [, sig] = token.split(".");
    const tamperedPayload = String(Date.now() + 999_999_999);
    expect(await verifySessionToken("secret-pw", `${tamperedPayload}.${sig}`)).toBe(false);
  });
});
