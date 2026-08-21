import { z } from "zod";

export const PROMPT_VERSION = "v3" as const;

const evidence = z.string().min(1);

// ---------------------------------------------------------------------------
// Hygiene Gate
// ---------------------------------------------------------------------------

const hygieneGateSchema = z.object({
  pass: z.boolean(),
  evidence,
});

export const hygieneSchema = z.object({
  gates: z.object({
    G1_self_contained: hygieneGateSchema,
    G2_discovery: hygieneGateSchema,
    G3_narrative: hygieneGateSchema,
    G4_causal_structure: hygieneGateSchema,
  }),
  // AI가 채워 보내지만 서버가 항상 재계산해 덮어쓴다 (CLAUDE.md §2-6, DATA_CONTRACT §2.3).
  passedCount: z.number().int().min(0).max(4),
  grade: z.enum(["A", "B", "FAIL"]),
});

export type Hygiene = z.infer<typeof hygieneSchema>;

// ---------------------------------------------------------------------------
// Critical Gate — Reference / Draft Core Appeal, Appeal Transfer, Curiosity, Search
// ---------------------------------------------------------------------------

const referenceCoreSchema = z.object({
  coreAppeal: z.string().min(1),
  viralEngine: z.string().min(1),
});

const appealTransferSchema = z.object({
  value: z.enum(["STRONG", "PARTIAL", "MISMATCH"]),
  evidence,
  deviationPoint: z.string().min(1).nullable(),
});

const productCuriositySchema = z.object({
  value: z.enum(["STRONG", "MEDIUM", "WEAK"]),
  evidence,
});

const searchMotivationSchema = z.object({
  value: z.enum(["STRONG", "MEDIUM", "WEAK"]),
  evidence,
  liftDirection: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Reconstruction Quality
// ---------------------------------------------------------------------------

const personaEventSchema = z
  .object({
    value: z.enum(["CHANGED", "SAME", "NOT_APPLICABLE"]),
    referenceSummary: z.string().min(1),
    draftSummary: z.string().min(1),
    evidence,
  })
  .strict();

const deficiencyTriggerSchema = z
  .object({
    value: z.enum(["CHANGED", "SAME", "ADDED", "NOT_APPLICABLE"]),
    referenceSummary: z.string().min(1).nullable(),
    draftSummary: z.string().min(1),
    evidence,
  })
  .superRefine((v, ctx) => {
    if (v.value === "ADDED" && v.referenceSummary !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "deficiencyTrigger.value가 ADDED이면 referenceSummary는 null이어야 합니다.",
        path: ["referenceSummary"],
      });
    }
    if (v.value !== "ADDED" && v.referenceSummary === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "deficiencyTrigger.value가 ADDED가 아니면 referenceSummary가 필요합니다.",
        path: ["referenceSummary"],
      });
    }
  });

const endingTypeEnum = z.enum([
  "정보 질문",
  "감정 질문",
  "선언",
  "관찰",
  "추천",
  "반전",
  "결론",
  "리스트 마감",
  "OTHER",
]);

const endingMethodSchema = z.object({
  value: z.enum(["CHANGED", "SAME", "NOT_APPLICABLE"]),
  referenceType: endingTypeEnum,
  draftType: endingTypeEnum,
  evidence,
});

const obstacleSchema = z
  .object({
    referenceHasObstacle: z.boolean(),
    draftHasObstacle: z.boolean(),
    functionPreserved: z.boolean().nullable(),
    detailsTransformed: z.boolean().nullable(),
    evidence,
  })
  .superRefine((v, ctx) => {
    if (!v.referenceHasObstacle) {
      if (v.functionPreserved !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "referenceHasObstacle이 false이면 functionPreserved는 null이어야 합니다.",
          path: ["functionPreserved"],
        });
      }
      if (v.detailsTransformed !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "referenceHasObstacle이 false이면 detailsTransformed는 null이어야 합니다.",
          path: ["detailsTransformed"],
        });
      }
    } else {
      if (v.functionPreserved === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "referenceHasObstacle이 true이면 functionPreserved는 boolean이어야 합니다.",
          path: ["functionPreserved"],
        });
      }
      if (v.detailsTransformed === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "referenceHasObstacle이 true이면 detailsTransformed는 boolean이어야 합니다.",
          path: ["detailsTransformed"],
        });
      }
    }
  });

const surfaceCloneRiskSchema = z.object({
  value: z.enum(["LOW", "MEDIUM", "HIGH"]),
  quotedFragments: z.array(z.string().max(500)),
  evidence,
});

const reconstructionSchema = z.object({
  persona: personaEventSchema,
  event: personaEventSchema,
  deficiencyTrigger: deficiencyTriggerSchema,
  endingMethod: endingMethodSchema,
  obstacle: obstacleSchema,
  surfaceCloneRisk: surfaceCloneRiskSchema,
  // 아래 3개는 AI가 채워 보내지만 서버가 항상 재계산해 덮어쓴다 (RECONSTRUCTION_RULES §6).
  unchangedCount: z.number().int().min(0).max(4),
  applicableCount: z.number().int().min(0).max(4),
  verdict: z.enum(["TRANSFORMED", "BORDERLINE", "TOO_CLOSE"]),
  evidence: z.string().min(1),
  revisionDirection: z.string().min(1),
});

export type Reconstruction = z.infer<typeof reconstructionSchema>;

// ---------------------------------------------------------------------------
// Diagnostic
// ---------------------------------------------------------------------------

function otherableEnum<T extends [string, ...string[]]>(values: T) {
  return z
    .object({
      value: z.enum([...values, "OTHER"] as [string, ...string[]]),
      otherLabel: z.string().min(1).nullable(),
    })
    .superRefine((v, ctx) => {
      if (v.value === "OTHER" && v.otherLabel === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "value가 OTHER이면 otherLabel이 필요합니다.",
          path: ["otherLabel"],
        });
      }
      if (v.value !== "OTHER" && v.otherLabel !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "value가 OTHER가 아니면 otherLabel은 null이어야 합니다.",
          path: ["otherLabel"],
        });
      }
    });
}

const newPatternCandidateSchema = z.object({
  whyDifferent: z.string().min(1),
  structureSummary: z.string().min(1),
  proposedName: z.string().min(1),
  linguisticFeatures: z.array(z.string().min(1)).min(1),
});

const HOOK_CODES = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M"] as const;

const diagnosticSchema = z
  .object({
    hookCode: z.enum([...HOOK_CODES, "NEW_PATTERN_CANDIDATE"]),
    hookCodeReason: z.string().min(1),
    newPatternCandidate: newPatternCandidateSchema.nullable(),

    emotion: otherableEnum(["절박함", "시크함", "순수감탄", "놀람"]),
    speaker: otherableEnum(["본인 1인칭", "딸-엄마 관찰", "친구-친구 관찰", "순수 목격자"]),
    disclosureMode: otherableEnum(["직접서술", "리스트", "대화체", "선언문"]),

    listHomogeneity: z.object({
      applicable: z.boolean(),
      pass: z.boolean(),
      evidence: z.string().min(1),
    }),
    salesMessageStandsOut: z.object({
      pass: z.boolean(),
      evidence: z.string().min(1),
    }),

    healthClaimsToVerify: z.array(z.string().min(1)),
    topProblems: z.array(z.string().min(1)).min(1).max(3),
    revisionDirection: z.string().min(1),
  })
  .superRefine((v, ctx) => {
    if (v.hookCode === "NEW_PATTERN_CANDIDATE" && v.newPatternCandidate === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "hookCode가 NEW_PATTERN_CANDIDATE이면 newPatternCandidate가 필요합니다.",
        path: ["newPatternCandidate"],
      });
    }
    if (v.hookCode !== "NEW_PATTERN_CANDIDATE" && v.newPatternCandidate !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "hookCode가 NEW_PATTERN_CANDIDATE가 아니면 newPatternCandidate는 null이어야 합니다.",
        path: ["newPatternCandidate"],
      });
    }
  });

// ---------------------------------------------------------------------------
// Final Verdict (AI가 채워 보내지만 서버가 항상 재계산해 덮어쓴다)
// ---------------------------------------------------------------------------

const finalVerdictSchema = z.object({
  value: z.enum(["READY", "NEEDS_REVISION", "FAIL"]),
  reasons: z.array(z.string().min(1)),
});

// ---------------------------------------------------------------------------
// Top level — refExists 여부에 따라 critical 모양이 달라진다 (DATA_CONTRACT §2.3)
// ---------------------------------------------------------------------------

export const rowAnalysisAiSchemaRefExists = z.object({
  hygiene: hygieneSchema,
  critical: z.object({
    reference: referenceCoreSchema,
    draftCoreAppeal: z.string().min(1),
    appealTransfer: appealTransferSchema,
    productCuriosity: productCuriositySchema,
    searchMotivation: searchMotivationSchema,
    reconstruction: reconstructionSchema,
  }),
  diagnostic: diagnosticSchema,
  finalVerdict: finalVerdictSchema,
});

export const rowAnalysisAiSchemaNoRef = z.object({
  hygiene: hygieneSchema,
  critical: z.object({
    reference: z.null(),
    draftCoreAppeal: z.string().min(1),
    appealTransfer: z.null(),
    productCuriosity: productCuriositySchema,
    searchMotivation: searchMotivationSchema,
    reconstruction: z.null(),
  }),
  diagnostic: diagnosticSchema,
  finalVerdict: finalVerdictSchema,
});

export type RowAnalysisAiRefExists = z.infer<typeof rowAnalysisAiSchemaRefExists>;
export type RowAnalysisAiNoRef = z.infer<typeof rowAnalysisAiSchemaNoRef>;
export type RowAnalysisAi = RowAnalysisAiRefExists | RowAnalysisAiNoRef;

export function getRowAnalysisAiSchema(refExists: boolean) {
  return refExists ? rowAnalysisAiSchemaRefExists : rowAnalysisAiSchemaNoRef;
}

// ---------------------------------------------------------------------------
// Full response sent to the client: AI-validated body + server-computed index/meta.
// ---------------------------------------------------------------------------

export type RowAnalysisMeta = {
  model: string;
  promptVersion: string;
  elapsedMs: number;
};

export type RowAnalysis = RowAnalysisAi & {
  index: number;
  meta: RowAnalysisMeta;
};

// ---------------------------------------------------------------------------
// Request schema: POST /api/review/analyze-row
// ---------------------------------------------------------------------------

export const analyzeRowRequestSchema = z.object({
  index: z.number().int().min(0),
  draft: z.string().min(1),
  refOriginal: z.string().nullable(),
  refUrl: z.string().nullable(),
});

export type AnalyzeRowRequest = z.infer<typeof analyzeRowRequestSchema>;
