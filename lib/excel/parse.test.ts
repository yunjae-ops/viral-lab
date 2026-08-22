import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseWorkbookFromFile } from "./parse";

function buildWorkbookFile(rows: (string | number | null)[][]): File {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return new File([buf], "test.xlsx", {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

describe("parseWorkbookFromFile", () => {
  it("빈 리뷰내용 행은 결과에서 제외되고 skippedEmptyDraftCount로 집계된다", async () => {
    const file = buildWorkbookFile([
      ["안내문입니다"],
      [],
      ["순서", "/제목", "리뷰내용", "이미지 파일명", "레퍼런스 원문"],
      ["1", "https://threads.net/a", "첫 번째 작성안", "img1.png", "레퍼런스 A"],
      ["2", "https://threads.net/b", "", "img2.png", "레퍼런스 B"], // draft 비어있음 → skip
      ["3", "https://threads.net/c", "세 번째 작성안", null, null],
    ]);

    const result = await parseWorkbookFromFile(file);

    expect(result.rows).toHaveLength(2);
    expect(result.skippedEmptyDraftCount).toBe(1);
    expect(result.rows.map((r) => r.draft)).toEqual(["첫 번째 작성안", "세 번째 작성안"]);
  });

  it("각 필드를 정확히 파싱한다 (순서/링크/이미지/레퍼런스 원문 포함)", async () => {
    const file = buildWorkbookFile([
      ["순서", "/제목", "리뷰내용", "이미지 파일명", "레퍼런스 원문"],
      ["7", "https://threads.net/x", "작성안 텍스트", "photo.jpg", "레퍼런스 원문 텍스트"],
    ]);

    const result = await parseWorkbookFromFile(file);
    expect(result.rows).toHaveLength(1);
    const row = result.rows[0];
    expect(row.orderLabel).toBe("7");
    expect(row.refUrl).toBe("https://threads.net/x");
    expect(row.draft).toBe("작성안 텍스트");
    expect(row.imageFilename).toBe("photo.jpg");
    expect(row.refOriginal).toBe("레퍼런스 원문 텍스트");
    expect(result.refOriginalPresent).toBe(true);
    expect(result.imagePresent).toBe(true);
  });

  it("레퍼런스 원문 컬럼이 없으면 refOriginalPresent=false, refOriginal은 항상 null", async () => {
    const file = buildWorkbookFile([
      ["순서", "/제목", "리뷰내용"],
      ["1", "https://threads.net/x", "작성안"],
    ]);

    const result = await parseWorkbookFromFile(file);
    expect(result.refOriginalPresent).toBe(false);
    expect(result.rows[0].refOriginal).toBeNull();
  });

  it("헤더 별칭(레퍼런스 링크, 작성안)도 인식한다", async () => {
    const file = buildWorkbookFile([
      ["순서", "레퍼런스 링크", "작성안"],
      ["1", "https://threads.net/x", "작성안 내용"],
    ]);

    const result = await parseWorkbookFromFile(file);
    expect(result.rows).toHaveLength(1);
    expect(result.header.matchedAliases.refUrl).toBe("레퍼런스 링크");
    expect(result.header.matchedAliases.draft).toBe("작성안");
  });
});
