import type {
  HOOK_CODES_WITH_NEW_PATTERN,
  EMOTION_VALUES,
  SPEAKER_VALUES,
  DISCLOSURE_MODE_VALUES,
} from "@/lib/schema/rowAnalysis";

export type HookCodeValue = (typeof HOOK_CODES_WITH_NEW_PATTERN)[number];
export type EmotionValue = (typeof EMOTION_VALUES)[number] | "OTHER";
export type SpeakerValue = (typeof SPEAKER_VALUES)[number] | "OTHER";
export type DisclosureModeValue = (typeof DISCLOSURE_MODE_VALUES)[number] | "OTHER";

// 분석 완료된 소재 1건에서 뽑아낸 통계용 요약. 본문/evidence는 포함하지 않는다
// (DATA_CONTRACT §3.1). Portfolio 집계·추천 프롬프트는 오직 이 구조화된 값만 본다.
export type PortfolioRow = {
  index: number;
  hasReference: boolean;

  hygieneGrade: "A" | "B" | "FAIL";
  hookCode: HookCodeValue;
  emotion: EmotionValue;
  speaker: SpeakerValue;
  disclosureMode: DisclosureModeValue;

  appealTransfer: "STRONG" | "PARTIAL" | "MISMATCH" | "N/A";
  productCuriosity: "STRONG" | "MEDIUM" | "WEAK";
  searchMotivation: "STRONG" | "MEDIUM" | "WEAK";
  finalVerdict: "READY" | "NEEDS_REVISION" | "FAIL";

  reconstructionVerdict: "TRANSFORMED" | "BORDERLINE" | "TOO_CLOSE" | "N/A";
  surfaceCloneRisk: "LOW" | "MEDIUM" | "HIGH" | "N/A";

  personaSame: boolean;
  personaApplicable: boolean;
  eventSame: boolean;
  eventApplicable: boolean;
  deficiencyTriggerSame: boolean;
  deficiencyTriggerApplicable: boolean;
  endingSame: boolean;
  endingApplicable: boolean;

  referenceHasObstacle: boolean;
  obstacleDeleted: boolean; // referenceHasObstacle && !draftHasObstacle
  obstacleFunctionPreserved: boolean; // functionPreserved === true
  obstacleDetailCloned: boolean; // 기능은 있는데 detailsTransformed === false

  newPatternCandidate: {
    proposedName: string;
    whyDifferent: string;
    structureSummary: string;
    linguisticFeatures: string[];
  } | null;
};

export type PortfolioCounts = {
  hookCode: Record<HookCodeValue, number>;
  emotion: Record<EmotionValue, number>;
  speaker: Record<SpeakerValue, number>;
  disclosureMode: Record<DisclosureModeValue, number>;
  hygieneGrade: Record<"A" | "B" | "FAIL", number>;
  appealTransfer: Record<"STRONG" | "PARTIAL" | "MISMATCH" | "N/A", number>;
  productCuriosity: Record<"STRONG" | "MEDIUM" | "WEAK", number>;
  searchMotivation: Record<"STRONG" | "MEDIUM" | "WEAK", number>;
  finalVerdict: Record<"READY" | "NEEDS_REVISION" | "FAIL", number>;
  reconstructionVerdict: Record<"TRANSFORMED" | "BORDERLINE" | "TOO_CLOSE" | "N/A", number>;
  surfaceCloneRisk: Record<"LOW" | "MEDIUM" | "HIGH" | "N/A", number>;
};

export type ReconstructionAxisStat = { same: number; applicable: number };

export type ReconstructionAxes = {
  persona: ReconstructionAxisStat;
  event: ReconstructionAxisStat;
  deficiencyTrigger: ReconstructionAxisStat;
  ending: ReconstructionAxisStat;
  obstacleReferenceCount: number;
  obstacleDeleted: number;
  obstacleFunctionPreserved: number;
  obstacleDetailCloned: number;
};

export type PortfolioWarning =
  | { kind: "OVERUSE"; field: "hookCode" | "emotion" | "speaker" | "disclosureMode"; value: string; ratio: number }
  | { kind: "MISMATCH_HEAVY"; field: "appealTransfer"; value: "MISMATCH"; ratio: number }
  | { kind: "SEARCH_WEAK_HEAVY"; field: "searchMotivation"; value: "WEAK"; ratio: number }
  | { kind: "FORMAT_VS_SEARCH"; detail: string }
  | { kind: "RECONSTRUCTION_TOO_CLOSE_HEAVY"; field: "reconstructionVerdict"; value: "TOO_CLOSE"; ratio: number }
  | { kind: "SURFACE_CLONE_HEAVY"; field: "surfaceCloneRisk"; value: "HIGH"; ratio: number }
  | {
      kind: "AXIS_WEAK";
      field: "persona" | "event" | "deficiencyTrigger" | "ending";
      ratio: number;
      detail: string;
    };

// finalVerdict = FAIL인 소재들 중 각 구조화된 FAIL 조건에 해당하는 개수.
// computeFinalVerdict의 FAIL 규칙(DATA_CONTRACT §2.4)을 그대로 재사용 — reasons[]
// 자연어 문자열은 파싱하지 않는다.
export type FailReasonBreakdown = {
  hygieneFail: number;
  searchMotivationWeak: number;
  appealTransferMismatch: number;
  reconstructionTooClose: number;
  surfaceCloneHigh: number;
};

export type PortfolioAnalysis = {
  totalAnalyzed: number;
  refCount: number;
  counts: PortfolioCounts;
  reconstructionAxes: ReconstructionAxes;
  warnings: PortfolioWarning[];
  failReasonBreakdown: FailReasonBreakdown;
  newPatternCandidates: Array<{ index: number } & NonNullable<PortfolioRow["newPatternCandidate"]>>;
};

export type PortfolioRecommendation = {
  text: string;
  suggestedAngles: string[];
};
