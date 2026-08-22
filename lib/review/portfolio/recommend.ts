import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicConfig } from "@/lib/review/env";
import { TOOL_NAME, SYSTEM_PROMPT, PORTFOLIO_PROMPT_VERSION, buildUserMessage, buildToolInputSchema } from "@/lib/review/prompts/portfolio.v1";
import { portfolioRecommendationSchema, type PortfolioRecommendationAi } from "@/lib/schema/portfolioRecommendation";
import type { PortfolioAnalysis } from "./types";
import { SchemaValidationError } from "@/lib/review/analyzeRow";

// 실패 시 최대 2회 재시도 (CLAUDE.md §2-5) → 총 시도 3회. analyzeRow.ts와 동일한 정책.
const MAX_ATTEMPTS = 3;

export type CallModelFn = (params: {
  apiKey: string;
  model: string;
  system: string;
  userMessage: string;
  toolSchema: ReturnType<typeof buildToolInputSchema>;
}) => Promise<unknown>;

const defaultCallModel: CallModelFn = async ({ apiKey, model, system, userMessage, toolSchema }) => {
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model,
    max_tokens: 2048,
    system,
    messages: [{ role: "user", content: userMessage }],
    tools: [
      {
        name: TOOL_NAME,
        description: "포트폴리오 통계를 근거로 다음 실험 방향을 추천한다.",
        input_schema: toolSchema as Anthropic.Tool.InputSchema,
      },
    ],
    tool_choice: { type: "tool", name: TOOL_NAME },
  });

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
  );
  if (!toolUse) {
    throw new Error("Claude 응답에 tool_use 블록이 없습니다.");
  }
  return toolUse.input;
};

export type RecommendResult = {
  recommendation: PortfolioRecommendationAi;
  meta: { model: string; promptVersion: string; elapsedMs: number };
};

export async function getPortfolioRecommendation(
  portfolio: PortfolioAnalysis,
  overrides?: { callModel?: CallModelFn; now?: () => number },
): Promise<RecommendResult> {
  const { apiKey, model } = getAnthropicConfig();
  const callModel = overrides?.callModel ?? defaultCallModel;
  const now = overrides?.now ?? Date.now;

  const userMessage = buildUserMessage(portfolio);
  const toolSchema = buildToolInputSchema();

  const start = now();
  let lastErrorDetail = "";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const raw = await callModel({ apiKey, model, system: SYSTEM_PROMPT, userMessage, toolSchema });
    const parsed = portfolioRecommendationSchema.safeParse(raw);
    if (parsed.success) {
      const elapsedMs = now() - start;
      return {
        recommendation: parsed.data,
        meta: { model, promptVersion: PORTFOLIO_PROMPT_VERSION, elapsedMs },
      };
    }
    lastErrorDetail = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
  }

  throw new SchemaValidationError(lastErrorDetail);
}
