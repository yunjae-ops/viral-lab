"use client";

import { useState } from "react";
import { DEFAULT_CONCURRENCY } from "../hooks/useReviewWorkspace";

type Summary = {
  total: number;
  cached: number;
  waiting: number;
  analyzing: number;
  completed: number;
  failed: number;
  done: number;
};

export default function BatchPanel({
  summary,
  scanning,
  isBatchRunning,
  onStart,
  onRetryFailed,
  onClearCache,
  hasAnyResult,
  exporting,
  exportError,
  onExport,
}: {
  summary: Summary;
  scanning: boolean;
  isBatchRunning: boolean;
  onStart: () => void;
  onRetryFailed: () => void;
  onClearCache: () => void;
  hasAnyResult: boolean;
  exporting: boolean;
  exportError: string | null;
  onExport: () => void;
}) {
  const [confirmingStart, setConfirmingStart] = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);

  const progressPct = summary.total > 0 ? Math.round((summary.done / summary.total) * 100) : 0;

  return (
    <section className="p-5 rounded-lg border border-slate-200 bg-white space-y-4">
      <h2 className="text-lg font-semibold">전체 분석</h2>

      {scanning ? (
        <div className="text-sm text-slate-500">캐시 확인 중…</div>
      ) : (
        <>
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <Stat label="총 작성안" value={summary.total} />
            <Stat label="캐시됨 (호출 불필요)" value={summary.cached} />
            <Stat label="새 API 호출 예정" value={summary.waiting} />
            <Stat label="완료" value={summary.done} />
          </dl>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-slate-100 rounded overflow-hidden">
              <div className="h-full bg-blue-600" style={{ width: `${progressPct}%` }} />
            </div>
            <span className="text-xs text-slate-500 whitespace-nowrap">
              {summary.done} / {summary.total} 완료
              {summary.failed > 0 && ` · 실패 ${summary.failed}개`}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!confirmingStart ? (
              <button
                type="button"
                onClick={() => setConfirmingStart(true)}
                disabled={isBatchRunning || summary.waiting === 0}
                className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white disabled:bg-slate-300"
              >
                {isBatchRunning ? "분석 중…" : "전체 분석 시작"}
              </button>
            ) : (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-slate-700">
                  {summary.waiting}건에 대해 Claude API를 호출합니다 (동시성 {DEFAULT_CONCURRENCY}). 계속할까요?
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmingStart(false);
                    onStart();
                  }}
                  className="px-2 py-1 rounded bg-blue-600 text-white"
                >
                  확인하고 시작
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingStart(false)}
                  className="px-2 py-1 rounded border border-slate-300"
                >
                  취소
                </button>
              </div>
            )}

            {summary.failed > 0 && (
              <button
                type="button"
                onClick={onRetryFailed}
                disabled={isBatchRunning}
                className="px-3 py-1.5 text-sm rounded border border-amber-400 text-amber-700 disabled:opacity-50"
              >
                실패한 {summary.failed}개 재시도
              </button>
            )}

            {!confirmingClear ? (
              <button
                type="button"
                onClick={() => setConfirmingClear(true)}
                disabled={isBatchRunning}
                className="px-3 py-1.5 text-sm rounded border border-slate-300 text-slate-600 disabled:opacity-50"
              >
                캐시 비우기
              </button>
            ) : (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-slate-700">모든 캐시 결과를 지웁니다. 계속할까요?</span>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmingClear(false);
                    onClearCache();
                  }}
                  className="px-2 py-1 rounded bg-red-600 text-white"
                >
                  비우기
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingClear(false)}
                  className="px-2 py-1 rounded border border-slate-300"
                >
                  취소
                </button>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={onExport}
              disabled={!hasAnyResult || exporting}
              title={hasAnyResult ? undefined : "먼저 최소 1개 이상 분석을 완료해야 다운로드할 수 있습니다."}
              className="px-3 py-1.5 text-sm rounded bg-slate-800 text-white disabled:bg-slate-300"
            >
              {exporting ? "다운로드 준비 중…" : "분석 결과 Excel 다운로드"}
            </button>
            {!hasAnyResult && (
              <span className="text-xs text-slate-400">
                분석 완료된 소재가 없어 아직 다운로드할 수 없습니다.
              </span>
            )}
            {hasAnyResult && (
              <span className="text-xs text-slate-400">
                Claude API를 호출하지 않고, 이미 완료된 분석 결과만 원본 옆에 붙여 새 파일로 내려받습니다.
              </span>
            )}
          </div>
          {exportError && (
            <div className="p-3 rounded border border-red-200 bg-red-50 text-red-700 text-sm">{exportError}</div>
          )}
        </>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="p-3 rounded border border-slate-200 bg-slate-50">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}
