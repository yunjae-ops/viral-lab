import { describe, it, expect } from "vitest";
import { aggregatePortfolio } from "./aggregate";
import type { PortfolioRow } from "./types";

function makeRow(overrides: Partial<PortfolioRow> = {}): PortfolioRow {
  return {
    index: 0,
    hasReference: true,
    hygieneGrade: "A",
    hookCode: "A",
    emotion: "시크함",
    speaker: "본인 1인칭",
    disclosureMode: "직접서술",
    appealTransfer: "STRONG",
    productCuriosity: "STRONG",
    searchMotivation: "STRONG",
    finalVerdict: "READY",
    reconstructionVerdict: "TRANSFORMED",
    surfaceCloneRisk: "LOW",
    personaSame: false,
    personaApplicable: true,
    eventSame: false,
    eventApplicable: true,
    deficiencyTriggerSame: false,
    deficiencyTriggerApplicable: true,
    endingSame: false,
    endingApplicable: true,
    referenceHasObstacle: false,
    obstacleDeleted: false,
    obstacleFunctionPreserved: false,
    obstacleDetailCloned: false,
    newPatternCandidate: null,
    ...overrides,
  };
}

function noRefRow(overrides: Partial<PortfolioRow> = {}): PortfolioRow {
  return makeRow({
    hasReference: false,
    appealTransfer: "N/A",
    reconstructionVerdict: "N/A",
    surfaceCloneRisk: "N/A",
    personaApplicable: false,
    eventApplicable: false,
    deficiencyTriggerApplicable: false,
    endingApplicable: false,
    referenceHasObstacle: false,
    ...overrides,
  });
}

describe("aggregatePortfolio — 기본 집계", () => {
  it("빈 배열이면 모든 카운트가 0", () => {
    const p = aggregatePortfolio([]);
    expect(p.totalAnalyzed).toBe(0);
    expect(p.refCount).toBe(0);
    expect(p.counts.finalVerdict.READY).toBe(0);
    expect(p.warnings).toEqual([]);
  });

  it("Hook 분포를 정확히 집계한다", () => {
    const rows = [
      makeRow({ hookCode: "A" }),
      makeRow({ hookCode: "A" }),
      makeRow({ hookCode: "B" }),
      makeRow({ hookCode: "NEW_PATTERN_CANDIDATE" }),
    ];
    const p = aggregatePortfolio(rows);
    expect(p.counts.hookCode.A).toBe(2);
    expect(p.counts.hookCode.B).toBe(1);
    expect(p.counts.hookCode.NEW_PATTERN_CANDIDATE).toBe(1);
    expect(p.counts.hookCode.C).toBe(0);
  });

  it("감정태도 분포를 정확히 집계한다 (OTHER 포함)", () => {
    const rows = [
      makeRow({ emotion: "절박함" }),
      makeRow({ emotion: "절박함" }),
      makeRow({ emotion: "시크함" }),
      makeRow({ emotion: "OTHER" }),
    ];
    const p = aggregatePortfolio(rows);
    expect(p.counts.emotion["절박함"]).toBe(2);
    expect(p.counts.emotion["시크함"]).toBe(1);
    expect(p.counts.emotion.OTHER).toBe(1);
    expect(p.counts.emotion["순수감탄"]).toBe(0);
  });

  it("화자 분포를 정확히 집계한다", () => {
    const rows = [
      makeRow({ speaker: "본인 1인칭" }),
      makeRow({ speaker: "딸-엄마 관찰" }),
      makeRow({ speaker: "딸-엄마 관찰" }),
    ];
    const p = aggregatePortfolio(rows);
    expect(p.counts.speaker["본인 1인칭"]).toBe(1);
    expect(p.counts.speaker["딸-엄마 관찰"]).toBe(2);
  });

  it("정보공개방식 분포를 정확히 집계한다", () => {
    const rows = [makeRow({ disclosureMode: "리스트" }), makeRow({ disclosureMode: "대화체" })];
    const p = aggregatePortfolio(rows);
    expect(p.counts.disclosureMode["리스트"]).toBe(1);
    expect(p.counts.disclosureMode["대화체"]).toBe(1);
  });

  it("Appeal Transfer 집계 — 레퍼런스 없는 행은 N/A로 잡히고 refCount에서 제외된다", () => {
    const rows = [
      makeRow({ appealTransfer: "STRONG" }),
      makeRow({ appealTransfer: "MISMATCH" }),
      noRefRow(),
      noRefRow(),
    ];
    const p = aggregatePortfolio(rows);
    expect(p.totalAnalyzed).toBe(4);
    expect(p.refCount).toBe(2);
    expect(p.counts.appealTransfer.STRONG).toBe(1);
    expect(p.counts.appealTransfer.MISMATCH).toBe(1);
    expect(p.counts.appealTransfer["N/A"]).toBe(2);
  });

  it("Product Curiosity 집계", () => {
    const rows = [
      makeRow({ productCuriosity: "STRONG" }),
      makeRow({ productCuriosity: "WEAK" }),
      makeRow({ productCuriosity: "WEAK" }),
    ];
    const p = aggregatePortfolio(rows);
    expect(p.counts.productCuriosity.STRONG).toBe(1);
    expect(p.counts.productCuriosity.WEAK).toBe(2);
  });

  it("Search Motivation 집계", () => {
    const rows = [makeRow({ searchMotivation: "MEDIUM" }), makeRow({ searchMotivation: "WEAK" })];
    const p = aggregatePortfolio(rows);
    expect(p.counts.searchMotivation.MEDIUM).toBe(1);
    expect(p.counts.searchMotivation.WEAK).toBe(1);
  });

  it("Reconstruction Verdict / Surface Clone Risk 집계 — ref 없는 행은 N/A", () => {
    const rows = [
      makeRow({ reconstructionVerdict: "TOO_CLOSE", surfaceCloneRisk: "HIGH" }),
      makeRow({ reconstructionVerdict: "BORDERLINE", surfaceCloneRisk: "MEDIUM" }),
      noRefRow(),
    ];
    const p = aggregatePortfolio(rows);
    expect(p.counts.reconstructionVerdict.TOO_CLOSE).toBe(1);
    expect(p.counts.reconstructionVerdict.BORDERLINE).toBe(1);
    expect(p.counts.reconstructionVerdict["N/A"]).toBe(1);
    expect(p.counts.surfaceCloneRisk.HIGH).toBe(1);
    expect(p.counts.surfaceCloneRisk["N/A"]).toBe(1);
  });

  it("Persona SAME 분모 — NOT_APPLICABLE은 분모에서 제외", () => {
    const rows = [
      makeRow({ personaSame: true, personaApplicable: true }),
      makeRow({ personaSame: false, personaApplicable: true }),
      makeRow({ personaSame: false, personaApplicable: false }), // NOT_APPLICABLE → 분모 제외
    ];
    const p = aggregatePortfolio(rows);
    expect(p.reconstructionAxes.persona).toEqual({ same: 1, applicable: 2 });
  });

  it("Event/Trigger/Ending SAME 분모도 각각 NOT_APPLICABLE을 제외하고 계산된다", () => {
    const rows = [noRefRow(), makeRow({ eventSame: true, eventApplicable: true })];
    const p = aggregatePortfolio(rows);
    // noRefRow는 4개 축 모두 NOT_APPLICABLE이므로 event 분모에서 제외되어야 한다.
    expect(p.reconstructionAxes.event).toEqual({ same: 1, applicable: 1 });
    expect(p.reconstructionAxes.deficiencyTrigger.applicable).toBe(1);
    expect(p.reconstructionAxes.ending.applicable).toBe(1);
  });

  it("Final Verdict 분포", () => {
    const rows = [
      makeRow({ finalVerdict: "READY" }),
      makeRow({ finalVerdict: "READY" }),
      makeRow({ finalVerdict: "NEEDS_REVISION" }),
      makeRow({ finalVerdict: "FAIL" }),
    ];
    const p = aggregatePortfolio(rows);
    expect(p.counts.finalVerdict).toEqual({ READY: 2, NEEDS_REVISION: 1, FAIL: 1 });
  });

  it("Obstacle 집계 — 삭제/기능유지/세부복제", () => {
    const rows = [
      makeRow({ referenceHasObstacle: true, obstacleDeleted: true }),
      makeRow({ referenceHasObstacle: true, obstacleFunctionPreserved: true, obstacleDetailCloned: false }),
      makeRow({ referenceHasObstacle: true, obstacleFunctionPreserved: true, obstacleDetailCloned: true }),
    ];
    const p = aggregatePortfolio(rows);
    expect(p.reconstructionAxes.obstacleReferenceCount).toBe(3);
    expect(p.reconstructionAxes.obstacleDeleted).toBe(1);
    expect(p.reconstructionAxes.obstacleFunctionPreserved).toBe(2);
    expect(p.reconstructionAxes.obstacleDetailCloned).toBe(1);
  });

  it("FAIL 원인 분해 — 구조화된 필드 기준, reasons[] 파싱 없이 계산", () => {
    const rows = [
      makeRow({ finalVerdict: "FAIL", hygieneGrade: "FAIL", searchMotivation: "WEAK" }),
      makeRow({ finalVerdict: "FAIL", appealTransfer: "MISMATCH", hygieneGrade: "A", searchMotivation: "STRONG" }),
      makeRow({
        finalVerdict: "FAIL",
        reconstructionVerdict: "TOO_CLOSE",
        surfaceCloneRisk: "HIGH",
        hygieneGrade: "A",
        searchMotivation: "STRONG",
      }),
      makeRow({ finalVerdict: "READY" }), // FAIL 아니므로 breakdown에 포함 안 됨
    ];
    const p = aggregatePortfolio(rows);
    expect(p.failReasonBreakdown.hygieneFail).toBe(1);
    expect(p.failReasonBreakdown.searchMotivationWeak).toBe(1);
    expect(p.failReasonBreakdown.appealTransferMismatch).toBe(1);
    expect(p.failReasonBreakdown.reconstructionTooClose).toBe(1);
    expect(p.failReasonBreakdown.surfaceCloneHigh).toBe(1);
  });

  it("newPatternCandidate가 있는 행만 목록에 포함되고 index가 보존된다", () => {
    const rows = [
      makeRow({ index: 5, newPatternCandidate: null }),
      makeRow({
        index: 9,
        newPatternCandidate: {
          proposedName: "새 패턴",
          whyDifferent: "이유",
          structureSummary: "구조",
          linguisticFeatures: ["a", "b"],
        },
      }),
    ];
    const p = aggregatePortfolio(rows);
    expect(p.newPatternCandidates).toHaveLength(1);
    expect(p.newPatternCandidates[0].index).toBe(9);
    expect(p.newPatternCandidates[0].proposedName).toBe("새 패턴");
  });
});

describe("aggregatePortfolio — 경고 임계값", () => {
  it("OVERUSE: 0.40 미만이면 미발생, 0.40 이상이면 발생", () => {
    // OVERUSE는 hookCode/emotion/speaker/disclosureMode 네 필드 모두를 검사하므로,
    // makeRow의 고정 기본값(emotion/speaker/disclosureMode)도 함께 분산시켜야 한다.
    const under = Array.from({ length: 10 }, (_, i) =>
      makeRow({
        hookCode: i < 3 ? "A" : i < 6 ? "B" : i < 9 ? "C" : "D",
        emotion: i < 3 ? "절박함" : i < 6 ? "시크함" : i < 9 ? "순수감탄" : "놀람",
        speaker: i < 3 ? "본인 1인칭" : i < 6 ? "딸-엄마 관찰" : i < 9 ? "친구-친구 관찰" : "순수 목격자",
        disclosureMode: i < 3 ? "직접서술" : i < 6 ? "리스트" : i < 9 ? "대화체" : "선언문",
      }),
    );
    expect(aggregatePortfolio(under).warnings.some((w) => w.kind === "OVERUSE")).toBe(false);

    const over = Array.from({ length: 10 }, (_, i) => makeRow({ hookCode: i < 4 ? "A" : "B" })); // 40%
    const w = aggregatePortfolio(over).warnings.find((w) => w.kind === "OVERUSE");
    expect(w).toBeDefined();
    if (w?.kind === "OVERUSE") {
      expect(w.field).toBe("hookCode");
      expect(w.value).toBe("A");
      expect(w.ratio).toBeCloseTo(0.4);
    }
  });

  it("MISMATCH_HEAVY: 0.30 미만이면 미발생, 0.30 이상이면 발생 (refCount 기준)", () => {
    const under = Array.from({ length: 10 }, (_, i) => makeRow({ appealTransfer: i < 2 ? "MISMATCH" : "STRONG" })); // 20%
    expect(aggregatePortfolio(under).warnings.some((w) => w.kind === "MISMATCH_HEAVY")).toBe(false);

    const over = Array.from({ length: 10 }, (_, i) => makeRow({ appealTransfer: i < 3 ? "MISMATCH" : "STRONG" })); // 30%
    expect(aggregatePortfolio(over).warnings.some((w) => w.kind === "MISMATCH_HEAVY")).toBe(true);
  });

  it("SEARCH_WEAK_HEAVY: 0.35 미만이면 미발생, 0.35 이상이면 발생", () => {
    const under = Array.from({ length: 20 }, (_, i) => makeRow({ searchMotivation: i < 6 ? "WEAK" : "STRONG" })); // 30%
    expect(aggregatePortfolio(under).warnings.some((w) => w.kind === "SEARCH_WEAK_HEAVY")).toBe(false);

    const over = Array.from({ length: 20 }, (_, i) => makeRow({ searchMotivation: i < 7 ? "WEAK" : "STRONG" })); // 35%
    expect(aggregatePortfolio(over).warnings.some((w) => w.kind === "SEARCH_WEAK_HEAVY")).toBe(true);
  });

  it("FORMAT_VS_SEARCH: 포맷은 다양(각 카테고리 최대비율<=0.40)한데 searchWeak>=0.30이면 발생", () => {
    // 10건: hookCode 4/3/3, emotion 4/3/3, speaker 4/3/3 (모두 최대 40%), searchWeak 3/10=30%
    const rows = Array.from({ length: 10 }, (_, i) =>
      makeRow({
        hookCode: i < 4 ? "A" : i < 7 ? "B" : "C",
        emotion: i < 4 ? "절박함" : i < 7 ? "시크함" : "순수감탄",
        speaker: i < 4 ? "본인 1인칭" : i < 7 ? "딸-엄마 관찰" : "친구-친구 관찰",
        searchMotivation: i < 3 ? "WEAK" : "STRONG",
      }),
    );
    const warnings = aggregatePortfolio(rows).warnings;
    expect(warnings.some((w) => w.kind === "FORMAT_VS_SEARCH")).toBe(true);
    // searchWeak 30% < SEARCH_WEAK_HEAVY(35%) 이므로 그 경고는 별도로 뜨지 않아야 함
    expect(warnings.some((w) => w.kind === "SEARCH_WEAK_HEAVY")).toBe(false);
  });

  it("FORMAT_VS_SEARCH: 특정 Hook이 과사용(포맷이 다양하지 않음)이면 발생하지 않는다", () => {
    const rows = Array.from({ length: 10 }, (_, i) => makeRow({ hookCode: "A", searchMotivation: i < 5 ? "WEAK" : "STRONG" }));
    const warnings = aggregatePortfolio(rows).warnings;
    expect(warnings.some((w) => w.kind === "FORMAT_VS_SEARCH")).toBe(false);
  });

  it("RECONSTRUCTION_TOO_CLOSE_HEAVY: 0.35 미만이면 미발생, 0.35 이상이면 발생", () => {
    const under = Array.from({ length: 20 }, (_, i) =>
      makeRow({ reconstructionVerdict: i < 6 ? "TOO_CLOSE" : "TRANSFORMED" }),
    ); // 30%
    expect(aggregatePortfolio(under).warnings.some((w) => w.kind === "RECONSTRUCTION_TOO_CLOSE_HEAVY")).toBe(false);

    const over = Array.from({ length: 20 }, (_, i) =>
      makeRow({ reconstructionVerdict: i < 7 ? "TOO_CLOSE" : "TRANSFORMED" }),
    ); // 35%
    expect(aggregatePortfolio(over).warnings.some((w) => w.kind === "RECONSTRUCTION_TOO_CLOSE_HEAVY")).toBe(true);
  });

  it("SURFACE_CLONE_HEAVY: 0.15 미만이면 미발생, 0.15 이상이면 발생", () => {
    const under = Array.from({ length: 20 }, (_, i) => makeRow({ surfaceCloneRisk: i < 2 ? "HIGH" : "LOW" })); // 10%
    expect(aggregatePortfolio(under).warnings.some((w) => w.kind === "SURFACE_CLONE_HEAVY")).toBe(false);

    const over = Array.from({ length: 20 }, (_, i) => makeRow({ surfaceCloneRisk: i < 3 ? "HIGH" : "LOW" })); // 15%
    expect(aggregatePortfolio(over).warnings.some((w) => w.kind === "SURFACE_CLONE_HEAVY")).toBe(true);
  });

  it("AXIS_WEAK: 0.50 미만이면 미발생, 0.50 이상이면 발생 (applicable 분모 기준)", () => {
    const under = Array.from({ length: 10 }, (_, i) => makeRow({ eventSame: i < 4, eventApplicable: true })); // 40%
    expect(aggregatePortfolio(under).warnings.some((w) => w.kind === "AXIS_WEAK" && w.field === "event")).toBe(
      false,
    );

    const over = Array.from({ length: 10 }, (_, i) => makeRow({ eventSame: i < 5, eventApplicable: true })); // 50%
    const w = aggregatePortfolio(over).warnings.find((w) => w.kind === "AXIS_WEAK" && w.field === "event");
    expect(w).toBeDefined();
  });

  it("AXIS_WEAK: NOT_APPLICABLE(=applicable false) 행은 분모에서 빠져 비율에 영향 없음", () => {
    // applicable 2건 중 1건 SAME(50%) + NOT_APPLICABLE 8건 추가 — 분모가 10으로 늘어나면 안 됨
    const rows = [
      makeRow({ eventSame: true, eventApplicable: true }),
      makeRow({ eventSame: false, eventApplicable: true }),
      ...Array.from({ length: 8 }, () => makeRow({ eventApplicable: false })),
    ];
    const p = aggregatePortfolio(rows);
    expect(p.reconstructionAxes.event).toEqual({ same: 1, applicable: 2 });
    expect(p.warnings.some((w) => w.kind === "AXIS_WEAK" && w.field === "event")).toBe(true); // 1/2 = 50% >= 임계
  });
});
