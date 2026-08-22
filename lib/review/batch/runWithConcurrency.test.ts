import { describe, it, expect } from "vitest";
import { runWithConcurrency } from "./runWithConcurrency";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("runWithConcurrency", () => {
  it("처리한 개수 = 입력 개수 (5개 입력 → 5개 정상 처리)", async () => {
    const items = [1, 2, 3, 4, 5];
    const processed: number[] = [];
    await runWithConcurrency(items, 3, async (item) => {
      await delay(1);
      processed.push(item);
    });
    expect(processed.sort()).toEqual(items);
  });

  it("동시 실행 개수가 설정한 concurrency를 넘지 않는다", async () => {
    const items = Array.from({ length: 10 }, (_, i) => i);
    let active = 0;
    let maxActive = 0;
    const concurrency = 3;

    await runWithConcurrency(items, concurrency, async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await delay(5);
      active--;
    });

    expect(maxActive).toBeLessThanOrEqual(concurrency);
    expect(maxActive).toBeGreaterThan(1); // 실제로 병렬로 돌았는지 확인
  });

  it("한 항목이 실패해도 나머지는 계속 처리된다", async () => {
    const items = [1, 2, 3, 4, 5];
    const processed: number[] = [];

    await runWithConcurrency(items, 2, async (item) => {
      if (item === 3) throw new Error("boom");
      processed.push(item);
    });

    expect(processed.sort()).toEqual([1, 2, 4, 5]);
  });

  it("빈 배열은 아무 것도 하지 않는다", async () => {
    let called = false;
    await runWithConcurrency([], 3, async () => {
      called = true;
    });
    expect(called).toBe(false);
  });

  it("concurrency가 items 길이보다 크면 items 길이만큼만 동시 실행한다", async () => {
    const items = [1, 2];
    let active = 0;
    let maxActive = 0;
    await runWithConcurrency(items, 10, async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await delay(5);
      active--;
    });
    expect(maxActive).toBeLessThanOrEqual(2);
  });
});
