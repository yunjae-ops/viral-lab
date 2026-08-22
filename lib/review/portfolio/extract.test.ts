import { describe, it, expect } from "vitest";
import { extractPortfolioRow } from "./extract";
import type { RowAnalysisAiRefExists, RowAnalysisAiNoRef } from "@/lib/schema/rowAnalysis";

function baseHygiene() {
  return {
    gates: {
      G1_self_contained: { pass: true, evidence: "e" },
      G2_discovery: { pass: true, evidence: "e" },
      G3_narrative: { pass: true, evidence: "e" },
      G4_causal_structure: { pass: true, evidence: "e" },
    },
    passedCount: 4,
    grade: "A" as const,
  };
}

function baseDiagnostic(overrides: Partial<RowAnalysisAiRefExists["diagnostic"]> = {}) {
  return {
    hookCode: "A" as const,
    hookCodeReason: "r",
    newPatternCandidate: null,
    emotion: { value: "시크함" as const, otherLabel: null },
    speaker: { value: "본인 1인칭" as const, otherLabel: null },
    disclosureMode: { value: "직접서술" as const, otherLabel: null },
    listHomogeneity: { applicable: false, pass: true, evidence: "e" },
    salesMessageStandsOut: { pass: true, evidence: "e" },
    healthClaimsToVerify: [],
    topProblems: ["p"],
    revisionDirection: "d",
    ...overrides,
  };
}

describe("extractPortfolioRow — 레퍼런스 있음", () => {
  const ai: RowAnalysisAiRefExists = {
    hygiene: baseHygiene(),
    critical: {
      reference: { coreAppeal: "appeal", viralEngine: "engine" },
      draftCoreAppeal: "draft appeal",
      appealTransfer: { value: "MISMATCH", evidence: "e", deviationPoint: null },
      productCuriosity: { value: "MEDIUM", evidence: "e" },
      searchMotivation: { value: "WEAK", evidence: "e", liftDirection: "d" },
      reconstruction: {
        persona: { value: "SAME", referenceSummary: "r", draftSummary: "d", evidence: "e" },
        event: { value: "CHANGED", referenceSummary: "r", draftSummary: "d", evidence: "e" },
        deficiencyTrigger: { value: "ADDED", referenceSummary: null, draftSummary: "d", evidence: "e" },
        endingMethod: { value: "NOT_APPLICABLE", referenceType: "OTHER", draftType: "OTHER", evidence: "e" },
        obstacle: {
          referenceHasObstacle: true,
          draftHasObstacle: true,
          functionPreserved: true,
          detailsTransformed: false,
          evidence: "e",
        },
        surfaceCloneRisk: { value: "HIGH", quotedFragments: [], evidence: "e" },
        unchangedCount: 1,
        applicableCount: 3,
        verdict: "BORDERLINE",
        evidence: "e",
        revisionDirection: "d",
      },
    },
    diagnostic: baseDiagnostic(),
    finalVerdict: { value: "FAIL", reasons: ["r"] },
  };

  it("critical/reconstruction/obstacle 필드를 정확히 매핑한다", () => {
    const row = extractPortfolioRow(3, ai);
    expect(row.index).toBe(3);
    expect(row.hasReference).toBe(true);
    expect(row.appealTransfer).toBe("MISMATCH");
    expect(row.searchMotivation).toBe("WEAK");
    expect(row.reconstructionVerdict).toBe("BORDERLINE");
    expect(row.surfaceCloneRisk).toBe("HIGH");

    expect(row.personaSame).toBe(true);
    expect(row.personaApplicable).toBe(true);
    expect(row.eventSame).toBe(false);
    expect(row.eventApplicable).toBe(true);
    // ADDED는 SAME이 아니고, NOT_APPLICABLE이 아니므로 applicable=true
    expect(row.deficiencyTriggerSame).toBe(false);
    expect(row.deficiencyTriggerApplicable).toBe(true);
    expect(row.endingSame).toBe(false);
    expect(row.endingApplicable).toBe(false); // NOT_APPLICABLE

    expect(row.referenceHasObstacle).toBe(true);
    expect(row.obstacleDeleted).toBe(false); // draftHasObstacle도 true라서 삭제 아님
    expect(row.obstacleFunctionPreserved).toBe(true);
    expect(row.obstacleDetailCloned).toBe(true); // functionPreserved true, detailsTransformed false
  });

  it("obstacleDeleted — reference엔 있었는데 draft에 없으면 true", () => {
    const deleted: RowAnalysisAiRefExists = {
      ...ai,
      critical: {
        ...ai.critical,
        reconstruction: {
          ...ai.critical.reconstruction,
          obstacle: {
            referenceHasObstacle: true,
            draftHasObstacle: false,
            functionPreserved: false,
            detailsTransformed: false,
            evidence: "e",
          },
        },
      },
    };
    const row = extractPortfolioRow(0, deleted);
    expect(row.obstacleDeleted).toBe(true);
    expect(row.obstacleDetailCloned).toBe(false);
  });

  it("newPatternCandidate를 그대로 통과시킨다", () => {
    const withPattern: RowAnalysisAiRefExists = {
      ...ai,
      diagnostic: baseDiagnostic({
        hookCode: "NEW_PATTERN_CANDIDATE",
        newPatternCandidate: {
          proposedName: "N",
          whyDifferent: "W",
          structureSummary: "S",
          linguisticFeatures: ["f1"],
        },
      }),
    };
    const row = extractPortfolioRow(1, withPattern);
    expect(row.hookCode).toBe("NEW_PATTERN_CANDIDATE");
    expect(row.newPatternCandidate).toEqual({
      proposedName: "N",
      whyDifferent: "W",
      structureSummary: "S",
      linguisticFeatures: ["f1"],
    });
  });
});

describe("extractPortfolioRow — 레퍼런스 없음", () => {
  const ai: RowAnalysisAiNoRef = {
    hygiene: baseHygiene(),
    critical: {
      reference: null,
      draftCoreAppeal: "draft appeal",
      appealTransfer: null,
      productCuriosity: { value: "WEAK", evidence: "e" },
      searchMotivation: { value: "WEAK", evidence: "e", liftDirection: "d" },
      reconstruction: null,
    },
    diagnostic: baseDiagnostic(),
    finalVerdict: { value: "FAIL", reasons: ["searchMotivation = WEAK"] },
  };

  it("appealTransfer/reconstructionVerdict/surfaceCloneRisk가 모두 N/A, obstacle/axis는 모두 비활성", () => {
    const row = extractPortfolioRow(0, ai);
    expect(row.hasReference).toBe(false);
    expect(row.appealTransfer).toBe("N/A");
    expect(row.reconstructionVerdict).toBe("N/A");
    expect(row.surfaceCloneRisk).toBe("N/A");
    expect(row.personaApplicable).toBe(false);
    expect(row.eventApplicable).toBe(false);
    expect(row.deficiencyTriggerApplicable).toBe(false);
    expect(row.endingApplicable).toBe(false);
    expect(row.referenceHasObstacle).toBe(false);
    expect(row.obstacleDeleted).toBe(false);
    expect(row.obstacleFunctionPreserved).toBe(false);
    expect(row.obstacleDetailCloned).toBe(false);
  });

  it("productCuriosity/searchMotivation은 ref 유무와 무관하게 항상 채워진다", () => {
    const row = extractPortfolioRow(0, ai);
    expect(row.productCuriosity).toBe("WEAK");
    expect(row.searchMotivation).toBe("WEAK");
  });
});
