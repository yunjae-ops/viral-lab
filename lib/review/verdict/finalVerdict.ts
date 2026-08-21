export type FinalVerdictValue = "READY" | "NEEDS_REVISION" | "FAIL";

export type FinalVerdictInput = {
  refExists: boolean;
  hygieneGrade: "A" | "B" | "FAIL";
  searchMotivation: "STRONG" | "MEDIUM" | "WEAK";
  appealTransfer: "STRONG" | "PARTIAL" | "MISMATCH" | null;
  reconstructionVerdict: "TRANSFORMED" | "BORDERLINE" | "TOO_CLOSE" | null;
  surfaceCloneRisk: "LOW" | "MEDIUM" | "HIGH" | null;
};

export type FinalVerdictResult = {
  value: FinalVerdictValue;
  reasons: string[];
};

/**
 * finalVerdict는 AI가 확정하지 않는다 (CLAUDE.md §2-11).
 * DATA_CONTRACT §2.4 / RECONSTRUCTION_RULES §9의 결정적 규칙을 서버가 그대로 계산한다.
 * 임의의 100점 점수 방식은 사용하지 않는다.
 */
export function computeFinalVerdict(input: FinalVerdictInput): FinalVerdictResult {
  const { refExists, hygieneGrade, searchMotivation, appealTransfer, reconstructionVerdict, surfaceCloneRisk } = input;

  const failReasons: string[] = [];
  if (hygieneGrade === "FAIL") failReasons.push("hygiene.grade = FAIL");
  if (searchMotivation === "WEAK") failReasons.push("searchMotivation = WEAK");
  if (refExists && appealTransfer === "MISMATCH") failReasons.push("appealTransfer = MISMATCH");
  if (refExists && reconstructionVerdict === "TOO_CLOSE") {
    failReasons.push("reconstruction.verdict = TOO_CLOSE (2개 이상 축이 SAME)");
  }
  if (refExists && surfaceCloneRisk === "HIGH") {
    failReasons.push("surfaceCloneRisk = HIGH");
  }

  if (failReasons.length > 0) {
    return { value: "FAIL", reasons: failReasons };
  }

  const readyChecks: Array<{ met: boolean; reason: string }> = [
    { met: hygieneGrade === "A", reason: "hygiene.grade = A" },
    { met: searchMotivation === "STRONG", reason: "searchMotivation = STRONG" },
    {
      met: !refExists || appealTransfer === "STRONG",
      reason: refExists ? "appealTransfer = STRONG" : "appealTransfer = N/A (레퍼런스 없음)",
    },
    {
      met: !refExists || reconstructionVerdict === "TRANSFORMED",
      reason: refExists ? "reconstruction.verdict = TRANSFORMED" : "reconstruction = N/A (레퍼런스 없음)",
    },
    {
      met: !refExists || surfaceCloneRisk !== "HIGH",
      reason: refExists ? "surfaceCloneRisk != HIGH" : "surfaceCloneRisk = N/A (레퍼런스 없음)",
    },
  ];

  if (readyChecks.every((c) => c.met)) {
    return { value: "READY", reasons: readyChecks.map((c) => c.reason) };
  }

  const notMetReasons = readyChecks.filter((c) => !c.met).map((c) => `NEEDS_REVISION — 미충족: ${c.reason}`);
  return {
    value: "NEEDS_REVISION",
    reasons: notMetReasons.length > 0 ? notMetReasons : ["READY 조건 일부 미충족"],
  };
}
