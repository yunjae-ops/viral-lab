import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as XLSX from "xlsx";
import { parseWorkbookFromFile } from "@/lib/excel/parse";
import { exportAnalyzedExcel } from "./exportAnalyzedExcel";
import { ANALYSIS_COLUMN_HEADERS, type RowExportEntry } from "./analysisColumns";

function buildWorkbook(rows: (string | number | null)[][]): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  return wb;
}

function toFile(wb: XLSX.WorkBook, name: string): File {
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new File([buf], name, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

const ROWS: (string | number | null)[][] = [
  ["순서", "/제목", "리뷰내용", "레퍼런스 원문"],
  ["1", "https://threads.net/1", "draft1", "ref1"],
];

type FakeAnchor = { href: string; download: string; clicked: boolean; click: () => void };

let createdAnchors: FakeAnchor[];
let fetchCalled: boolean;
let capturedBlob: Blob | null;
const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;
const originalFetch = globalThis.fetch;
const originalDocument = (globalThis as unknown as { document?: unknown }).document;

beforeEach(() => {
  createdAnchors = [];
  fetchCalled = false;
  capturedBlob = null;

  (globalThis as unknown as { document: unknown }).document = {
    createElement: (_tag: string) => {
      const anchor: FakeAnchor = {
        href: "",
        download: "",
        clicked: false,
        click() {
          this.clicked = true;
        },
      };
      createdAnchors.push(anchor);
      return anchor;
    },
    body: {
      appendChild: () => {},
      removeChild: () => {},
    },
  };

  URL.createObjectURL = ((blob: Blob) => {
    capturedBlob = blob;
    return originalCreateObjectURL(blob);
  }) as typeof URL.createObjectURL;
  URL.revokeObjectURL = (() => {}) as typeof URL.revokeObjectURL;

  globalThis.fetch = (() => {
    fetchCalled = true;
    throw new Error("export should never call fetch (no Claude API calls)");
  }) as typeof fetch;
});

afterEach(() => {
  (globalThis as unknown as { document: unknown }).document = originalDocument;
  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;
  globalThis.fetch = originalFetch;
});

describe("exportAnalyzedExcel", () => {
  it("다운로드 중 fetch(Claude API 등)를 전혀 호출하지 않는다", async () => {
    const wb = buildWorkbook(ROWS);
    const file = toFile(wb, "fixturev3.xlsx");
    const parsed = await parseWorkbookFromFile(file);

    await exportAnalyzedExcel({
      file,
      sheetName: parsed.sheetName,
      header: parsed.header,
      rows: parsed.rows,
      entries: new Map(),
    });

    expect(fetchCalled).toBe(false);
  });

  it("올바른 파일명으로 다운로드 링크를 만들고 클릭한다", async () => {
    const wb = buildWorkbook(ROWS);
    const file = toFile(wb, "threads_test.xls");
    const parsed = await parseWorkbookFromFile(file);

    await exportAnalyzedExcel({
      file,
      sheetName: parsed.sheetName,
      header: parsed.header,
      rows: parsed.rows,
      entries: new Map(),
    });

    expect(createdAnchors).toHaveLength(1);
    expect(createdAnchors[0].download).toBe("threads_test_ANALYZED.xlsx");
    expect(createdAnchors[0].clicked).toBe(true);
    expect(createdAnchors[0].href).toMatch(/^blob:/);
  });

  it("만들어진 파일을 다시 읽으면 분석 열이 실제로 들어있다", async () => {
    const wb = buildWorkbook(ROWS);
    const file = toFile(wb, "fixturev3.xlsx");
    const parsed = await parseWorkbookFromFile(file);
    const row = parsed.rows[0];

    const entries = new Map<number, RowExportEntry>([
      [
        row.index,
        {
          status: "COMPLETED",
          result: {
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
              hookCode: "A",
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
            finalVerdict: { value: "READY", reasons: ["ok"] },
            meta: { model: "m", promptVersion: "v3", elapsedMs: 1 },
          },
          error: null,
        },
      ],
    ]);

    await exportAnalyzedExcel({ file, sheetName: parsed.sheetName, header: parsed.header, rows: parsed.rows, entries });

    expect(capturedBlob).not.toBeNull();
    const buf = await capturedBlob!.arrayBuffer();
    const outWb = XLSX.read(buf, { type: "array" });
    const ws = outWb.Sheets.Sheet1;

    const startCol = 4; // 원본 순서/제목/리뷰내용/레퍼런스원문 4열 다음
    const headerRow = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null })[0] as unknown[];
    expect(headerRow[startCol]).toBe(ANALYSIS_COLUMN_HEADERS[0]);

    const finalVerdictCol = startCol + ANALYSIS_COLUMN_HEADERS.indexOf("최종판정");
    const dataRow = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null })[1] as unknown[];
    expect(dataRow[finalVerdictCol]).toBe("READY");

    // 원본 데이터 열은 그대로.
    expect(dataRow[0]).toBe("1");
    expect(dataRow[2]).toBe("draft1");
  });
});
