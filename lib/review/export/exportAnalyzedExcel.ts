import * as XLSX from "xlsx";
import type { HeaderMap } from "@/lib/excel/headers";
import type { ParsedRow } from "@/lib/excel/parse";
import { buildAnalyzedWorkbook } from "./buildAnalyzedWorkbook";
import { buildAnalyzedFilename } from "./filename";
import type { RowExportEntry } from "./analysisColumns";

// 원본 File을 다시 읽어(=원본 자체는 절대 수정하지 않음) 분석 열을 덧붙인 새 workbook을
// 만들고 브라우저에서 바로 다운로드시킨다. Claude API 호출 없음 — Phase 3 캐시/상태에서
// 이미 만들어진 결과만 사용한다.
export async function exportAnalyzedExcel(params: {
  file: File;
  sheetName: string;
  header: HeaderMap;
  rows: ParsedRow[];
  entries: Map<number, RowExportEntry>;
}): Promise<void> {
  const { file, sheetName, header, rows, entries } = params;

  const buf = await file.arrayBuffer();
  const workbook = XLSX.read(buf, { type: "array" });
  buildAnalyzedWorkbook(workbook, sheetName, header, rows, entries);

  const outBuf = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  const blob = new Blob([outBuf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = buildAnalyzedFilename(file.name);
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
