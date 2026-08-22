import * as XLSX from "xlsx";
import type { HeaderMap } from "@/lib/excel/headers";
import type { ParsedRow } from "@/lib/excel/parse";
import { ANALYSIS_COLUMN_HEADERS, buildAnalysisRowCells, type RowExportEntry } from "./analysisColumns";

// 분석 대상이 아닌 다른 Sheet, 다른 셀은 절대 건드리지 않는다. 전달받은 workbook은
// 호출부가 File을 방금 새로 읽어 만든 것이라고 가정하고 그 자리에서 컬럼을 덧붙인다
// (SheetJS에 워크북 deep-clone API가 없고, 매 export마다 원본 File에서 새로 읽으므로
// 원본 파일 자체나 이미 화면에 표시 중인 다른 workbook 인스턴스에는 영향이 없다).
export function buildAnalyzedWorkbook(
  workbook: XLSX.WorkBook,
  sheetName: string,
  header: HeaderMap,
  rows: ParsedRow[],
  entries: Map<number, RowExportEntry>,
): XLSX.WorkBook {
  const ws = workbook.Sheets[sheetName];
  if (!ws) {
    throw new Error(`시트를 찾을 수 없습니다: ${sheetName}`);
  }
  if (!ws["!ref"]) {
    throw new Error("시트에 데이터가 없어 분석 결과를 추가할 수 없습니다.");
  }

  const range = XLSX.utils.decode_range(ws["!ref"]);
  const startCol = range.e.c + 1; // 기존 데이터 바로 오른쪽 — 원본 열 순서를 건드리지 않는다.

  ANALYSIS_COLUMN_HEADERS.forEach((label, i) => {
    const cellRef = XLSX.utils.encode_cell({ r: header.headerRowIndex, c: startCol + i });
    ws[cellRef] = { t: "s", v: label };
  });

  let maxRow = Math.max(range.e.r, header.headerRowIndex);

  for (const row of rows) {
    // sheetRowNumber는 Phase 1 파싱 시 기록한 원본 시트의 실제 1-index 행 번호다
    // (중간 빈 행·헤더 오프셋과 무관하게 항상 정확한 원본 행을 가리킨다).
    const r = row.sheetRowNumber - 1;
    const entry = entries.get(row.index);
    const cells = buildAnalysisRowCells(entry);

    cells.forEach((value, i) => {
      if (value === "") return; // 빈 값은 셀을 만들지 않는다 — 원래 빈 칸처럼 보이게.
      const cellRef = XLSX.utils.encode_cell({ r, c: startCol + i });
      ws[cellRef] = { t: "s", v: value };
    });

    maxRow = Math.max(maxRow, r);
  }

  ws["!ref"] = XLSX.utils.encode_range({
    s: range.s,
    e: { r: maxRow, c: startCol + ANALYSIS_COLUMN_HEADERS.length - 1 },
  });

  return workbook;
}
