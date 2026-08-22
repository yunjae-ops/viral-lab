import type { PortfolioAnalysis } from "@/lib/review/portfolio/types";

export const PORTFOLIO_PROMPT_VERSION = "v1" as const;
export const TOOL_NAME = "submit_portfolio_recommendation";

export const SYSTEM_PROMPT = `
너는 Threads 바이럴 콘텐츠 포트폴리오를 검토하는 내부 코치다.
반드시 도구 호출(tool call) \`${TOOL_NAME}\`로만 결과를 반환한다. 다른 텍스트를 출력하지 않는다.

## 입력
사용자가 이미 코드로 계산한 통계(카운트·비율·경고)만 받는다. 원문 텍스트는 전혀 받지 않는다.

## 역할
1. 주어진 통계에서 드러나는 편향(과사용된 Hook/화자/감정, 약한 Search Motivation, 재구성이 원문과 너무 가까운 축 등)을 짚는다.
2. "다음에 어떤 방향의 소재를 실험하면 좋을지" 구체적인 조합(Hook × 화자 × 정보공개방식 등)을 1~5개 제안한다.
3. 각 제안에는 반드시 왜 그 방향인지, 어떤 부족한 지표를 보완하는지 근거를 붙인다.

## 절대 금지
- 주어지지 않은 숫자를 새로 만들거나 재계산하지 않는다. 오직 제공된 통계만 근거로 삼는다.
- "조회수가 터진다", "매출이 오른다", "무조건 성공한다" 같은 결과를 보장하는 표현을 쓰지 않는다.
- 이 코치는 다음 실험 "방향"만 제안한다. 성공을 약속하지 않는다.

## suggestedAngles 형식
각 항목은 "Hook코드 × 화자 × 정보공개방식" 같은 짧은 조합 문자열로 쓴다 (예: "L × 친구-친구 관찰 × 대화체").
`.trim();

function pct(ratio: number): string {
  return `${(ratio * 100).toFixed(0)}%`;
}

export function buildUserMessage(portfolio: PortfolioAnalysis): string {
  const { totalAnalyzed, refCount, counts, reconstructionAxes, warnings, failReasonBreakdown, newPatternCandidates } =
    portfolio;

  const distLine = (label: string, rec: Record<string, number>) =>
    `${label}: ` +
    Object.entries(rec)
      .filter(([, n]) => n > 0)
      .map(([k, n]) => `${k} ${n}건(${pct(n / Math.max(1, totalAnalyzed))})`)
      .join(", ");

  const axisLine = (label: string, same: number, applicable: number) =>
    `${label} SAME ${same}/${applicable} (${pct(same / Math.max(1, applicable))})`;

  const warningLines = warnings.length
    ? warnings.map((w) => `- [${w.kind}] ${"detail" in w ? w.detail : `${w.field}=${w.value} (${pct(w.ratio)})`}`)
    : ["- 없음"];

  const patternLines = newPatternCandidates.length
    ? newPatternCandidates.map(
        (c) => `- #${c.index} "${c.proposedName}" — ${c.whyDifferent} (구조: ${c.structureSummary})`,
      )
    : ["- 없음"];

  return `
## 포트폴리오 요약 (분석 완료 ${totalAnalyzed}건, 레퍼런스 있음 ${refCount}건)

### 분포
${distLine("Hook", counts.hookCode)}
${distLine("감정태도", counts.emotion)}
${distLine("화자", counts.speaker)}
${distLine("정보공개방식", counts.disclosureMode)}

### Business Critical
Appeal Transfer: ${distLine("", counts.appealTransfer)}
Product Curiosity: ${distLine("", counts.productCuriosity)}
Search Motivation: ${distLine("", counts.searchMotivation)}
Final Verdict: ${distLine("", counts.finalVerdict)}

### Reconstruction (레퍼런스 있는 ${refCount}건 기준)
Reconstruction Verdict: ${distLine("", counts.reconstructionVerdict)}
Surface Clone Risk: ${distLine("", counts.surfaceCloneRisk)}
${axisLine("Persona", reconstructionAxes.persona.same, reconstructionAxes.persona.applicable)}
${axisLine("Event", reconstructionAxes.event.same, reconstructionAxes.event.applicable)}
${axisLine("Deficiency Trigger", reconstructionAxes.deficiencyTrigger.same, reconstructionAxes.deficiencyTrigger.applicable)}
${axisLine("Ending", reconstructionAxes.ending.same, reconstructionAxes.ending.applicable)}

### FAIL 원인 분해 (finalVerdict=FAIL ${counts.finalVerdict.FAIL}건 중)
hygiene FAIL: ${failReasonBreakdown.hygieneFail}건
searchMotivation WEAK: ${failReasonBreakdown.searchMotivationWeak}건
appealTransfer MISMATCH: ${failReasonBreakdown.appealTransferMismatch}건
reconstruction TOO_CLOSE: ${failReasonBreakdown.reconstructionTooClose}건
surfaceCloneRisk HIGH: ${failReasonBreakdown.surfaceCloneHigh}건

### 경고
${warningLines.join("\n")}

### 새 패턴 후보 (NEW_PATTERN_CANDIDATE)
${patternLines.join("\n")}

위 통계만 근거로 다음 실험 방향을 추천하라.
`.trim();
}

export function buildToolInputSchema() {
  return {
    type: "object",
    properties: {
      text: { type: "string", minLength: 1 },
      suggestedAngles: {
        type: "array",
        items: { type: "string", minLength: 1 },
        minItems: 1,
        maxItems: 5,
      },
    },
    required: ["text", "suggestedAngles"],
  };
}
