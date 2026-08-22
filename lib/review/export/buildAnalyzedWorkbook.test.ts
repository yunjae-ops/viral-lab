import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseWorkbookFromFile } from "@/lib/excel/parse";
import { buildAnalyzedWorkbook } from "./buildAnalyzedWorkbook";
import { ANALYSIS_COLUMN_HEADERS, type RowExportEntry } from "./analysisColumns";
import type { RowAnalysis } from "@/lib/schema/rowAnalysis";

function buildWorkbook(sheets: Record<string, (string | number | null)[][]>): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  return wb;
}

function toFile(wb: XLSX.WorkBook, name = "fixturev3.xlsx"): File {
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new File([buf], name, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

function minimalResult(overrides: Partial<{ finalVerdict: RowAnalysis["finalVerdict"]["value"]; hookCode: string }> = {}): RowAnalysis {
  return {
    index: 0,
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
      reference: { coreAppeal: "appeal", viralEngine: "engine" },
      draftCoreAppeal: "draft appeal",
      appealTransfer: { value: "STRONG", evidence: "e", deviationPoint: null },
      productCuriosity: { value: "STRONG", evidence: "e" },
      searchMotivation: { value: "STRONG", evidence: "e", liftDirection: "d" },
      reconstruction: {
        persona: { value: "CHANGED", referenceSummary: "r", draftSummary: "d", evidence: "e" },
        event: { value: "CHANGED", referenceSummary: "r", draftSummary: "d", evidence: "e" },
        deficiencyTrigger: { value: "CHANGED", referenceSummary: "r", draftSummary: "d", evidence: "e" },
        endingMethod: { value: "CHANGED", referenceType: "정보 질문", draftType: "관찰", evidence: "e" },
        obstacle: {
          referenceHasObstacle: false,
          draftHasObstacle: false,
          functionPreserved: null,
          detailsTransformed: null,
          evidence: "e",
        },
        surfaceCloneRisk: { value: "LOW", quotedFragments: [], evidence: "e" },
        unchangedCount: 0,
        applicableCount: 4,
        verdict: "TRANSFORMED",
        evidence: "e",
        revisionDirection: "d",
      },
    },
    diagnostic: {
      hookCode: (overrides.hookCode ?? "A") as RowAnalysis["diagnostic"]["hookCode"],
      hookCodeReason: "r",
      newPatternCandidate: null,
      emotion: { value: "시크함", otherLabel: null },
      speaker: { value: "본인 1인칭", otherLabel: null },
      disclosureMode: { value: "직접서술", otherLabel: null },
      listHomogeneity: { applicable: false, pass: true, evidence: "e" },
      salesMessageStandsOut: { pass: true, evidence: "e" },
      healthClaimsToVerify: [],
      topProblems: ["p"],
      revisionDirection: "d",
    },
    finalVerdict: { value: overrides.finalVerdict ?? "READY", reasons: ["r"] },
    meta: { model: "m", promptVersion: "v3", elapsedMs: 1 },
  };
}

// Header가 6번째 행(0-index 5)에 있고, 중간 빈 행 / 빈 draft로 스킵되는 행이 섞인 fixture.
// row(0-idx) 0~4: 안내/여백, 5: header, 6~7: 데이터, 8: 완전 빈 행, 9: 데이터(ref 없음),
// 10: draft 비어서 스킵될 행, 11~12: 데이터.
const SHEET1_ROWS: (string | number | null)[][] = [
  ["이 파일은 Threads 리뷰용입니다"],
  [],
  ["작성 가이드: 순서대로 채워주세요"],
  [],
  [],
  ["순서", "/제목", "리뷰내용", "레퍼런스 원문"],
  ["1", "https://threads.net/1", "draft1 내용", "ref1 원문"],
  ["2", "https://threads.net/2", "draft2 내용", "ref2 원문"],
  [], // 중간 빈 행
  ["3", "https://threads.net/3", "draft3 내용", null], // 레퍼런스 없음
  ["4", "https://threads.net/4", "", "ref4 원문"], // draft 비어서 스킵
  ["5", "https://threads.net/5", "draft5 내용", "ref5 원문"],
  ["6", "https://threads.net/6", "draft6 내용", "ref6 원문"],
];

const SHEET2_ROWS: (string | number | null)[][] = [
  ["다른 데이터", "col2"],
  ["foo", "bar"],
  ["baz", "qux"],
];

async function buildFixture() {
  const wb = buildWorkbook({ Sheet1: SHEET1_ROWS, Sheet2: SHEET2_ROWS });
  const file = toFile(wb);
  const parsed = await parseWorkbookFromFile(file);
  return { wb, file, parsed };
}

describe("buildAnalyzedWorkbook", () => {
  it("header가 1행이 아니어도 정확한 header 오른쪽에 분석 열이 추가된다", async () => {
    const { parsed } = await buildFixture();
    expect(parsed.header.headerRowIndex).toBe(5); // 6번째 행 (0-index 5)

    const wb2 = buildWorkbook({ Sheet1: SHEET1_ROWS, Sheet2: SHEET2_ROWS });
    const entries = new Map<number, RowExportEntry>();
    buildAnalyzedWorkbook(wb2, parsed.sheetName, parsed.header, parsed.rows, entries);

    const ws = wb2.Sheets.Sheet1;
    const range = XLSX.utils.decode_range(ws["!ref"]!);
    // 원본은 4열(A~D, 0~3) 이었으므로 새 분석 헤더는 col index 4(E)부터 시작해야 한다.
    const headerCell = ws[XLSX.utils.encode_cell({ r: 5, c: 4 })];
    expect(headerCell.v).toBe(ANALYSIS_COLUMN_HEADERS[0]);
    expect(range.e.c).toBe(4 + ANALYSIS_COLUMN_HEADERS.length - 1);
  });

  it("원본 셀 데이터는 전혀 변경되지 않는다", async () => {
    const { parsed } = await buildFixture();
    const wb2 = buildWorkbook({ Sheet1: SHEET1_ROWS, Sheet2: SHEET2_ROWS });
    buildAnalyzedWorkbook(wb2, parsed.sheetName, parsed.header, parsed.rows, new Map());

    const aoa = XLSX.utils.sheet_to_json<unknown[]>(wb2.Sheets.Sheet1, { header: 1, defval: null, raw: true });
    for (let r = 0; r < SHEET1_ROWS.length; r++) {
      for (let c = 0; c < 4; c++) {
        expect(aoa[r]?.[c] ?? null).toBe(SHEET1_ROWS[r]?.[c] ?? null);
      }
    }
  });

  it("다른 Sheet(Sheet2)는 완전히 유지되고 분석 열이 추가되지 않는다", async () => {
    const { parsed } = await buildFixture();
    const wb2 = buildWorkbook({ Sheet1: SHEET1_ROWS, Sheet2: SHEET2_ROWS });
    buildAnalyzedWorkbook(wb2, parsed.sheetName, parsed.header, parsed.rows, new Map());

    const aoa = XLSX.utils.sheet_to_json<unknown[]>(wb2.Sheets.Sheet2, { header: 1, defval: null, raw: true });
    expect(aoa).toEqual(SHEET2_ROWS);
  });

  it("분석 완료 행만 정확한 원본 행 번호에 결과가 들어간다 (중간 빈 행/스킵 행이 있어도 밀리지 않음)", async () => {
    const { parsed } = await buildFixture();
    expect(parsed.rows).toHaveLength(5); // draft4(빈 값)는 스킵되어 5건만 남는다

    const [row1, row2, row3, row5, row6] = parsed.rows;
    expect(row1.draft).toBe("draft1 내용");
    expect(row1.sheetRowNumber).toBe(7); // 0-idx 6 → 1-idx 7
    expect(row2.sheetRowNumber).toBe(8);
    expect(row3.sheetRowNumber).toBe(10); // 빈 행(0-idx 8) 다음
    expect(row5.sheetRowNumber).toBe(12); // draft 빈 "4번" 행(0-idx 10)을 건너뜀
    expect(row6.sheetRowNumber).toBe(13);

    const entries = new Map<number, RowExportEntry>([
      [row1.index, { status: "COMPLETED", result: minimalResult({ finalVerdict: "READY" }), error: null }],
      [row2.index, { status: "FAILED", result: null, error: "SCHEMA_VALIDATION_FAILED: boom" }],
      // row3(index2)은 WAITING — entries에 아예 없는 경우도 시뮬레이션
      [row5.index, { status: "CACHED", result: minimalResult({ finalVerdict: "FAIL" }), error: null }],
      [row6.index, { status: "WAITING", result: null, error: null }],
    ]);

    const wb2 = buildWorkbook({ Sheet1: SHEET1_ROWS, Sheet2: SHEET2_ROWS });
    buildAnalyzedWorkbook(wb2, parsed.sheetName, parsed.header, parsed.rows, entries);
    const ws = wb2.Sheets.Sheet1;

    const startCol = 4;
    const statusCol = startCol + ANALYSIS_COLUMN_HEADERS.indexOf("분석상태");
    const verdictCol = startCol + ANALYSIS_COLUMN_HEADERS.indexOf("최종판정");
    const errorCol = startCol + ANALYSIS_COLUMN_HEADERS.indexOf("실패사유");

    const cellAt = (r: number, c: number) => ws[XLSX.utils.encode_cell({ r, c })]?.v ?? null;

    // row1 → sheetRowNumber 7 → 0-idx row 6
    expect(cellAt(6, statusCol)).toBe("완료");
    expect(cellAt(6, verdictCol)).toBe("READY");

    // row2 → sheetRowNumber 8 → 0-idx row 7: FAILED, 실제 분석 데이터는 없어야 함
    expect(cellAt(7, statusCol)).toBe("실패");
    expect(cellAt(7, errorCol)).toBe("SCHEMA_VALIDATION_FAILED: boom");
    expect(cellAt(7, verdictCol)).toBeNull();

    // 중간 빈 행(0-idx row 8)은 원래부터 rows에 없으므로 분석 셀 자체가 생기지 않는다
    expect(cellAt(8, statusCol)).toBeNull();

    // row3 → sheetRowNumber 10 → 0-idx row 9: entries에 없음 → 완전 공란(상태도 없음)
    expect(cellAt(9, statusCol)).toBeNull();

    // draft가 비어 스킵된 "4번" 행(0-idx row 10)도 rows에 없으므로 손대지 않는다
    expect(cellAt(10, statusCol)).toBeNull();

    // row5 → sheetRowNumber 12 → 0-idx row 11
    expect(cellAt(11, statusCol)).toBe("완료(캐시)");
    expect(cellAt(11, verdictCol)).toBe("FAIL");

    // row6 → sheetRowNumber 13 → 0-idx row 12: WAITING → 상태만, 분석 데이터 없음
    expect(cellAt(12, statusCol)).toBe("미분석");
    expect(cellAt(12, verdictCol)).toBeNull();
  });

  it("빈 draft로 스킵된 행과 완전히 빈 행 모두 절대 Claude 결과가 들어가지 않는다", async () => {
    const { parsed } = await buildFixture();
    const analyzedRowIndexes = new Set(parsed.rows.map((r) => r.sheetRowNumber));
    // 0-idx 8(완전 빈 행 → sheetRowNumber 9), 0-idx 10(draft 빈 "4번" → sheetRowNumber 11)
    expect(analyzedRowIndexes.has(9)).toBe(false);
    expect(analyzedRowIndexes.has(11)).toBe(false);
  });
});
