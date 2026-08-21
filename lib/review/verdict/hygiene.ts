import type { Hygiene } from "@/lib/schema/rowAnalysis";

/**
 * hygiene.passedCount / hygiene.grade는 AI가 확정하지 않는다 (CLAUDE.md §2-6).
 * gates의 pass 개수로 서버가 결정적으로 재계산해 덮어쓴다 (SPEC §1.3).
 */
export function recomputeHygiene(hygiene: Hygiene): Hygiene {
  const { gates } = hygiene;
  const passedCount = [
    gates.G1_self_contained,
    gates.G2_discovery,
    gates.G3_narrative,
    gates.G4_causal_structure,
  ].filter((g) => g.pass).length;

  const grade: Hygiene["grade"] = passedCount === 4 ? "A" : passedCount === 3 ? "B" : "FAIL";

  return { ...hygiene, passedCount, grade };
}
