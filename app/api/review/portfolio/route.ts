import { NextRequest, NextResponse } from "next/server";
import { portfolioRequestSchema } from "@/lib/schema/portfolioRecommendation";
import { aggregatePortfolio } from "@/lib/review/portfolio/aggregate";
import { getPortfolioRecommendation } from "@/lib/review/portfolio/recommend";
import { MissingEnvError } from "@/lib/review/env";
import { SchemaValidationError } from "@/lib/review/analyzeRow";
import type { PortfolioRow } from "@/lib/review/portfolio/types";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON", detail: "요청 본문이 JSON이 아닙니다." }, { status: 400 });
  }

  const parsedRequest = portfolioRequestSchema.safeParse(body);
  if (!parsedRequest.success) {
    return NextResponse.json(
      {
        error: "INVALID_REQUEST",
        detail: parsedRequest.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
      },
      { status: 400 },
    );
  }

  // 클라이언트가 보낸 요약만으로 서버가 다시 결정적으로 집계한다 (AI는 이 값을 재계산하지 않는다).
  const portfolio = aggregatePortfolio(parsedRequest.data.rows as PortfolioRow[]);

  if (portfolio.totalAnalyzed === 0) {
    return NextResponse.json({ error: "NO_ANALYZED_ROWS", detail: "분석 완료된 소재가 없습니다." }, { status: 400 });
  }

  try {
    const { recommendation, meta } = await getPortfolioRecommendation(portfolio);
    return NextResponse.json({ ...portfolio, recommendation, meta });
  } catch (err) {
    if (err instanceof MissingEnvError) {
      return NextResponse.json({ error: "ENV_MISSING", detail: err.message }, { status: 500 });
    }
    if (err instanceof SchemaValidationError) {
      return NextResponse.json({ error: "SCHEMA_VALIDATION_FAILED", detail: err.detail }, { status: 422 });
    }
    const detail = err instanceof Error ? err.message : "알 수 없는 오류";
    return NextResponse.json({ error: "RECOMMEND_FAILED", detail }, { status: 502 });
  }
}
