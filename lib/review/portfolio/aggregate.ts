import {
  HOOK_CODES_WITH_NEW_PATTERN,
  EMOTION_VALUES,
  SPEAKER_VALUES,
  DISCLOSURE_MODE_VALUES,
} from "@/lib/schema/rowAnalysis";
import { PORTFOLIO_THRESHOLDS } from "./thresholds";
import type {
  PortfolioRow,
  PortfolioAnalysis,
  PortfolioCounts,
  PortfolioWarning,
  ReconstructionAxes,
  FailReasonBreakdown,
} from "./types";

function zeroRecord<K extends string>(keys: readonly K[]): Record<K, number> {
  const rec = {} as Record<K, number>;
  for (const k of keys) rec[k] = 0;
  return rec;
}

const ratio = (n: number, d: number): number => (d > 0 ? n / d : 0);

const AXIS_LABEL: Record<"persona" | "event" | "deficiencyTrigger" | "ending", string> = {
  persona: "화자(Persona)",
  event: "사건(Event)",
  deficiencyTrigger: "결핍 계기(Deficiency Trigger)",
  ending: "결말(Ending)",
};

// 분석 완료된 소재들의 구조화된 요약(PortfolioRow[])만으로 모든 카운트·경고를
// 결정적으로 계산한다 (CLAUDE.md §2-15, DATA_CONTRACT §3.2). AI 호출 없음.
export function aggregatePortfolio(rows: PortfolioRow[]): PortfolioAnalysis {
  const totalAnalyzed = rows.length;
  const refCount = rows.filter((r) => r.hasReference).length;

  const counts: PortfolioCounts = {
    hookCode: zeroRecord(HOOK_CODES_WITH_NEW_PATTERN),
    emotion: zeroRecord([...EMOTION_VALUES, "OTHER"] as const),
    speaker: zeroRecord([...SPEAKER_VALUES, "OTHER"] as const),
    disclosureMode: zeroRecord([...DISCLOSURE_MODE_VALUES, "OTHER"] as const),
    hygieneGrade: zeroRecord(["A", "B", "FAIL"] as const),
    appealTransfer: zeroRecord(["STRONG", "PARTIAL", "MISMATCH", "N/A"] as const),
    productCuriosity: zeroRecord(["STRONG", "MEDIUM", "WEAK"] as const),
    searchMotivation: zeroRecord(["STRONG", "MEDIUM", "WEAK"] as const),
    finalVerdict: zeroRecord(["READY", "NEEDS_REVISION", "FAIL"] as const),
    reconstructionVerdict: zeroRecord(["TRANSFORMED", "BORDERLINE", "TOO_CLOSE", "N/A"] as const),
    surfaceCloneRisk: zeroRecord(["LOW", "MEDIUM", "HIGH", "N/A"] as const),
  };

  const axes: ReconstructionAxes = {
    persona: { same: 0, applicable: 0 },
    event: { same: 0, applicable: 0 },
    deficiencyTrigger: { same: 0, applicable: 0 },
    ending: { same: 0, applicable: 0 },
    obstacleReferenceCount: 0,
    obstacleDeleted: 0,
    obstacleFunctionPreserved: 0,
    obstacleDetailCloned: 0,
  };

  const failReasonBreakdown: FailReasonBreakdown = {
    hygieneFail: 0,
    searchMotivationWeak: 0,
    appealTransferMismatch: 0,
    reconstructionTooClose: 0,
    surfaceCloneHigh: 0,
  };

  const newPatternCandidates: PortfolioAnalysis["newPatternCandidates"] = [];

  for (const row of rows) {
    counts.hookCode[row.hookCode]++;
    counts.emotion[row.emotion]++;
    counts.speaker[row.speaker]++;
    counts.disclosureMode[row.disclosureMode]++;
    counts.hygieneGrade[row.hygieneGrade]++;
    counts.appealTransfer[row.appealTransfer]++;
    counts.productCuriosity[row.productCuriosity]++;
    counts.searchMotivation[row.searchMotivation]++;
    counts.finalVerdict[row.finalVerdict]++;
    counts.reconstructionVerdict[row.reconstructionVerdict]++;
    counts.surfaceCloneRisk[row.surfaceCloneRisk]++;

    if (row.personaApplicable) {
      axes.persona.applicable++;
      if (row.personaSame) axes.persona.same++;
    }
    if (row.eventApplicable) {
      axes.event.applicable++;
      if (row.eventSame) axes.event.same++;
    }
    if (row.deficiencyTriggerApplicable) {
      axes.deficiencyTrigger.applicable++;
      if (row.deficiencyTriggerSame) axes.deficiencyTrigger.same++;
    }
    if (row.endingApplicable) {
      axes.ending.applicable++;
      if (row.endingSame) axes.ending.same++;
    }

    if (row.referenceHasObstacle) axes.obstacleReferenceCount++;
    if (row.obstacleDeleted) axes.obstacleDeleted++;
    if (row.obstacleFunctionPreserved) axes.obstacleFunctionPreserved++;
    if (row.obstacleDetailCloned) axes.obstacleDetailCloned++;

    if (row.finalVerdict === "FAIL") {
      if (row.hygieneGrade === "FAIL") failReasonBreakdown.hygieneFail++;
      if (row.searchMotivation === "WEAK") failReasonBreakdown.searchMotivationWeak++;
      if (row.hasReference && row.appealTransfer === "MISMATCH") failReasonBreakdown.appealTransferMismatch++;
      if (row.hasReference && row.reconstructionVerdict === "TOO_CLOSE") failReasonBreakdown.reconstructionTooClose++;
      if (row.hasReference && row.surfaceCloneRisk === "HIGH") failReasonBreakdown.surfaceCloneHigh++;
    }

    if (row.newPatternCandidate) {
      newPatternCandidates.push({ index: row.index, ...row.newPatternCandidate });
    }
  }

  const warnings: PortfolioWarning[] = [];

  if (totalAnalyzed > 0) {
    for (const [field, rec] of [
      ["hookCode", counts.hookCode],
      ["emotion", counts.emotion],
      ["speaker", counts.speaker],
      ["disclosureMode", counts.disclosureMode],
    ] as const) {
      for (const [value, n] of Object.entries(rec)) {
        const r = ratio(n, totalAnalyzed);
        if (r >= PORTFOLIO_THRESHOLDS.OVERUSE) {
          warnings.push({ kind: "OVERUSE", field, value, ratio: r });
        }
      }
    }
  }

  if (refCount > 0) {
    const mismatchRatio = ratio(counts.appealTransfer.MISMATCH, refCount);
    if (mismatchRatio >= PORTFOLIO_THRESHOLDS.MISMATCH_HEAVY) {
      warnings.push({ kind: "MISMATCH_HEAVY", field: "appealTransfer", value: "MISMATCH", ratio: mismatchRatio });
    }

    const tooCloseRatio = ratio(counts.reconstructionVerdict.TOO_CLOSE, refCount);
    if (tooCloseRatio >= PORTFOLIO_THRESHOLDS.RECONSTRUCTION_TOO_CLOSE_HEAVY) {
      warnings.push({
        kind: "RECONSTRUCTION_TOO_CLOSE_HEAVY",
        field: "reconstructionVerdict",
        value: "TOO_CLOSE",
        ratio: tooCloseRatio,
      });
    }

    const cloneHighRatio = ratio(counts.surfaceCloneRisk.HIGH, refCount);
    if (cloneHighRatio >= PORTFOLIO_THRESHOLDS.SURFACE_CLONE_HEAVY) {
      warnings.push({ kind: "SURFACE_CLONE_HEAVY", field: "surfaceCloneRisk", value: "HIGH", ratio: cloneHighRatio });
    }
  }

  if (totalAnalyzed > 0) {
    const searchWeakRatio = ratio(counts.searchMotivation.WEAK, totalAnalyzed);
    if (searchWeakRatio >= PORTFOLIO_THRESHOLDS.SEARCH_WEAK_HEAVY) {
      warnings.push({ kind: "SEARCH_WEAK_HEAVY", field: "searchMotivation", value: "WEAK", ratio: searchWeakRatio });
    }

    const maxRatio = (rec: Record<string, number>) =>
      Math.max(0, ...Object.values(rec).map((n) => ratio(n, totalAnalyzed)));
    const diverseFormat =
      maxRatio(counts.hookCode) <= PORTFOLIO_THRESHOLDS.FORMAT_VS_SEARCH_MAX_CATEGORY_RATIO &&
      maxRatio(counts.emotion) <= PORTFOLIO_THRESHOLDS.FORMAT_VS_SEARCH_MAX_CATEGORY_RATIO &&
      maxRatio(counts.speaker) <= PORTFOLIO_THRESHOLDS.FORMAT_VS_SEARCH_MAX_CATEGORY_RATIO;
    if (diverseFormat && searchWeakRatio >= PORTFOLIO_THRESHOLDS.FORMAT_VS_SEARCH_SEARCH_WEAK_MIN) {
      warnings.push({
        kind: "FORMAT_VS_SEARCH",
        detail: `포맷(Hook/감정/화자)은 다양하지만 Search Motivation WEAK 비율이 ${(searchWeakRatio * 100).toFixed(0)}%로 높습니다.`,
      });
    }
  }

  for (const key of ["persona", "event", "deficiencyTrigger", "ending"] as const) {
    const stat = axes[key];
    const r = ratio(stat.same, stat.applicable);
    if (stat.applicable > 0 && r >= PORTFOLIO_THRESHOLDS.AXIS_WEAK) {
      warnings.push({
        kind: "AXIS_WEAK",
        field: key,
        ratio: r,
        detail: `${AXIS_LABEL[key]}을 새로 만드는 능력이 약합니다 — SAME 비율 ${(r * 100).toFixed(0)}% (${stat.same}/${stat.applicable})`,
      });
    }
  }

  return {
    totalAnalyzed,
    refCount,
    counts,
    reconstructionAxes: axes,
    warnings,
    failReasonBreakdown,
    newPatternCandidates,
  };
}
