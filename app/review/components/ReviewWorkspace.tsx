"use client";

import { useState } from "react";
import type { ParsedRow } from "@/lib/excel/parse";
import { useReviewWorkspace } from "../hooks/useReviewWorkspace";
import BatchPanel from "./BatchPanel";
import MaterialList from "./MaterialList";
import MaterialDetail from "./MaterialDetail";

export default function ReviewWorkspace({ rows }: { rows: ParsedRow[] }) {
  const workspace = useReviewWorkspace(rows);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const selectedPosition = selectedIndex !== null ? rows.findIndex((r) => r.index === selectedIndex) + 1 : 0;
  const selectedRow = selectedPosition > 0 ? rows[selectedPosition - 1] : null;

  const goTo = (pos: number) => {
    if (pos < 1 || pos > rows.length) return;
    setSelectedIndex(rows[pos - 1].index);
  };

  return (
    <div className="space-y-6">
      <BatchPanel
        summary={workspace.summary}
        scanning={workspace.scanning}
        isBatchRunning={workspace.isBatchRunning}
        onStart={workspace.startBatch}
        onRetryFailed={workspace.retryFailed}
        onClearCache={workspace.clearCache}
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
    </div>
  );
}
