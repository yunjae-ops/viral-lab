import { PROMPT_VERSION, type RowAnalysis } from "@/lib/schema/rowAnalysis";

// localStorage row-level cache (CLAUDE.md §2-16, DATA_CONTRACT §5).
// Key material: draft + "␞" + (refOriginal ?? "") + "␞" + promptVersion.
// Prefix changes with promptVersion so a schema/prompt bump invalidates
// everything automatically — no manual migration needed.
const RECORD_SEPARATOR = "␞";
const CACHE_PREFIX = `viral-lab:review:${PROMPT_VERSION}:`;

// Soft ceiling before we start evicting the oldest entries (LRU-lite, DATA_CONTRACT §5.3).
const MAX_CACHE_BYTES = 4 * 1024 * 1024 * 0.9;

export type CacheEntry = {
  key: string;
  promptVersion: string;
  analyzedAt: string;
  result: RowAnalysis;
};

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function computeCacheKey(draft: string, refOriginal: string | null): Promise<string> {
  const material = `${draft}${RECORD_SEPARATOR}${refOriginal ?? ""}${RECORD_SEPARATOR}${PROMPT_VERSION}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(material));
  return `${CACHE_PREFIX}${toHex(digest)}`;
}

export function readCacheEntry(storageKey: string): CacheEntry | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry;
    if (parsed.promptVersion !== PROMPT_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

function listCacheKeys(): string[] {
  if (typeof window === "undefined") return [];
  const keys: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    if (k && k.startsWith(CACHE_PREFIX)) keys.push(k);
  }
  return keys;
}

function currentCacheBytes(excludeKey?: string): number {
  let total = 0;
  for (const k of listCacheKeys()) {
    if (k === excludeKey) continue;
    const raw = window.localStorage.getItem(k);
    if (raw) total += raw.length * 2; // UTF-16 code units → approx bytes
  }
  return total;
}

function evictOldestUntilFits(incomingBytes: number, protectedKey: string): void {
  const entries = listCacheKeys()
    .filter((k) => k !== protectedKey)
    .map((k) => {
      const entry = readCacheEntry(k);
      return { key: k, analyzedAt: entry?.analyzedAt ?? "" };
    })
    .sort((a, b) => a.analyzedAt.localeCompare(b.analyzedAt));

  let total = currentCacheBytes(protectedKey) + incomingBytes;
  for (const e of entries) {
    if (total <= MAX_CACHE_BYTES) break;
    const raw = window.localStorage.getItem(e.key);
    if (raw) total -= raw.length * 2;
    window.localStorage.removeItem(e.key);
  }
}

export function writeCacheEntry(storageKey: string, result: RowAnalysis): void {
  if (typeof window === "undefined") return;
  const entry: CacheEntry = {
    key: storageKey,
    promptVersion: PROMPT_VERSION,
    analyzedAt: new Date().toISOString(),
    result,
  };
  const serialized = JSON.stringify(entry);

  evictOldestUntilFits(serialized.length * 2, storageKey);

  try {
    window.localStorage.setItem(storageKey, serialized);
  } catch {
    // Quota hit despite pre-eviction (e.g. one huge entry) — evict harder and retry once.
    evictOldestUntilFits(serialized.length * 2, storageKey);
    try {
      window.localStorage.setItem(storageKey, serialized);
    } catch {
      // Give up silently — cache is a performance optimization, not correctness-critical.
    }
  }
}

export function clearAllRowCache(): void {
  if (typeof window === "undefined") return;
  for (const k of listCacheKeys()) window.localStorage.removeItem(k);
}
