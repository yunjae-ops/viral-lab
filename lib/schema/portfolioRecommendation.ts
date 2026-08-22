import { z } from "zod";

export const portfolioRecommendationSchema = z.object({
  text: z.string().min(1),
  suggestedAngles: z.array(z.string().min(1)).min(1).max(5),
});

export type PortfolioRecommendationAi = z.infer<typeof portfolioRecommendationSchema>;

export const portfolioRequestRowSchema = z.object({
  index: z.number().int().min(0),
  hasReference: z.boolean(),
  hygieneGrade: z.enum(["A", "B", "FAIL"]),
  hookCode: z.string().min(1),
  emotion: z.string().min(1),
  speaker: z.string().min(1),
  disclosureMode: z.string().min(1),
  appealTransfer: z.enum(["STRONG", "PARTIAL", "MISMATCH", "N/A"]),
  productCuriosity: z.enum(["STRONG", "MEDIUM", "WEAK"]),
  searchMotivation: z.enum(["STRONG", "MEDIUM", "WEAK"]),
  finalVerdict: z.enum(["READY", "NEEDS_REVISION", "FAIL"]),
  reconstructionVerdict: z.enum(["TRANSFORMED", "BORDERLINE", "TOO_CLOSE", "N/A"]),
  surfaceCloneRisk: z.enum(["LOW", "MEDIUM", "HIGH", "N/A"]),
  personaSame: z.boolean(),
  personaApplicable: z.boolean(),
  eventSame: z.boolean(),
  eventApplicable: z.boolean(),
  deficiencyTriggerSame: z.boolean(),
  deficiencyTriggerApplicable: z.boolean(),
  endingSame: z.boolean(),
  endingApplicable: z.boolean(),
  referenceHasObstacle: z.boolean(),
  obstacleDeleted: z.boolean(),
  obstacleFunctionPreserved: z.boolean(),
  obstacleDetailCloned: z.boolean(),
  newPatternCandidate: z
    .object({
      proposedName: z.string().min(1),
      whyDifferent: z.string().min(1),
      structureSummary: z.string().min(1),
      linguisticFeatures: z.array(z.string().min(1)),
    })
    .nullable(),
});

export const portfolioRequestSchema = z.object({
  rows: z.array(portfolioRequestRowSchema),
});

export type PortfolioRequest = z.infer<typeof portfolioRequestSchema>;
