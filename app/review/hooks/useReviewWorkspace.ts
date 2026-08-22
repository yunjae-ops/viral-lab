"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ParsedRow } from "@/lib/excel/parse";
import type { RowAnalysis } from "@/lib/schema/rowAnalysis";
import { computeCacheKey, readCacheEntry, writeCacheEntry, clearAllRowCache } from "@/lib/review/cache/rowCache";
import { decideAnalysis } from "@/lib/review/cache/decideAnalysis";
import { runWithConcurrency } from "@/lib/review/batch/runWithConcurrency";

// CLAUDE.md §2-20 / DATA_CONTRACT §1.10 — 배치 동시성 기본값 3.
export const DEFAULT_CONCURRENCY = 3;

export type RowStatus = "CACHED" | "WAITING" | "ANALYZING" | "COMPLETED" | "FAILED";

export type RowState = {
  status: RowStatus;
  cacheKey: string | null;
  result: RowAnalysis | null;
  error: string | null;
};

type ApiErrorBody = { error: string; detail: string };

const initialRowState: RowState = { status: "WAITING", cacheKey: null, result: null, error: null };

export function useReviewWorkspace(rows: ParsedRow[]) {
  const [states, setStates] = useState<Record<number, RowState>>({});
  const [scanning, setScanning] = useState(true);
  const [isBatchRunning, setIsBatchRunning] = useState(false);

  const patchState = useCallback((index: number, patch: Partial<RowState>) => {
    setStates((prev) => ({ ...prev, [index]: { ...(prev[index] ?? initialRowState), ...patch } }));
  }, []);

  // Excel이 (재)업로드될 때마다 각 행의 cache key를 계산하고 기존 캐시를 조회한다.
  // API 호출 없이 로컬에서만 수행 — 새로고침/재업로드 후 결과 복구(§6)의 핵심 경로.
  useEffect(() => {
    let cancelled = false;
    setScanning(true);
    (async () => {
      const next: Record<number, RowState> = {};
      for (const row of rows) {
        const cacheKey = await computeCacheKey(row.draft, row.refOriginal);
        const cached = readCacheEntry(cacheKey);
        next[row.index] = cached
          ? { status: "CACHED", cacheKey, result: cached.result, error: null }
          : { status: "WAITING", cacheKey, result: null, error: null };
      }
      if (!cancelled) {
        setStates(next);
        setScanning(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rows]);

  const analyzeOne = useCallback(
    async (row: ParsedRow, force: boolean) => {
      const cacheKey = states[row.index]?.cacheKey ?? (await computeCacheKey(row.draft, row.refOriginal));
      const decision = decideAnalysis({ cacheKey, force, readCache: readCacheEntry });
      if (decision.type === "cache-hit") {
        patchState(row.index, { status: "CACHED", cacheKey, result: decision.result, error: null });
        return;
      }
      patchState(row.index, { status: "ANALYZING", cacheKey, error: null });
      try {
        const res = await fetch("/api/review/analyze-row", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            index: row.index,
            draft: row.draft,
            refOriginal: row.refOriginal,
            refUrl: row.refUrl,
          }),
        });
        const body = (await res.json()) as RowAnalysis | ApiErrorBody;
        if (!res.ok || "error" in body) {
          const errBody = body as ApiErrorBody;
          patchState(row.index, { status: "FAILED", error: `${errBody.error}: ${errBody.detail}` });
          return;
        }
        writeCacheEntry(cacheKey, body);
        patchState(row.index, { status: "COMPLETED", result: body, error: null });
      } catch (e) {
        patchState(row.index, {
          status: "FAILED",
          error: e instanceof Error ? e.message : "알 수 없는 오류",
        });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [patchState],
  );

  const runQueue = useCallback(
    async (targets: ParsedRow[], force: boolean) => {
      if (targets.length === 0) return;
      setIsBatchRunning(true);
      await runWithConcurrency(targets, DEFAULT_CONCURRENCY, (row) => analyzeOne(row, force));
      setIsBatchRunning(false);
    },
    [analyzeOne],
  );

  const startBatch = useCallback(() => {
    const targets = rows.filter((r) => states[r.index]?.status === "WAITING");
    void runQueue(targets, false);
  }, [rows, states, runQueue]);

  const retryFailed = useCallback(() => {
    const targets = rows.filter((r) => states[r.index]?.status === "FAILED");
    void runQueue(targets, false);
  }, [rows, states, runQueue]);

  const retryOne = useCallback(
    (index: number) => {
      const row = rows.find((r) => r.index === index);
      if (row) void analyzeOne(row, false);
    },
    [rows, analyzeOne],
  );

  const forceReanalyzeOne = useCallback(
    (index: number) => {
      const row = rows.find((r) => r.index === index);
      if (row) void analyzeOne(row, true);
    },
    [rows, analyzeOne],
  );

  const clearCache = useCallback(() => {
    clearAllRowCache();
    setStates((prev) => {
      const next: Record<number, RowState> = {};
      for (const row of rows) {
        next[row.index] = { status: "WAITING", cacheKey: prev[row.index]?.cacheKey ?? null, result: null, error: null };
      }
      return next;
    });
  }, [rows]);

  const summary = useMemo(() => {
    let cached = 0;
    let waiting = 0;
    let analyzing = 0;
    let completed = 0;
    let failed = 0;
    for (const row of rows) {
      const s = states[row.index]?.status;
      if (s === "CACHED") cached++;
      else if (s === "ANALYZING") analyzing++;
      else if (s === "COMPLETED") completed++;
      else if (s === "FAILED") failed++;
      else waiting++;
    }
    return {
      total: rows.length,
      cached,
      waiting,
      analyzing,
      completed,
      failed,
      done: cached + completed,
    };
  }, [rows, states]);

  return {
    states,
    scanning,
    isBatchRunning,
    summary,
    startBatch,
    retryFailed,
    retryOne,
    forceReanalyzeOne,
    clearCache,
  };
}
