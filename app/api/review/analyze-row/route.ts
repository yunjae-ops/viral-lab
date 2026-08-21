import { NextRequest, NextResponse } from "next/server";
import { analyzeRowRequestSchema } from "@/lib/schema/rowAnalysis";
import { analyzeRow, SchemaValidationError } from "@/lib/review/analyzeRow";
import { MissingEnvError } from "@/lib/review/env";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON", detail: "요청 본문이 JSON이 아닙니다." }, { status: 400 });
  }

  const parsedRequest = analyzeRowRequestSchema.safeParse(body);
  if (!parsedRequest.success) {
    return NextResponse.json(
      {
        error: "INVALID_REQUEST",
        detail: parsedRequest.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
      },
      { status: 400 },
    );
  }

  const { index, draft, refOriginal } = parsedRequest.data;

  try {
    const { ai, meta } = await analyzeRow({ draft, refOriginal });
    return NextResponse.json({ index, ...ai, meta });
  } catch (err) {
    if (err instanceof MissingEnvError) {
      return NextResponse.json({ error: "ENV_MISSING", detail: err.message }, { status: 500 });
    }
    if (err instanceof SchemaValidationError) {
      return NextResponse.json({ error: "SCHEMA_VALIDATION_FAILED", detail: err.detail }, { status: 422 });
    }
    const detail = err instanceof Error ? err.message : "알 수 없는 오류";
    return NextResponse.json({ error: "ANALYZE_FAILED", detail }, { status: 502 });
  }
}
