import type { RowAnalysisAi } from "@/lib/schema/rowAnalysis";
import type { PortfolioRow, EmotionValue, SpeakerValue, DisclosureModeValue } from "./types";

// 완료된 RowAnalysis 1건 → Portfolio 집계용 요약 (DATA_CONTRACT §3.1).
// draft/evidence 본문은 포함하지 않는다.
export function extractPortfolioRow(index: number, ai: RowAnalysisAi): PortfolioRow {
  const hasReference = ai.critical.reference !== null;
  const reconstruction = hasReference ? ai.critical.reconstruction : null;
  const obstacle = reconstruction?.obstacle ?? null;

  return {
    index,
    hasReference,

    hygieneGrade: ai.hygiene.grade,
    hookCode: ai.diagnostic.hookCode,
    // Zod의 otherableEnum 헬퍼가 내부적으로 string으로 넓혀 반환하므로,
    // 이미 스키마로 검증된 값을 다시 리터럴 유니온으로 좁혀준다.
    emotion: ai.diagnostic.emotion.value as EmotionValue,
    speaker: ai.diagnostic.speaker.value as SpeakerValue,
    disclosureMode: ai.diagnostic.disclosureMode.value as DisclosureModeValue,

    appealTransfer: hasReference && ai.critical.appealTransfer ? ai.critical.appealTransfer.value : "N/A",
    productCuriosity: ai.critical.productCuriosity.value,
    searchMotivation: ai.critical.searchMotivation.value,
    finalVerdict: ai.finalVerdict.value,

    reconstructionVerdict: reconstruction ? reconstruction.verdict : "N/A",
    surfaceCloneRisk: reconstruction ? reconstruction.surfaceCloneRisk.value : "N/A",

    personaSame: reconstruction ? reconstruction.persona.value === "SAME" : false,
    personaApplicable: reconstruction ? reconstruction.persona.value !== "NOT_APPLICABLE" : false,
    eventSame: reconstruction ? reconstruction.event.value === "SAME" : false,
    eventApplicable: reconstruction ? reconstruction.event.value !== "NOT_APPLICABLE" : false,
    deficiencyTriggerSame: reconstruction ? reconstruction.deficiencyTrigger.value === "SAME" : false,
    deficiencyTriggerApplicable: reconstruction
      ? reconstruction.deficiencyTrigger.value !== "NOT_APPLICABLE"
      : false,
    endingSame: reconstruction ? reconstruction.endingMethod.value === "SAME" : false,
    endingApplicable: reconstruction ? reconstruction.endingMethod.value !== "NOT_APPLICABLE" : false,

    referenceHasObstacle: obstacle?.referenceHasObstacle ?? false,
    obstacleDeleted: obstacle ? obstacle.referenceHasObstacle && !obstacle.draftHasObstacle : false,
    obstacleFunctionPreserved: obstacle?.functionPreserved === true,
    obstacleDetailCloned: obstacle
      ? obstacle.referenceHasObstacle && obstacle.draftHasObstacle && obstacle.detailsTransformed === false
      : false,

    newPatternCandidate: ai.diagnostic.newPatternCandidate,
  };
}
