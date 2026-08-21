import type { Reconstruction } from "@/lib/schema/rowAnalysis";

/**
 * unchangedCount / applicableCount / verdict는 AI가 확정하지 않는다
 * (RECONSTRUCTION_RULES §6). Persona/Event/DeficiencyTrigger/EndingMethod
 * 4개 축의 enum 값으로 서버가 결정적으로 재계산해 덮어쓴다.
 */
export function recomputeReconstruction(reconstruction: Reconstruction): Reconstruction {
  const axisValues = [
    reconstruction.persona.value,
    reconstruction.event.value,
    reconstruction.deficiencyTrigger.value,
    reconstruction.endingMethod.value,
  ];

  const applicableCount = axisValues.filter((v) => v !== "NOT_APPLICABLE").length;
  const unchangedCount = axisValues.filter((v) => v === "SAME").length;

  const verdict: Reconstruction["verdict"] =
    unchangedCount === 0 ? "TRANSFORMED" : unchangedCount === 1 ? "BORDERLINE" : "TOO_CLOSE";

  return { ...reconstruction, unchangedCount, applicableCount, verdict };
}
