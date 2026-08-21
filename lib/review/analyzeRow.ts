import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicConfig } from "./env";
import {
  TOOL_NAME,
  SYSTEM_PROMPT,
  PROMPT_VERSION,
  buildUserMessage,
  buildToolInputSchema,
} from "./prompts/analyzeRow.v3";
import {
  getRowAnalysisAiSchema,
  type RowAnalysisAi,
  type RowAnalysisAiRefExists,
  type RowAnalysisMeta,
} from "@/lib/schema/rowAnalysis";
import { recomputeHygiene } from "./verdict/hygiene";
import { recomputeReconstruction } from "./verdict/reconstruction";
import { computeFinalVerdict } from "./verdict/finalVerdict";

// 실패 시 최대 2회 재시도 (CLAUDE.md §2-5) → 총 시도 3회.
const MAX_ATTEMPTS = 3;

export class SchemaValidationError extends Error {
  detail: string;
  constructor(detail: string) {
    super("SCHEMA_VALIDATION_FAILED");
    this.name = "SchemaValidationError";
    this.detail = detail;
  }
}

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
    max_tokens: 4096,
    temperature: 0.2,
    system,
    messages: [{ role: "user", content: userMessage }],
    tools: [
      {
        name: TOOL_NAME,
        description:
          "Threads 콘텐츠 작성안 1건에 대한 Hygiene/Critical/Reconstruction/Diagnostic/FinalVerdict 분석 결과를 제출한다.",
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

export type AnalyzeRowResult = {
  ai: RowAnalysisAi;
  meta: RowAnalysisMeta;
};

export async function analyzeRow(
  params: { draft: string; refOriginal: string | null },
  overrides?: { callModel?: CallModelFn; now?: () => number },
): Promise<AnalyzeRowResult> {
  const { draft, refOriginal } = params;
  const refExists = refOriginal !== null && refOriginal.trim() !== "";

  const { apiKey, model } = getAnthropicConfig();
  const callModel = overrides?.callModel ?? defaultCallModel;
  const now = overrides?.now ?? Date.now;

  const system = SYSTEM_PROMPT;
  const userMessage = buildUserMessage({ draft, refOriginal });
  const toolSchema = buildToolInputSchema(refExists);
  const zodSchema = getRowAnalysisAiSchema(refExists);

  const start = now();
  let lastErrorDetail = "";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const raw = await callModel({ apiKey, model, system, userMessage, toolSchema });
    const parsed = zodSchema.safeParse(raw);
    if (parsed.success) {
      const elapsedMs = now() - start;
      const ai = applyDeterministicOverrides(parsed.data as RowAnalysisAi, refExists);
      return { ai, meta: { model, promptVersion: PROMPT_VERSION, elapsedMs } };
    }
    lastErrorDetail = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
  }

  throw new SchemaValidationError(lastErrorDetail);
}

/**
 * AI가 임의로 확정하면 안 되는 값들을 서버 규칙으로 재계산해 덮어쓴다
 * (CLAUDE.md §2-6, §2-11, §2-11a / DATA_CONTRACT §2.3, §2.4 / RECONSTRUCTION_RULES §6, §9).
 */
function applyDeterministicOverrides(ai: RowAnalysisAi, refExists: boolean): RowAnalysisAi {
  const hygiene = recomputeHygiene(ai.hygiene);

  if (!refExists) {
    const finalVerdict = computeFinalVerdict({
      refExists: false,
      hygieneGrade: hygiene.grade,
      searchMotivation: ai.critical.searchMotivation.value,
      appealTransfer: null,
      reconstructionVerdict: null,
      surfaceCloneRisk: null,
    });
    return { ...ai, hygiene, finalVerdict };
  }

  const withRef = ai as RowAnalysisAiRefExists;
  const reconstruction = recomputeReconstruction(withRef.critical.reconstruction);
  const finalVerdict = computeFinalVerdict({
    refExists: true,
    hygieneGrade: hygiene.grade,
    searchMotivation: withRef.critical.searchMotivation.value,
    appealTransfer: withRef.critical.appealTransfer.value,
    reconstructionVerdict: reconstruction.verdict,
    surfaceCloneRisk: reconstruction.surfaceCloneRisk.value,
  });

  return {
    ...withRef,
    hygiene,
    critical: { ...withRef.critical, reconstruction },
    finalVerdict,
  };
}
