import { describe, it, expect } from "vitest";
import { decideAnalysis } from "./decideAnalysis";
import type { CacheEntry } from "./rowCache";
import type { RowAnalysis } from "@/lib/schema/rowAnalysis";

const fakeEntry: CacheEntry = {
  key: "k",
  promptVersion: "v3",
  analyzedAt: "2026-01-01T00:00:00.000Z",
  result: { index: 0 } as unknown as RowAnalysis,
};

describe("decideAnalysis", () => {
  it("캐시 히트 + force=false → cache-hit (API 호출 없음)", () => {
    const decision = decideAnalysis({
      cacheKey: "k",
      force: false,
      readCache: (key) => (key === "k" ? fakeEntry : null),
    });
    expect(decision.type).toBe("cache-hit");
    if (decision.type === "cache-hit") {
      expect(decision.result).toBe(fakeEntry.result);
    }
  });

  it("캐시 미스 + force=false → call-api", () => {
    const decision = decideAnalysis({
      cacheKey: "missing-key",
      force: false,
      readCache: () => null,
    });
    expect(decision.type).toBe("call-api");
  });

  it("캐시 히트여도 force=true면 무조건 call-api (강제 재분석)", () => {
    const decision = decideAnalysis({
      cacheKey: "k",
      force: true,
      readCache: (key) => (key === "k" ? fakeEntry : null),
    });
    expect(decision.type).toBe("call-api");
  });

  it("readCache는 넘겨준 cacheKey로만 조회한다", () => {
    let queriedWith: string | null = null;
    decideAnalysis({
      cacheKey: "the-key",
      force: false,
      readCache: (key) => {
        queriedWith = key;
        return null;
      },
    });
    expect(queriedWith).toBe("the-key");
  });
});
