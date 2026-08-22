// Limited-concurrency task runner. Framework-agnostic so it can be unit
// tested without React/DOM. A worker that throws never aborts the batch —
// each item is isolated (CLAUDE.md §2-20 / ACCEPTANCE_TESTS Phase 3: "한 행이
// 실패해도 전체 분석을 중단하지 않는다").
export async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  if (items.length === 0) return;
  let cursor = 0;
  const workerCount = Math.max(1, Math.min(concurrency, items.length));

  const runners = Array.from({ length: workerCount }, async () => {
    while (cursor < items.length) {
      const item = items[cursor++];
      try {
        await worker(item);
      } catch {
        // A misbehaving worker must not stop the queue; well-behaved callers
        // (e.g. analyzeOne) already catch their own errors and never throw.
      }
    }
  });

  await Promise.all(runners);
}
