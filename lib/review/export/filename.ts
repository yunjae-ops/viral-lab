// 원본 파일명 → ANALYZED 파일명 (CLAUDE.md §2-3: 원본은 절대 덮어쓰지 않는다).
// "fixturev3.xlsx" → "fixturev3_ANALYZED.xlsx"
// "threads_test.xls" → "threads_test_ANALYZED.xlsx" (출력은 항상 .xlsx)
// 이미 "_ANALYZED"가 붙어 있으면 중복으로 계속 붙이지 않는다.
export function buildAnalyzedFilename(originalFileName: string): string {
  const dotIndex = originalFileName.lastIndexOf(".");
  const base = dotIndex > 0 ? originalFileName.slice(0, dotIndex) : originalFileName;
  const cleanBase = base.replace(/(_ANALYZED)+$/i, "");
  return `${cleanBase}_ANALYZED.xlsx`;
}
