import { PORTFOLIO_PROMPT_VERSION } from "@/lib/review/prompts/portfolio.v1";
import type { PortfolioAnalysis, PortfolioRecommendation } from "@/lib/review/portfolio/types";

// Portfolio Summary(집계 통계) 기준 추천 캐시. 같은 통계에 대해 Claude를 반복 호출하지
// 않기 위함 (CLAUDE.md §2-16, Phase 4 §15). rowCache와 동일한 SHA-256 방식이지만
// 별도 네임스페이스를 쓴다 — draft/refOriginal 캐시와는 무효화 조건이 다르기 때문.
const PREFIX = `viral-lab:review:portfolio:${PORTFOLIO_PROMPT_VERSION}:`;

export type PortfolioRecommendationEntry = {
  key: string;
  promptVersion: string;
  analyzedAt: string;
  recommendation: PortfolioRecommendation;
};

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// 집계 통계(portfolio)만 해시 재료로 쓴다 — recommendation 자체는 제외.
export async function computePortfolioSummaryKey(portfolio: PortfolioAnalysis): Promise<string> {
  const material = JSON.stringify(portfolio);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(material));
  return `${PREFIX}${toHex(digest)}`;
}

export function readPortfolioRecommendationCache(key: string): PortfolioRecommendationEntry | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PortfolioRecommendationEntry;
    if (parsed.promptVersion !== PORTFOLIO_PROMPT_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writePortfolioRecommendationCache(key: string, recommendation: PortfolioRecommendation): void {
  if (typeof window === "undefined") return;
  const entry: PortfolioRecommendationEntry = {
    key,
    promptVersion: PORTFOLIO_PROMPT_VERSION,
    analyzedAt: new Date().toISOString(),
    recommendation,
  };
  try {
    window.localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // 캐시는 최적화일 뿐이라 조용히 포기한다 (rowCache와 동일한 정책).
  }
}
