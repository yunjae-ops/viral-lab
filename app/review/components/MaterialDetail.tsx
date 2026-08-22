"use client";

import { useState } from "react";
import type { ParsedRow } from "@/lib/excel/parse";
import type { RowAnalysis } from "@/lib/schema/rowAnalysis";
import type { RowState } from "../hooks/useReviewWorkspace";

export default function MaterialDetail({
  row,
  state,
  position,
  total,
  onPrev,
  onNext,
  onBack,
  onRetry,
  onForceReanalyze,
}: {
  row: ParsedRow;
  state: RowState | undefined;
  position: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  onBack: () => void;
  onRetry: () => void;
  onForceReanalyze: () => void;
}) {
  const status = state?.status ?? "WAITING";

  return (
    <section className="space-y-4">
      <NavBar position={position} total={total} onPrev={onPrev} onNext={onNext} onBack={onBack} />

      <div className="p-5 rounded-lg border border-slate-200 bg-white space-y-3">
        <h2 className="text-lg font-semibold">기본 정보</h2>
        <dl className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <InfoField label="순서" value={row.orderLabel ?? String(row.index + 1)} />
          <InfoField label="이미지 파일명" value={row.imageFilename ?? "—"} />
          <div>
            <div className="text-xs text-slate-500 mb-1">원본 Threads 링크</div>
            {row.refUrl ? (
              <a
                href={row.refUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-2 py-1 text-xs rounded bg-slate-800 text-white hover:bg-slate-700"
              >
                원본 열기 ↗
              </a>
            ) : (
              <span className="text-sm text-slate-400">—</span>
            )}
          </div>
        </dl>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-5 rounded-lg border border-slate-200 bg-white">
          <h3 className="font-semibold mb-2 text-sm text-slate-700">레퍼런스 원문</h3>
          {row.refOriginal ? (
            <p className="text-sm whitespace-pre-wrap text-slate-800">{row.refOriginal}</p>
          ) : (
            <p className="text-sm text-slate-400">레퍼런스 원문 없음 — Draft 단독 분석</p>
          )}
        </div>
        <div className="p-5 rounded-lg border border-slate-200 bg-white">
          <h3 className="font-semibold mb-2 text-sm text-slate-700">작성안</h3>
          <p className="text-sm whitespace-pre-wrap text-slate-800">{row.draft}</p>
        </div>
      </div>

      {status === "WAITING" && (
        <div className="p-5 rounded-lg border border-slate-200 bg-white flex items-center justify-between">
          <span className="text-sm text-slate-500">아직 분석하지 않았습니다.</span>
          <button
            type="button"
            onClick={onRetry}
            className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white"
          >
            지금 분석
          </button>
        </div>
      )}

      {status === "ANALYZING" && (
        <div className="p-5 rounded-lg border border-blue-200 bg-blue-50 text-sm text-blue-700">
          분석 중…
        </div>
      )}

      {status === "FAILED" && (
        <div className="p-5 rounded-lg border border-red-200 bg-red-50 space-y-2">
          <p className="text-sm text-red-700 whitespace-pre-wrap">{state?.error ?? "분석 실패"}</p>
          <button
            type="button"
            onClick={onRetry}
            className="px-3 py-1.5 text-sm rounded bg-red-600 text-white"
          >
            재시도
          </button>
        </div>
      )}

      {(status === "COMPLETED" || status === "CACHED") && state?.result && (
        <AnalysisResult result={state.result} onForceReanalyze={onForceReanalyze} />
      )}

      <NavBar position={position} total={total} onPrev={onPrev} onNext={onNext} onBack={onBack} />
    </section>
  );
}

function NavBar({
  position,
  total,
  onPrev,
  onNext,
  onBack,
}: {
  position: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <button type="button" onClick={onBack} className="text-sm text-blue-600 hover:underline">
        ← 목록으로
      </button>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onPrev}
          disabled={position <= 1}
          className="px-3 py-1 text-sm rounded border border-slate-300 disabled:opacity-40"
        >
          ← 이전 소재
        </button>
        <span className="text-xs text-slate-500">
          {position} / {total}
        </span>
        <button
          type="button"
          onClick={onNext}
          disabled={position >= total}
          className="px-3 py-1 text-sm rounded border border-slate-300 disabled:opacity-40"
        >
          다음 소재 →
        </button>
      </div>
    </div>
  );
}

function AnalysisResult({
  result,
  onForceReanalyze,
}: {
  result: RowAnalysis;
  onForceReanalyze: () => void;
}) {
  const { hygiene, critical, diagnostic, finalVerdict, meta } = result;
  const hasRef = critical.reference !== null;
  const [confirmingForce, setConfirmingForce] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-500">
          model: <span className="font-mono">{meta.model}</span> · promptVersion:{" "}
          <span className="font-mono">{meta.promptVersion}</span> · {meta.elapsedMs}ms
        </div>
        {!confirmingForce ? (
          <button
            type="button"
            onClick={() => setConfirmingForce(true)}
            className="px-3 py-1 text-xs rounded border border-slate-300 text-slate-600"
          >
            다시 분석
          </button>
        ) : (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-700">기존 분석 결과를 덮어쓰고 API를 다시 호출합니다.</span>
            <button
              type="button"
              onClick={() => {
                setConfirmingForce(false);
                onForceReanalyze();
              }}
              className="px-2 py-1 rounded bg-blue-600 text-white"
            >
              확인
            </button>
            <button
              type="button"
              onClick={() => setConfirmingForce(false)}
              className="px-2 py-1 rounded border border-slate-300"
            >
              취소
            </button>
          </div>
        )}
      </div>

      <Block
        title={`FINAL VERDICT — ${finalVerdict.value}`}
        accent={
          finalVerdict.value === "READY"
            ? "border-emerald-300 bg-emerald-50"
            : finalVerdict.value === "FAIL"
              ? "border-red-300 bg-red-50"
              : "border-amber-300 bg-amber-50"
        }
      >
        <ul className="list-disc pl-5 space-y-0.5 text-sm">
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
            value={`Ref 존재=${critical.reconstruction.obstacle.referenceHasObstacle} · Draft 존재=${critical.reconstruction.obstacle.draftHasObstacle} · 기능유지=${String(critical.reconstruction.obstacle.functionPreserved)} · 세부재구성=${String(critical.reconstruction.obstacle.detailsTransformed)}`}
          />
          <Field label="장애물 근거" value={critical.reconstruction.obstacle.evidence} />
          <Field
            label="Surface Clone Risk"
            value={`${critical.reconstruction.surfaceCloneRisk.value} — ${critical.reconstruction.surfaceCloneRisk.evidence}`}
          />
          <Field label="가장 크게 겹치는 지점" value={critical.reconstruction.evidence} />
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
        <Field label="가장 큰 문제" value={diagnostic.topProblems.join(" / ")} />
        <Field label="수정방향" value={diagnostic.revisionDirection} />
      </Block>
    </div>
  );
}

function Block({
  title,
  children,
  accent,
}: {
  title: string;
  children: React.ReactNode;
  accent?: string;
}) {
  return (
    <div className={`border rounded p-4 ${accent ?? "border-slate-200"}`}>
      <h3 className="font-semibold mb-2 text-sm">{title}</h3>
      <div className="space-y-1 text-sm">{children}</div>
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
      <span className="min-w-[9rem] text-slate-500 shrink-0">{label}</span>
      <span className="text-slate-900">{value}</span>
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className="text-sm text-slate-900">{value}</div>
    </div>
  );
}
