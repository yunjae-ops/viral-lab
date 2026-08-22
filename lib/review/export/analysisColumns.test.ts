import { describe, it, expect } from "vitest";
import { ANALYSIS_COLUMN_HEADERS, buildAnalysisRowCells, type RowExportEntry } from "./analysisColumns";
import type { RowAnalysis } from "@/lib/schema/rowAnalysis";

function fakeResultWithRef(): RowAnalysis {
  return {
    index: 0,
    hygiene: {
      gates: {
        G1_self_contained: { pass: true, evidence: "e1" },
        G2_discovery: { pass: false, evidence: "e2" },
        G3_narrative: { pass: true, evidence: "e3" },
        G4_causal_structure: { pass: false, evidence: "e4" },
      },
      passedCount: 2,
      grade: "FAIL",
    },
    critical: {
      reference: { coreAppeal: "핵심소구", viralEngine: "바이럴엔진" },
      draftCoreAppeal: "작성안소구",
      appealTransfer: { value: "PARTIAL", evidence: "at근거", deviationPoint: "이탈지점텍스트" },
      productCuriosity: { value: "MEDIUM", evidence: "pc근거" },
      searchMotivation: { value: "WEAK", evidence: "sm근거", liftDirection: "sm수정방향" },
      reconstruction: {
        persona: { value: "SAME", referenceSummary: "r", draftSummary: "d", evidence: "e" },
        event: { value: "CHANGED", referenceSummary: "r", draftSummary: "d", evidence: "e" },
        deficiencyTrigger: { value: "ADDED", referenceSummary: null, draftSummary: "d", evidence: "e" },
        endingMethod: { value: "SAME", referenceType: "정보 질문", draftType: "관찰", evidence: "e" },
        obstacle: {
          referenceHasObstacle: true,
          draftHasObstacle: true,
          functionPreserved: true,
          detailsTransformed: false,
          evidence: "장애물근거",
        },
        surfaceCloneRisk: { value: "HIGH", quotedFragments: ["특이표현1", "특이표현2"], evidence: "clone근거" },
        unchangedCount: 2,
        applicableCount: 4,
        verdict: "TOO_CLOSE",
        evidence: "겹침지점",
        revisionDirection: "재구성수정방향",
      },
    },
    diagnostic: {
      hookCode: "NEW_PATTERN_CANDIDATE",
      hookCodeReason: "hook근거",
      newPatternCandidate: {
        whyDifferent: "w",
        structureSummary: "s",
        proposedName: "새패턴이름",
        linguisticFeatures: ["f1"],
      },
      emotion: { value: "OTHER", otherLabel: "혼합감정" },
      speaker: { value: "본인 1인칭", otherLabel: null },
      disclosureMode: { value: "리스트", otherLabel: null },
      listHomogeneity: { applicable: true, pass: true, evidence: "e" },
      salesMessageStandsOut: { pass: false, evidence: "너무 판매 느낌" },
      healthClaimsToVerify: ["주장1", "주장2"],
      topProblems: ["문제1", "문제2"],
      revisionDirection: "구조수정방향텍스트",
    },
    finalVerdict: { value: "FAIL", reasons: ["hygiene.grade = FAIL", "searchMotivation = WEAK"] },
    meta: { model: "m", promptVersion: "v3", elapsedMs: 1 },
  };
}

function fakeResultNoRef(): RowAnalysis {
  return {
    index: 1,
    hygiene: {
      gates: {
        G1_self_contained: { pass: true, evidence: "e" },
        G2_discovery: { pass: true, evidence: "e" },
        G3_narrative: { pass: true, evidence: "e" },
        G4_causal_structure: { pass: true, evidence: "e" },
      },
      passedCount: 4,
      grade: "A",
    },
    critical: {
      reference: null,
      draftCoreAppeal: "작성안소구2",
      appealTransfer: null,
      productCuriosity: { value: "STRONG", evidence: "e" },
      searchMotivation: { value: "STRONG", evidence: "e", liftDirection: "d" },
      reconstruction: null,
    },
    diagnostic: {
      hookCode: "A",
      hookCodeReason: "r",
      newPatternCandidate: null,
      emotion: { value: "시크함", otherLabel: null },
      speaker: { value: "본인 1인칭", otherLabel: null },
      disclosureMode: { value: "직접서술", otherLabel: null },
      listHomogeneity: { applicable: false, pass: true, evidence: "e" },
      salesMessageStandsOut: { pass: true, evidence: "정상" },
      healthClaimsToVerify: [],
      topProblems: ["문제A"],
      revisionDirection: "수정방향A",
    },
    finalVerdict: { value: "READY", reasons: ["ok"] },
    meta: { model: "m", promptVersion: "v3", elapsedMs: 1 },
  };
}

function headerIndex(label: string): number {
  const i = ANALYSIS_COLUMN_HEADERS.indexOf(label);
  if (i === -1) throw new Error(`컬럼을 찾을 수 없음: ${label}`);
  return i;
}

describe("buildAnalysisRowCells", () => {
  it("entry가 없으면(원래 빈 행 등) 전부 공란이다", () => {
    const cells = buildAnalysisRowCells(undefined);
    expect(cells).toHaveLength(ANALYSIS_COLUMN_HEADERS.length);
    expect(cells.every((c) => c === "")).toBe(true);
  });

  it("WAITING(미분석) 행은 상태만 표시하고 분석 데이터는 공란이다", () => {
    const entry: RowExportEntry = { status: "WAITING", result: null, error: null };
    const cells = buildAnalysisRowCells(entry);
    expect(cells[headerIndex("분석상태")]).toBe("미분석");
    expect(cells[headerIndex("Hygiene등급")]).toBe("");
    expect(cells[headerIndex("최종판정")]).toBe("");
  });

  it("FAILED 행은 상태+실패사유만 채우고 분석 데이터는 공란이다 — 가짜 결과를 만들지 않는다", () => {
    const entry: RowExportEntry = { status: "FAILED", result: null, error: "ENV_MISSING: API 키 없음" };
    const cells = buildAnalysisRowCells(entry);
    expect(cells[headerIndex("분석상태")]).toBe("실패");
    expect(cells[headerIndex("실패사유")]).toBe("ENV_MISSING: API 키 없음");
    expect(cells[headerIndex("최종판정")]).toBe("");
    expect(cells[headerIndex("Hygiene등급")]).toBe("");
  });

  it("레퍼런스 있는 완료 행 — 모든 필드가 실제 스키마 값 그대로 매핑된다", () => {
    const entry: RowExportEntry = { status: "COMPLETED", result: fakeResultWithRef(), error: null };
    const cells = buildAnalysisRowCells(entry);

    expect(cells[headerIndex("분석상태")]).toBe("완료");
    expect(cells[headerIndex("Hygiene등급")]).toBe("FAIL");
    expect(cells[headerIndex("G1_본문완결")]).toBe("PASS");
    expect(cells[headerIndex("G2_발견전환")]).toBe("FAIL");
    expect(cells[headerIndex("Hygiene실패이유")]).toContain("G2: e2");
    expect(cells[headerIndex("Hygiene실패이유")]).toContain("G4: e4");

    expect(cells[headerIndex("참조소구")]).toBe("핵심소구");
    expect(cells[headerIndex("참조바이럴엔진")]).toBe("바이럴엔진");
    expect(cells[headerIndex("작성안소구")]).toBe("작성안소구");
    expect(cells[headerIndex("AppealTransfer")]).toBe("PARTIAL");
    expect(cells[headerIndex("이탈지점")]).toBe("이탈지점텍스트");

    expect(cells[headerIndex("재구성판정")]).toBe("TOO_CLOSE");
    expect(cells[headerIndex("Unchanged")]).toBe("2/4");
    expect(cells[headerIndex("Persona")]).toBe("SAME");
    expect(cells[headerIndex("결핍계기")]).toBe("ADDED");
    expect(cells[headerIndex("장애물_기능유지")]).toBe("예");
    expect(cells[headerIndex("장애물_세부재구성")]).toBe("아니오");
    expect(cells[headerIndex("SurfaceCloneRisk")]).toBe("HIGH");
    expect(cells[headerIndex("SurfaceClone인용")]).toBe("특이표현1 | 특이표현2");

    expect(cells[headerIndex("Hook")]).toBe("NEW_PATTERN_CANDIDATE");
    expect(cells[headerIndex("NewPatternName")]).toBe("새패턴이름");
    expect(cells[headerIndex("감정")]).toBe("OTHER");
    expect(cells[headerIndex("감정_기타라벨")]).toBe("혼합감정");

    expect(cells[headerIndex("판매튐")]).toContain("튐");
    expect(cells[headerIndex("건강주장")]).toBe("주장1 | 주장2");
    expect(cells[headerIndex("구조문제점")]).toBe("문제1 | 문제2");
    expect(cells[headerIndex("판정근거")]).toBe("hygiene.grade = FAIL | searchMotivation = WEAK");
  });

  it("레퍼런스 없는 완료 행 — 참조/AppealTransfer/재구성 관련 셀은 전부 공란", () => {
    const entry: RowExportEntry = { status: "CACHED", result: fakeResultNoRef(), error: null };
    const cells = buildAnalysisRowCells(entry);

    expect(cells[headerIndex("분석상태")]).toBe("완료(캐시)");
    expect(cells[headerIndex("참조소구")]).toBe("");
    expect(cells[headerIndex("참조바이럴엔진")]).toBe("");
    expect(cells[headerIndex("AppealTransfer")]).toBe("");
    expect(cells[headerIndex("이탈지점")]).toBe("");
    expect(cells[headerIndex("재구성판정")]).toBe("");
    expect(cells[headerIndex("Unchanged")]).toBe("");
    expect(cells[headerIndex("Persona")]).toBe("");
    expect(cells[headerIndex("SurfaceCloneRisk")]).toBe("");

    // ref 유무와 무관하게 항상 채워지는 필드
    expect(cells[headerIndex("작성안소구")]).toBe("작성안소구2");
    expect(cells[headerIndex("제품호기심")]).toBe("STRONG");
    expect(cells[headerIndex("검색동기")]).toBe("STRONG");
    expect(cells[headerIndex("최종판정")]).toBe("READY");
  });
});
