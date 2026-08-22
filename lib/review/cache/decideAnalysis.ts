import type { RowAnalysis } from "@/lib/schema/rowAnalysis";
import type { CacheEntry } from "./rowCache";

export type AnalysisDecision =
  | { type: "cache-hit"; result: RowAnalysis }
  | { type: "call-api" };

// Same-input-skips-API / force-bypasses-cache decision, extracted as a pure
// function so it's testable without fetch or React (DATA_CONTRACT §5.3).
export function decideAnalysis(params: {
  cacheKey: string;
  force: boolean;
  readCache: (key: string) => CacheEntry | null;
}): AnalysisDecision {
  if (!params.force) {
    const cached = params.readCache(params.cacheKey);
    if (cached) return { type: "cache-hit", result: cached.result };
  }
  return { type: "call-api" };
}
