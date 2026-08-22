import { describe, it, expect, beforeEach } from "vitest";

// Minimal in-memory localStorage polyfill — no jsdom needed, Node has a
// native Web Crypto `crypto.subtle` already, so this is the only piece
// rowCache.ts needs from a browser environment.
class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length() {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

(globalThis as unknown as { window: { localStorage: Storage } }).window = {
  localStorage: new MemoryStorage(),
};

import { computeCacheKey, readCacheEntry, writeCacheEntry, clearAllRowCache } from "./rowCache";
import { PROMPT_VERSION, type RowAnalysis } from "@/lib/schema/rowAnalysis";

function freshStorage() {
  (globalThis as unknown as { window: { localStorage: Storage } }).window = {
    localStorage: new MemoryStorage(),
  };
}

function fakeResult(overrides?: Partial<RowAnalysis>): RowAnalysis {
  return {
    index: 0,
    hygiene: {
      gates: {
        G1_self_contained: { pass: true, evidence: "e" },
        G2_discovery: { pass: true, evidence: "e" },
        G3_narrative: { pass: true, evidence: "e" },
        G4_causal_structure: { pass: true, evidence: "e" },
      },
      passedCount: 4,
      grade: "A",
    },
    critical: {
      reference: null,
      draftCoreAppeal: "appeal",
      appealTransfer: null,
      productCuriosity: { value: "STRONG", evidence: "e" },
      searchMotivation: { value: "STRONG", evidence: "e", liftDirection: "d" },
      reconstruction: null,
    },
    diagnostic: {
      hookCode: "A",
      hookCodeReason: "r",
      newPatternCandidate: null,
      emotion: { value: "시크함", otherLabel: null },
      speaker: { value: "본인 1인칭", otherLabel: null },
      disclosureMode: { value: "직접서술", otherLabel: null },
      listHomogeneity: { applicable: false, pass: true, evidence: "e" },
      salesMessageStandsOut: { pass: true, evidence: "e" },
      healthClaimsToVerify: [],
      topProblems: ["p"],
      revisionDirection: "d",
    },
    finalVerdict: { value: "READY", reasons: ["ok"] },
    meta: { model: "test-model", promptVersion: PROMPT_VERSION, elapsedMs: 1 },
    ...overrides,
  } as RowAnalysis;
}

describe("rowCache", () => {
  beforeEach(() => {
    freshStorage();
  });

  it("동일 draft/refOriginal → 동일 key, 다르면 다른 key", async () => {
    const k1 = await computeCacheKey("같은 draft", "같은 ref");
    const k2 = await computeCacheKey("같은 draft", "같은 ref");
    expect(k1).toBe(k2);

    const k3 = await computeCacheKey("다른 draft", "같은 ref");
    expect(k3).not.toBe(k1);

    const k4 = await computeCacheKey("같은 draft", "다른 ref");
    expect(k4).not.toBe(k1);

    const k5 = await computeCacheKey("같은 draft", null);
    expect(k5).not.toBe(k1);
  });

  it("key에 현재 promptVersion 프리픽스가 포함된다", async () => {
    const key = await computeCacheKey("draft", null);
    expect(key.startsWith(`viral-lab:review:${PROMPT_VERSION}:`)).toBe(true);
  });

  it("write 후 read하면 동일 result를 돌려준다 (캐시 히트 → API 재호출 불필요)", async () => {
    const key = await computeCacheKey("draft", "ref");
    expect(readCacheEntry(key)).toBeNull();

    const result = fakeResult();
    writeCacheEntry(key, result);

    const entry = readCacheEntry(key);
    expect(entry).not.toBeNull();
    expect(entry?.result).toEqual(result);
    expect(entry?.promptVersion).toBe(PROMPT_VERSION);
  });

  it("draft가 바뀌면 cache miss", async () => {
    const key1 = await computeCacheKey("draft A", "ref");
    writeCacheEntry(key1, fakeResult());

    const key2 = await computeCacheKey("draft B", "ref");
    expect(readCacheEntry(key2)).toBeNull();
  });

  it("refOriginal이 바뀌면 cache miss", async () => {
    const key1 = await computeCacheKey("draft", "ref A");
    writeCacheEntry(key1, fakeResult());

    const key2 = await computeCacheKey("draft", "ref B");
    expect(readCacheEntry(key2)).toBeNull();
  });

  it("promptVersion이 다른 엔트리는 무시된다 (버전업 시 자연 무효화)", async () => {
    const key = await computeCacheKey("draft", "ref");
    // Simulate a stale entry from an older promptVersion sitting at the (hypothetically
    // colliding) same key — readCacheEntry must reject it rather than trust the payload.
    const stale = JSON.stringify({
      key,
      promptVersion: "v2",
      analyzedAt: new Date().toISOString(),
      result: fakeResult(),
    });
    window.localStorage.setItem(key, stale);
    expect(readCacheEntry(key)).toBeNull();
  });

  it("강제 재분석은 캐시 존재 여부와 무관하게 새로 호출해야 하므로, 쓰기 후 덮어쓰기가 가능하다", async () => {
    const key = await computeCacheKey("draft", "ref");
    writeCacheEntry(key, fakeResult({ finalVerdict: { value: "FAIL", reasons: ["old"] } }));
    writeCacheEntry(key, fakeResult({ finalVerdict: { value: "READY", reasons: ["new"] } }));
    expect(readCacheEntry(key)?.result.finalVerdict.value).toBe("READY");
  });

  it("clearAllRowCache는 이 앱 prefix의 엔트리만 지운다", async () => {
    const key = await computeCacheKey("draft", "ref");
    writeCacheEntry(key, fakeResult());
    window.localStorage.setItem("some-other-app:unrelated", "keep me");

    clearAllRowCache();

    expect(readCacheEntry(key)).toBeNull();
    expect(window.localStorage.getItem("some-other-app:unrelated")).toBe("keep me");
  });

  it("4MB 근처에서 오래된 엔트리부터 축출된다 (LRU-lite)", async () => {
    // ~1MB 문자열 4개를 순서대로 채우면 soft ceiling(~3.6MB)을 넘어서면서
    // 가장 오래된(analyzedAt 기준) 엔트리부터 밀려나야 한다.
    const bigChunk = "x".repeat(1024 * 1024); // ~1M chars → ~2MB as UTF-16 bytes
    const keys: string[] = [];
    for (let i = 0; i < 5; i++) {
      const key = await computeCacheKey(`draft-${i}`, null);
      keys.push(key);
      writeCacheEntry(key, fakeResult({ diagnostic: { ...fakeResult().diagnostic, revisionDirection: bigChunk } }));
      // analyzedAt은 Date.now() 기반이라 충분히 구분되도록 아주 짧게 대기.
      await new Promise((r) => setTimeout(r, 2));
    }

    // 가장 최근 엔트리는 반드시 남아 있어야 한다.
    expect(readCacheEntry(keys[keys.length - 1])).not.toBeNull();
    // 가장 오래된 엔트리는 용량 초과로 축출되어 사라졌어야 한다.
    expect(readCacheEntry(keys[0])).toBeNull();
  });
});
