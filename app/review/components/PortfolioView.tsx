"use client";

import { useMemo } from "react";
import type { ParsedRow } from "@/lib/excel/parse";
import type { RowState } from "../hooks/useReviewWorkspace";
import { usePortfolioAnalysis } from "../hooks/usePortfolioAnalysis";
import { extractPortfolioRow } from "@/lib/review/portfolio/extract";
import type { PortfolioRow, PortfolioWarning } from "@/lib/review/portfolio/types";

export default function PortfolioView({
  rows,
  states,
  onSelectMaterial,
}: {
  rows: ParsedRow[];
  states: Record<number, RowState>;
  onSelectMaterial: (index: number) => void;
}) {
  const portfolioRows: PortfolioRow[] = useMemo(() => {
    const out: PortfolioRow[] = [];
    for (const row of rows) {
      const state = states[row.index];
      if (state && (state.status === "COMPLETED" || state.status === "CACHED") && state.result) {
        out.push(extractPortfolioRow(row.index, state.result));
      }
    }
    return out;
  }, [rows, states]);

  const { portfolio, recommendation, fromCache, status, error, fetchRecommendation } =
    usePortfolioAnalysis(portfolioRows);

  if (portfolio.totalAnalyzed === 0) {
    return (
      <section className="p-8 rounded-lg border border-slate-200 bg-white text-center text-sm text-slate-500">
        아직 분석 완료된 소재가 없습니다. "개별 소재 검토" 탭에서 전체 분석을 먼저 실행하세요.
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="p-5 rounded-lg border border-slate-200 bg-white">
        <h2 className="text-lg font-semibold mb-3">전체 상태</h2>
        <dl className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <Stat label="분석 완료" value={portfolio.totalAnalyzed} />
          <Stat label="READY" value={portfolio.counts.finalVerdict.READY} accent="text-emerald-700" />
          <Stat label="NEEDS_REVISION" value={portfolio.counts.finalVerdict.NEEDS_REVISION} accent="text-amber-700" />
          <Stat label="FAIL" value={portfolio.counts.finalVerdict.FAIL} accent="text-red-700" />
        </dl>
      </section>

      <section className="p-5 rounded-lg border border-slate-200 bg-white space-y-4">
        <h2 className="text-lg font-semibold">Viral Diversity</h2>
        <DistBar title="Hook Code" counts={portfolio.counts.hookCode} total={portfolio.totalAnalyzed} />
        <DistBar title="감정태도" counts={portfolio.counts.emotion} total={portfolio.totalAnalyzed} />
        <DistBar title="화자" counts={portfolio.counts.speaker} total={portfolio.totalAnalyzed} />
        <DistBar title="정보공개방식" counts={portfolio.counts.disclosureMode} total={portfolio.totalAnalyzed} />
      </section>

      <section className="p-5 rounded-lg border border-slate-200 bg-white space-y-4">
        <h2 className="text-lg font-semibold">Business Critical</h2>
        <DistBar
          title={`Appeal Transfer (레퍼런스 ${portfolio.refCount}건 기준, 레퍼런스 없음 ${portfolio.totalAnalyzed - portfolio.refCount}건 제외)`}
          counts={portfolio.counts.appealTransfer}
          total={portfolio.refCount}
          excludeKeys={["N/A"]}
          highlight={["MISMATCH"]}
        />
        <DistBar title="Product Curiosity" counts={portfolio.counts.productCuriosity} total={portfolio.totalAnalyzed} />
        <DistBar
          title="Search Motivation"
          counts={portfolio.counts.searchMotivation}
          total={portfolio.totalAnalyzed}
          highlight={["WEAK"]}
        />
      </section>

      <section className="p-5 rounded-lg border border-slate-200 bg-white space-y-4">
        <h2 className="text-lg font-semibold">Reconstruction Skill (레퍼런스 {portfolio.refCount}건 기준)</h2>
        <DistBar
          title="Reconstruction Verdict"
          counts={portfolio.counts.reconstructionVerdict}
          total={portfolio.refCount}
          excludeKeys={["N/A"]}
          highlight={["TOO_CLOSE"]}
        />
        <DistBar
          title="Surface Clone Risk"
          counts={portfolio.counts.surfaceCloneRisk}
          total={portfolio.refCount}
          excludeKeys={["N/A"]}
          highlight={["HIGH"]}
        />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <AxisStat label="Persona SAME" stat={portfolio.reconstructionAxes.persona} />
          <AxisStat label="Event SAME" stat={portfolio.reconstructionAxes.event} />
          <AxisStat label="Deficiency Trigger SAME" stat={portfolio.reconstructionAxes.deficiencyTrigger} />
          <AxisStat label="Ending SAME" stat={portfolio.reconstructionAxes.ending} />
        </div>
        <div className="text-xs text-slate-500">
          장애물 있던 레퍼런스 {portfolio.reconstructionAxes.obstacleReferenceCount}건 중 삭제{" "}
          {portfolio.reconstructionAxes.obstacleDeleted}건 · 기능유지{" "}
          {portfolio.reconstructionAxes.obstacleFunctionPreserved}건 · 세부 재구성 실패(단순 복제){" "}
          {portfolio.reconstructionAxes.obstacleDetailCloned}건
        </div>
      </section>

      {portfolio.counts.finalVerdict.FAIL > 0 && (
        <section className="p-5 rounded-lg border border-slate-200 bg-white">
          <h2 className="text-lg font-semibold mb-3">FAIL 원인 ({portfolio.counts.finalVerdict.FAIL}건)</h2>
          <ul className="text-sm space-y-1">
            <li>Hygiene FAIL — {portfolio.failReasonBreakdown.hygieneFail}건</li>
            <li>Search Motivation WEAK — {portfolio.failReasonBreakdown.searchMotivationWeak}건</li>
            <li>Appeal Transfer MISMATCH — {portfolio.failReasonBreakdown.appealTransferMismatch}건</li>
            <li>Reconstruction TOO_CLOSE — {portfolio.failReasonBreakdown.reconstructionTooClose}건</li>
            <li>Surface Clone Risk HIGH — {portfolio.failReasonBreakdown.surfaceCloneHigh}건</li>
          </ul>
          <p className="text-xs text-slate-400 mt-2">
            한 소재가 여러 원인에 동시에 해당할 수 있어 합이 FAIL 총 개수보다 클 수 있습니다.
          </p>
        </section>
      )}

      <section className="p-5 rounded-lg border border-amber-200 bg-amber-50">
        <h2 className="text-lg font-semibold mb-3">주요 경고</h2>
        {portfolio.warnings.length === 0 ? (
          <p className="text-sm text-slate-600">현재 임계값을 넘는 경고가 없습니다.</p>
        ) : (
          <ul className="text-sm space-y-1">
            {portfolio.warnings.map((w, i) => (
              <li key={i} className="text-amber-800">
                ⚠ {warningLabel(w)}
              </li>
            ))}
          </ul>
        )}
      </section>

      {portfolio.newPatternCandidates.length > 0 && (
        <section className="p-5 rounded-lg border border-purple-200 bg-purple-50">
          <h2 className="text-lg font-semibold mb-3">새 패턴 후보 (NEW_PATTERN_CANDIDATE)</h2>
          <div className="space-y-3">
            {portfolio.newPatternCandidates.map((c) => (
              <div key={c.index} className="p-3 bg-white rounded border border-purple-100 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">&ldquo;{c.proposedName}&rdquo;</span>
                  <button
                    type="button"
                    onClick={() => onSelectMaterial(c.index)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    #{c.index + 1} 소재 보기 →
                  </button>
                </div>
                <p className="text-slate-600 mt-1">{c.whyDifferent}</p>
                <p className="text-slate-500 mt-1">구조: {c.structureSummary}</p>
                <p className="text-slate-400 mt-1">특징: {c.linguisticFeatures.join(", ")}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-purple-700 mt-2">
            이 후보들은 자동으로 새 Hook 코드로 확정되지 않습니다 — 사용자 검토 후 직접 결정하세요.
          </p>
        </section>
      )}

      <section className="p-5 rounded-lg border border-slate-200 bg-white space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">다음 실험 방향 (AI Recommendation)</h2>
          <button
            type="button"
            onClick={fetchRecommendation}
            disabled={status === "loading"}
            className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white disabled:bg-slate-300"
          >
            {status === "loading" ? "생성 중…" : recommendation ? "다시 생성" : "추천 받기"}
          </button>
        </div>
        {error && <div className="p-3 rounded border border-red-200 bg-red-50 text-red-700 text-sm">{error}</div>}
        {recommendation ? (
          <div className="text-sm space-y-2">
            {fromCache && (
              <div className="text-xs text-slate-400">
                (캐시된 추천 — 통계가 바뀌지 않아 API를 다시 호출하지 않았습니다)
              </div>
            )}
            <p className="whitespace-pre-wrap text-slate-800">{recommendation.text}</p>
            <ul className="list-disc pl-5 space-y-0.5">
              {recommendation.suggestedAngles.map((a, i) => (
                <li key={i} className="font-mono text-xs text-slate-700">
                  {a}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-slate-400">
            &ldquo;추천 받기&rdquo;를 누르면 현재 통계를 근거로 Claude가 다음 실험 방향을 제안합니다 (Claude API 1회
            호출, 동일 통계면 캐시를 재사용합니다).
          </p>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="p-3 rounded border border-slate-200 bg-slate-50">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-xl font-semibold ${accent ?? "text-slate-900"}`}>{value}</div>
    </div>
  );
}

function DistBar({
  title,
  counts,
  total,
  highlight,
  excludeKeys,
}: {
  title: string;
  counts: Record<string, number>;
  total: number;
  highlight?: string[];
  excludeKeys?: string[];
}) {
  const entries = Object.entries(counts).filter(([k]) => !excludeKeys?.includes(k));
  return (
    <div>
      <h3 className="text-sm font-medium text-slate-700 mb-1">{title}</h3>
      <div className="space-y-1">
        {entries.map(([k, n]) => {
          const pct = total > 0 ? Math.round((n / total) * 100) : 0;
          const isHi = highlight?.includes(k);
          return (
            <div key={k} className="flex items-center gap-2 text-xs">
              <span className={`w-36 shrink-0 truncate ${isHi ? "text-red-600 font-semibold" : "text-slate-600"}`}>
                {k}
              </span>
              <div className="flex-1 h-2 bg-slate-100 rounded overflow-hidden">
                <div className={`h-full ${isHi ? "bg-red-500" : "bg-blue-500"}`} style={{ width: `${pct}%` }} />
              </div>
              <span className="w-20 text-right text-slate-500">
                {n} ({pct}%)
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AxisStat({ label, stat }: { label: string; stat: { same: number; applicable: number } }) {
  const pct = stat.applicable > 0 ? Math.round((stat.same / stat.applicable) * 100) : 0;
  return (
    <div className="p-2 rounded border border-slate-200">
      <div className="text-slate-500">{label}</div>
      <div className="font-semibold text-slate-900">
        {stat.same} / {stat.applicable} ({pct}%)
      </div>
    </div>
  );
}

const FIELD_LABEL: Record<string, string> = {
  hookCode: "Hook",
  emotion: "감정태도",
  speaker: "화자",
  disclosureMode: "정보공개방식",
};

function warningLabel(w: PortfolioWarning): string {
  switch (w.kind) {
    case "OVERUSE":
      return `${FIELD_LABEL[w.field] ?? w.field} "${w.value}" 과사용 — ${Math.round(w.ratio * 100)}%`;
    case "MISMATCH_HEAVY":
      return `Appeal Transfer MISMATCH 비율 높음 — ${Math.round(w.ratio * 100)}%`;
    case "SEARCH_WEAK_HEAVY":
      return `Search Motivation WEAK 비율 높음 — ${Math.round(w.ratio * 100)}%`;
    case "FORMAT_VS_SEARCH":
      return w.detail;
    case "RECONSTRUCTION_TOO_CLOSE_HEAVY":
      return `Reconstruction TOO_CLOSE 비율 높음 — ${Math.round(w.ratio * 100)}%`;
    case "SURFACE_CLONE_HEAVY":
      return `Surface Clone Risk HIGH 비율 높음 — ${Math.round(w.ratio * 100)}%`;
    case "AXIS_WEAK":
      return w.detail;
  }
}
