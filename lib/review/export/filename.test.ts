import { describe, it, expect } from "vitest";
import { buildAnalyzedFilename } from "./filename";

describe("buildAnalyzedFilename", () => {
  it("xlsx 파일에 _ANALYZED를 붙이고 확장자는 유지한다", () => {
    expect(buildAnalyzedFilename("fixturev3.xlsx")).toBe("fixturev3_ANALYZED.xlsx");
  });

  it("xls 파일은 출력 확장자를 항상 .xlsx로 바꾼다", () => {
    expect(buildAnalyzedFilename("threads_test.xls")).toBe("threads_test_ANALYZED.xlsx");
  });

  it("이미 _ANALYZED가 붙어있으면 중복으로 계속 붙이지 않는다", () => {
    expect(buildAnalyzedFilename("fixturev3_ANALYZED.xlsx")).toBe("fixturev3_ANALYZED.xlsx");
    expect(buildAnalyzedFilename("fixturev3_ANALYZED_ANALYZED.xlsx")).toBe("fixturev3_ANALYZED.xlsx");
  });

  it("확장자가 없는 파일명도 처리한다", () => {
    expect(buildAnalyzedFilename("noext")).toBe("noext_ANALYZED.xlsx");
  });

  it("파일명 중간에 있는 점은 확장자 구분에 영향 없다", () => {
    expect(buildAnalyzedFilename("2026.08.review.xlsx")).toBe("2026.08.review_ANALYZED.xlsx");
  });
});
