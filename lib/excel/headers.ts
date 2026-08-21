export const HEADER_ORDER = "순서" as const;
export const HEADER_REF_URL_CANONICAL = "/제목" as const;
export const HEADER_DRAFT_CANONICAL = "리뷰내용" as const;
export const HEADER_IMAGE = "이미지 파일명" as const;
export const HEADER_REF_ORIGINAL = "레퍼런스 원문" as const;

export const REF_URL_ALIASES = [HEADER_REF_URL_CANONICAL, "레퍼런스 링크"] as const;
export const DRAFT_ALIASES = [HEADER_DRAFT_CANONICAL, "작성안", "작성한 글"] as const;

export const HEADER_SEARCH_LIMIT = 20;

export type HeaderMap = {
  headerRowIndex: number;
  order: number;
  refUrl: number;
  draft: number;
  image: number | null;
  refOriginal: number | null;
  matchedAliases: {
    refUrl: string;
    draft: string;
  };
};

const normalize = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  return String(v).trim();
};

const findColumn = (row: unknown[], candidates: readonly string[]): { col: number; matched: string } | null => {
  for (let c = 0; c < row.length; c++) {
    const cell = normalize(row[c]);
    if (!cell) continue;
    if (candidates.includes(cell as (typeof candidates)[number])) {
      return { col: c, matched: cell };
    }
  }
  return null;
};

export function detectHeader(rows: unknown[][]): HeaderMap {
  const limit = Math.min(rows.length, HEADER_SEARCH_LIMIT);
  for (let r = 0; r < limit; r++) {
    const row = rows[r] ?? [];
    const orderCol = findColumn(row, [HEADER_ORDER]);
    const refUrlCol = findColumn(row, REF_URL_ALIASES);
    const draftCol = findColumn(row, DRAFT_ALIASES);
    if (orderCol && refUrlCol && draftCol) {
      const imageCol = findColumn(row, [HEADER_IMAGE]);
      const refOriginalCol = findColumn(row, [HEADER_REF_ORIGINAL]);
      return {
        headerRowIndex: r,
        order: orderCol.col,
        refUrl: refUrlCol.col,
        draft: draftCol.col,
        image: imageCol ? imageCol.col : null,
        refOriginal: refOriginalCol ? refOriginalCol.col : null,
        matchedAliases: {
          refUrl: refUrlCol.matched,
          draft: draftCol.matched,
        },
      };
    }
  }
  throw new HeaderDetectionError(
    `Header 행을 찾을 수 없습니다. 첫 ${HEADER_SEARCH_LIMIT}행 안에 필수 3종(순서, /제목|레퍼런스 링크, 리뷰내용|작성안|작성한 글)이 모두 있는 행이 필요합니다.`,
  );
}

export class HeaderDetectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HeaderDetectionError";
  }
}
