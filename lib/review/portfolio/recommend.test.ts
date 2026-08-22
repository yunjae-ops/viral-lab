import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getPortfolioRecommendation, type CallModelFn } from "./recommend";
import { aggregatePortfolio } from "./aggregate";
import { SchemaValidationError } from "@/lib/review/analyzeRow";

// recommend.ts는 process.env.VIRAL_LAB_ANTHROPIC_API_KEY/MODEL을 통해서만 동작하므로
// (analyzeRow.ts와 동일한 설계) 더미 값을 세팅해준다 — 실제 네트워크 호출은
// callModel을 주입해 완전히 가로채므로 이 키가 실제 API에 쓰이지 않는다.
beforeEach(() => {
  process.env.VIRAL_LAB_ANTHROPIC_API_KEY = "test-key";
  process.env.VIRAL_LAB_ANTHROPIC_MODEL = "test-model";
});

afterEach(() => {
  delete process.env.VIRAL_LAB_ANTHROPIC_API_KEY;
  delete process.env.VIRAL_LAB_ANTHROPIC_MODEL;
});

const emptyPortfolio = aggregatePortfolio([]);

describe("getPortfolioRecommendation", () => {
  it("첫 시도에 유효한 응답이면 바로 반환하고 실제 fetch/네트워크를 타지 않는다", async () => {
    let calls = 0;
    const callModel: CallModelFn = async () => {
      calls++;
      return { text: "추천 텍스트", suggestedAngles: ["L × 친구관찰 × 대화체"] };
    };
    const { recommendation, meta } = await getPortfolioRecommendation(emptyPortfolio, { callModel });
    expect(calls).toBe(1);
    expect(recommendation.text).toBe("추천 텍스트");
    expect(recommendation.suggestedAngles).toHaveLength(1);
    expect(meta.model).toBe("test-model");
    expect(meta.promptVersion).toBe("v1");
  });

  it("스키마 검증 실패 시 최대 2회 재시도 후 성공하면 반환한다", async () => {
    let calls = 0;
    const callModel: CallModelFn = async () => {
      calls++;
      if (calls < 3) return { text: "" }; // suggestedAngles 누락 + text 빈 문자열 → 검증 실패
      return { text: "세 번째 성공", suggestedAngles: ["A × B × C"] };
    };
    const { recommendation } = await getPortfolioRecommendation(emptyPortfolio, { callModel });
    expect(calls).toBe(3);
    expect(recommendation.text).toBe("세 번째 성공");
  });

  it("3회 모두 실패하면 SchemaValidationError를 던진다", async () => {
    let calls = 0;
    const callModel: CallModelFn = async () => {
      calls++;
      return { text: "", suggestedAngles: [] };
    };
    await expect(getPortfolioRecommendation(emptyPortfolio, { callModel })).rejects.toBeInstanceOf(
      SchemaValidationError,
    );
    expect(calls).toBe(3);
  });

  it("suggestedAngles가 5개를 넘으면 스키마 검증 실패로 처리된다", async () => {
    const callModel: CallModelFn = async () => ({
      text: "t",
      suggestedAngles: ["1", "2", "3", "4", "5", "6"],
    });
    await expect(getPortfolioRecommendation(emptyPortfolio, { callModel })).rejects.toBeInstanceOf(
      SchemaValidationError,
    );
  });
});
