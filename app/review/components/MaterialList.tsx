"use client";

import type { ParsedRow } from "@/lib/excel/parse";
import type { RowState, RowStatus } from "../hooks/useReviewWorkspace";

const STATUS_LABEL: Record<RowStatus, string> = {
  CACHED: "캐시됨",
  WAITING: "대기",
  ANALYZING: "분석중",
  COMPLETED: "완료",
  FAILED: "실패",
};

const STATUS_CLASS: Record<RowStatus, string> = {
  CACHED: "text-emerald-700 bg-emerald-50",
  WAITING: "text-slate-500 bg-slate-100",
  ANALYZING: "text-blue-700 bg-blue-50",
  COMPLETED: "text-emerald-700 bg-emerald-50",
  FAILED: "text-red-700 bg-red-50",
};

const VERDICT_CLASS: Record<string, string> = {
  READY: "text-emerald-700 font-semibold",
  NEEDS_REVISION: "text-amber-700 font-semibold",
  FAIL: "text-red-700 font-semibold",
};

export default function MaterialList({
  rows,
  states,
  onSelect,
}: {
  rows: ParsedRow[];
  states: Record<number, RowState>;
  onSelect: (index: number) => void;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs" data-testid="material-list-table">
          <thead className="bg-slate-50">
            <tr>
              <Th>순서</Th>
              <Th>상태</Th>
              <Th>작성안</Th>
              <Th>Hygiene</Th>
              <Th>Final Verdict</Th>
              <Th>Appeal Transfer</Th>
              <Th>Search Motivation</Th>
              <Th>Reconstruction</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const state = states[row.index];
              const status = state?.status ?? "WAITING";
              const result = state?.result;
              const hasRef = result ? result.critical.reference !== null : row.refOriginal !== null;

              return (
                <tr
                  key={row.index}
                  onClick={() => onSelect(row.index)}
                  className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer align-top"
                >
                  <Td>{row.orderLabel ?? row.index + 1}</Td>
                  <Td>
                    <span className={`px-1.5 py-0.5 rounded ${STATUS_CLASS[status]}`}>
                      {STATUS_LABEL[status]}
                    </span>
                  </Td>
                  <Td className="max-w-[320px]">
                    <div className="line-clamp-2 text-slate-700">{row.draft}</div>
                    {!row.refOriginal && <span className="text-slate-400">[레퍼런스 없음]</span>}
                  </Td>
                  <Td>{result ? `${result.hygiene.grade} (${result.hygiene.passedCount}/4)` : "—"}</Td>
                  <Td>
                    {result ? (
                      <span className={VERDICT_CLASS[result.finalVerdict.value]}>
                        {result.finalVerdict.value}
                      </span>
                    ) : (
                      "—"
                    )}
                  </Td>
                  <Td>{result && hasRef ? result.critical.appealTransfer?.value ?? "—" : "—"}</Td>
                  <Td>{result ? result.critical.searchMotivation.value : "—"}</Td>
                  <Td>{result && hasRef ? result.critical.reconstruction?.verdict ?? "—" : "—"}</Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left font-semibold px-2 py-2 border-b border-slate-200 whitespace-nowrap">
      {children}
    </th>
  );
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-2 py-2 ${className ?? ""}`}>{children}</td>;
}
