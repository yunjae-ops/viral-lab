"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { aggregatePortfolio } from "@/lib/review/portfolio/aggregate";
import type { PortfolioRow, PortfolioRecommendation } from "@/lib/review/portfolio/types";
import {
  computePortfolioSummaryKey,
  readPortfolioRecommendationCache,
  writePortfolioRecommendationCache,
} from "@/lib/review/cache/portfolioCache";

type ApiErrorBody = { error: string; detail: string };

export function usePortfolioAnalysis(portfolioRows: PortfolioRow[]) {
  const portfolio = useMemo(() => aggregatePortfolio(portfolioRows), [portfolioRows]);

  const [cacheKey, setCacheKey] = useState<string | null>(null);
  const [recommendation, setRecommendation] = useState<PortfolioRecommendation | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  // 통계(portfolio)가 바뀌면 이전 추천은 무효 — 새 요약 키로 캐시부터 다시 확인한다.
  useEffect(() => {
    let cancelled = false;
    setRecommendation(null);
    setFromCache(false);
    setStatus("idle");
    setError(null);
    if (portfolio.totalAnalyzed === 0) {
      setCacheKey(null);
      return;
    }
    (async () => {
      const key = await computePortfolioSummaryKey(portfolio);
      if (cancelled) return;
      setCacheKey(key);
      const cached = readPortfolioRecommendationCache(key);
      if (cached) {
        setRecommendation(cached.recommendation);
        setFromCache(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(portfolio)]);

  const fetchRecommendation = useCallback(async () => {
    if (!cacheKey || portfolioRows.length === 0) return;
    setStatus("loading");
    setError(null);
    try {
      const res = await fetch("/api/review/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: portfolioRows }),
      });
      const body = (await res.json()) as ({ recommendation: PortfolioRecommendation } & Record<string, unknown>) | ApiErrorBody;
      if (!res.ok || "error" in body) {
        const errBody = body as ApiErrorBody;
        setError(`${errBody.error}: ${errBody.detail}`);
        setStatus("error");
        return;
      }
      writePortfolioRecommendationCache(cacheKey, body.recommendation);
      setRecommendation(body.recommendation);
      setFromCache(false);
      setStatus("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : "알 수 없는 오류");
      setStatus("error");
    }
  }, [cacheKey, portfolioRows]);

  return { portfolio, recommendation, fromCache, status, error, fetchRecommendation };
}
