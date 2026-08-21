import * as XLSX from "xlsx";
import { detectHeader, HeaderMap } from "./headers";

export type ParsedRow = {
  index: number;
  sheetRowNumber: number;
  refUrl: string | null;
  draft: string;
  imageFilename: string | null;
  refOriginal: string | null;
};

export type ParseResult = {
  sheetName: string;
  header: HeaderMap;
  rows: ParsedRow[];
  skippedEmptyDraftCount: number;
  refOriginalPresent: boolean;
  imagePresent: boolean;
};

const cellToString = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v).trim();
  return String(v).trim();
};

const cellToNullableString = (v: unknown): string | null => {
  const s = cellToString(v);
  return s.length === 0 ? null : s;
};

export async function parseWorkbookFromFile(file: File): Promise<ParseResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    throw new Error("Excel에 시트가 없습니다.");
  }
  const sheet = wb.Sheets[sheetName];
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    blankrows: true,
    defval: null,
    raw: true,
  });

  const header = detectHeader(aoa);
  const rows: ParsedRow[] = [];
  let skipped = 0;
  let idx = 0;

  for (let r = header.headerRowIndex + 1; r < aoa.length; r++) {
    const row = aoa[r] ?? [];
    const draft = cellToString(row[header.draft]);
    if (!draft) {
      const anyPresent =
        cellToString(row[header.order]) ||
        cellToString(row[header.refUrl]) ||
        (header.image !== null && cellToString(row[header.image])) ||
        (header.refOriginal !== null && cellToString(row[header.refOriginal]));
      if (anyPresent) skipped++;
      continue;
    }

    rows.push({
      index: idx++,
      sheetRowNumber: r + 1,
      refUrl: cellToNullableString(row[header.refUrl]),
      draft,
      imageFilename:
        header.image !== null ? cellToNullableString(row[header.image]) : null,
      refOriginal:
        header.refOriginal !== null
          ? cellToNullableString(row[header.refOriginal])
          : null,
    });
  }

  return {
    sheetName,
    header,
    rows,
    skippedEmptyDraftCount: skipped,
    refOriginalPresent: header.refOriginal !== null,
    imagePresent: header.image !== null,
  };
}
