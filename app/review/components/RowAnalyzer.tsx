"use client";

import { useState } from "react";
import type { ParsedRow } from "@/lib/excel/parse";
import type { RowAnalysisAi, RowAnalysisMeta } from "@/lib/schema/rowAnalysis";

type ApiErrorBody = { error: string; detail: string };
type ApiSuccessBody = RowAnalysisAi & { index: number; meta: RowAnalysisMeta };

export default function RowAnalyzer({ rows }: { rows: ParsedRow[] }) {
  const [selectedIndex, setSelectedIndex] = useState<number>(rows.length > 0 ? rows[0].index : -1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ApiSuccessBody | null>(null);

  const selectedRow = rows.find((r) => r.index === selectedIndex) ?? null;

  const analyze = async () => {
    if (!selectedRow) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/review/analyze-row", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          index: selectedRow.index,
          draft: selectedRow.draft,
          refOriginal: selectedRow.refOriginal,
          refUrl: selectedRow.refUrl,
        }),
      });
      const body = (await res.json()) as ApiSuccessBody | ApiErrorBody;
      if (!res.ok || "error" in body) {
        const errBody = body as ApiErrorBody;
        setError(`${errBody.error}: ${errBody.detail}`);
        return;
      }
      setResult(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : "알 수 없는 오류");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="p-5 rounded-lg border border-slate-200 bg-white space-y-4">
      <h2 className="text-lg font-semibold">Phase 2 — 한 행 AI 분석 (검증용)</h2>
      <p className="text-xs text-slate-500">
        선택한 행 1개만 Claude로 분석합니다. 전체 배치 분석·캐시는 Phase 3에서 추가됩니다.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <select
          className="border border-slate-300 rounded px-2 py-1 text-sm max-w-md"
          value={selectedIndex}
          onChange={(e) => setSelectedIndex(Number(e.target.value))}
        >
          {rows.map((r) => (
            <option key={r.index} value={r.index}>
              #{r.index + 1} {r.refOriginal ? "[REF]" : "[NO-REF]"} — {r.draft.slice(0, 40)}
              {r.draft.length > 40 ? "…" : ""}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={analyze}
          disabled={loading || !selectedRow}
          className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white disabled:bg-slate-300"
        >
          {loading ? "분석 중…" : "이 행 분석"}
        </button>
      </div>

      {error && (
        <div className="p-3 rounded border border-red-200 bg-red-50 text-red-700 text-sm whitespace-pre-wrap">
          {error}
        </div>
      )}

      {result && <RowAnalysisResultView result={result} />}
    </section>
  );
}

function RowAnalysisResultView({ result }: { result: ApiSuccessBody }) {
  const { hygiene, critical, diagnostic, finalVerdict, meta } = result;
  const hasRef = critical.reference !== null;

  return (
    <div className="space-y-4 text-sm">
      <div className="text-xs text-slate-500">
        model: <span className="font-mono">{meta.model}</span> · promptVersion:{" "}
        <span className="font-mono">{meta.promptVersion}</span> · {meta.elapsedMs}ms
      </div>

      <Block title={`FINAL VERDICT — ${finalVerdict.value}`}>
        <ul className="list-disc pl-5 space-y-0.5">
          {finalVerdict.reasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      </Block>

      <Block title={`HYGIENE GATE — ${hygiene.grade} (${hygiene.passedCount}/4)`}>
        <GateRow label="G1 본문 완결성" gate={hygiene.gates.G1_self_contained} />
        <GateRow label="G2 발견/전환" gate={hygiene.gates.G2_discovery} />
        <GateRow label="G3 서사 완결" gate={hygiene.gates.G3_narrative} />
        <GateRow label="G4 결과·원인 구조성" gate={hygiene.gates.G4_causal_structure} />
      </Block>

      <Block title="CRITICAL GATE">
        {hasRef && critical.reference && (
          <>
            <Field label="Reference Core Appeal" value={critical.reference.coreAppeal} />
            <Field label="Reference Viral Engine" value={critical.reference.viralEngine} />
          </>
        )}
        <Field label="Draft Core Appeal" value={critical.draftCoreAppeal} />
        {hasRef && critical.appealTransfer && (
          <>
            <Field
              label="Appeal Transfer"
              value={`${critical.appealTransfer.value} — ${critical.appealTransfer.evidence}`}
            />
            <Field label="이탈지점" value={critical.appealTransfer.deviationPoint ?? "없음"} />
          </>
        )}
        <Field
          label="Product Curiosity"
          value={`${critical.productCuriosity.value} — ${critical.productCuriosity.evidence}`}
        />
        <Field
          label="Search Motivation"
          value={`${critical.searchMotivation.value} — ${critical.searchMotivation.evidence}`}
        />
        <Field label="검색 동기 수정방향" value={critical.searchMotivation.liftDirection} />
      </Block>

      {hasRef && critical.reconstruction && (
        <Block
          title={`RECONSTRUCTION — ${critical.reconstruction.verdict} (Unchanged ${critical.reconstruction.unchangedCount}/${critical.reconstruction.applicableCount})`}
        >
          <Field
            label="Persona"
            value={`${critical.reconstruction.persona.value} · Ref: ${critical.reconstruction.persona.referenceSummary} → Draft: ${critical.reconstruction.persona.draftSummary}`}
          />
          <Field
            label="Event"
            value={`${critical.reconstruction.event.value} · Ref: ${critical.reconstruction.event.referenceSummary} → Draft: ${critical.reconstruction.event.draftSummary}`}
          />
          <Field
            label="Deficiency Trigger"
            value={`${critical.reconstruction.deficiencyTrigger.value} · Ref: ${critical.reconstruction.deficiencyTrigger.referenceSummary ?? "N/A"} → Draft: ${critical.reconstruction.deficiencyTrigger.draftSummary}`}
          />
          <Field
            label="Ending Method"
            value={`${critical.reconstruction.endingMethod.value} · Ref[${critical.reconstruction.endingMethod.referenceType}] → Draft[${critical.reconstruction.endingMethod.draftType}]`}
          />
          <Field
            label="Obstacle"
            value={`ref=${critical.reconstruction.obstacle.referenceHasObstacle} draft=${critical.reconstruction.obstacle.draftHasObstacle} functionPreserved=${String(critical.reconstruction.obstacle.functionPreserved)} detailsTransformed=${String(critical.reconstruction.obstacle.detailsTransformed)}`}
          />
          <Field
            label="Surface Clone Risk"
            value={`${critical.reconstruction.surfaceCloneRisk.value} — ${critical.reconstruction.surfaceCloneRisk.evidence}`}
          />
          <Field label="겹침 지점" value={critical.reconstruction.evidence} />
          <Field label="재구성 수정방향" value={critical.reconstruction.revisionDirection} />
        </Block>
      )}

      <Block title={`DIAGNOSTIC — Hook ${diagnostic.hookCode}`}>
        <Field label="Hook 근거" value={diagnostic.hookCodeReason} />
        <Field label="감정태도" value={diagnostic.emotion.otherLabel ?? diagnostic.emotion.value} />
        <Field label="화자" value={diagnostic.speaker.otherLabel ?? diagnostic.speaker.value} />
        <Field
          label="정보공개방식"
          value={diagnostic.disclosureMode.otherLabel ?? diagnostic.disclosureMode.value}
        />
        <Field label="핵심 문제점" value={diagnostic.topProblems.join(" / ")} />
        <Field label="수정방향" value={diagnostic.revisionDirection} />
      </Block>

      <details className="text-xs">
        <summary className="cursor-pointer text-slate-500">Raw JSON</summary>
        <pre className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded overflow-x-auto">
          {JSON.stringify(result, null, 2)}
        </pre>
      </details>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-slate-200 rounded p-3">
      <h3 className="font-semibold mb-2">{title}</h3>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function GateRow({ label, gate }: { label: string; gate: { pass: boolean; evidence: string } }) {
  return (
    <div className="flex gap-2">
      <span className={gate.pass ? "text-green-600" : "text-red-600"}>{gate.pass ? "PASS" : "FAIL"}</span>
      <span className="text-slate-700">{label}</span>
      <span className="text-slate-400">— {gate.evidence}</span>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="min-w-[9rem] text-slate-500">{label}</span>
      <span className="text-slate-900">{value}</span>
    </div>
  );
}
