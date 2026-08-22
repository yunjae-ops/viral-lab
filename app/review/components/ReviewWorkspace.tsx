"use client";

import { useMemo, useState } from "react";
import type { ParsedRow } from "@/lib/excel/parse";
import type { HeaderMap } from "@/lib/excel/headers";
import { useReviewWorkspace } from "../hooks/useReviewWorkspace";
import BatchPanel from "./BatchPanel";
import MaterialList from "./MaterialList";
import MaterialDetail from "./MaterialDetail";
import PortfolioView from "./PortfolioView";
import { exportAnalyzedExcel } from "@/lib/review/export/exportAnalyzedExcel";
import type { RowExportEntry } from "@/lib/review/export/analysisColumns";

type Tab = "materials" | "portfolio";

export default function ReviewWorkspace({
  rows,
  file,
  sheetName,
  header,
}: {
  rows: ParsedRow[];
  file: File;
  sheetName: string;
  header: HeaderMap;
}) {
  const workspace = useReviewWorkspace(rows);
  const [tab, setTab] = useState<Tab>("materials");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const selectedPosition = selectedIndex !== null ? rows.findIndex((r) => r.index === selectedIndex) + 1 : 0;
  const selectedRow = selectedPosition > 0 ? rows[selectedPosition - 1] : null;

  const goTo = (pos: number) => {
    if (pos < 1 || pos > rows.length) return;
    setSelectedIndex(rows[pos - 1].index);
  };

  const goToMaterial = (index: number) => {
    setSelectedIndex(index);
    setTab("materials");
  };

  const exportEntries = useMemo(() => {
    const map = new Map<number, RowExportEntry>();
    for (const row of rows) {
      const state = workspace.states[row.index];
      if (!state) continue;
      map.set(row.index, { status: state.status, result: state.result, error: state.error });
    }
    return map;
  }, [rows, workspace.states]);

  const hasAnyResult = useMemo(
    () => Array.from(exportEntries.values()).some((e) => e.result !== null),
    [exportEntries],
  );

  const handleExport = async () => {
    setExporting(true);
    setExportError(null);
    try {
      await exportAnalyzedExcel({ file, sheetName, header, rows, entries: exportEntries });
    } catch (e) {
      setExportError(e instanceof Error ? e.message : "다운로드 중 알 수 없는 오류가 발생했습니다.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-1 border-b border-slate-200">
        <TabButton active={tab === "materials"} onClick={() => setTab("materials")}>
          개별 소재 검토
        </TabButton>
        <TabButton active={tab === "portfolio"} onClick={() => setTab("portfolio")}>
          Portfolio
        </TabButton>
      </div>

      {tab === "materials" ? (
        <>
          <BatchPanel
            summary={workspace.summary}
            scanning={workspace.scanning}
            isBatchRunning={workspace.isBatchRunning}
            onStart={workspace.startBatch}
            onRetryFailed={workspace.retryFailed}
            onClearCache={workspace.clearCache}
            hasAnyResult={hasAnyResult}
            exporting={exporting}
            exportError={exportError}
            onExport={handleExport}
          />

          {selectedRow ? (
            <MaterialDetail
              row={selectedRow}
              state={workspace.states[selectedRow.index]}
              position={selectedPosition}
              total={rows.length}
              onPrev={() => goTo(selectedPosition - 1)}
              onNext={() => goTo(selectedPosition + 1)}
              onBack={() => setSelectedIndex(null)}
              onRetry={() => workspace.retryOne(selectedRow.index)}
              onForceReanalyze={() => workspace.forceReanalyzeOne(selectedRow.index)}
            />
          ) : (
            <MaterialList rows={rows} states={workspace.states} onSelect={setSelectedIndex} />
          )}
        </>
      ) : (
        <PortfolioView rows={rows} states={workspace.states} onSelectMaterial={goToMaterial} />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
        active ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-700"
      }`}
    >
      {children}
    </button>
  );
}
