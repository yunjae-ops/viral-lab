import type { RowAnalysis } from "@/lib/schema/rowAnalysis";

// 어떤 React 상태 관리 코드도 몰라야 하므로(순수 함수 원칙), 훅 파일의 RowStatus와
// 구조적으로 호환되는 값만 여기서 별도로 정의한다 (app/ 쪽 코드에 대한 의존 없음).
export type ExportRowStatus = "WAITING" | "ANALYZING" | "COMPLETED" | "CACHED" | "FAILED";

export type RowExportEntry = {
  status: ExportRowStatus;
  result: RowAnalysis | null;
  error: string | null;
};

const STATUS_LABEL: Record<ExportRowStatus, string> = {
  WAITING: "미분석",
  ANALYZING: "분석중",
  COMPLETED: "완료",
  CACHED: "완료(캐시)",
  FAILED: "실패",
};

// DATA_CONTRACT §4.1의 Analysis 컬럼 순서를 그대로 재사용 (원본 컬럼 유지 + 아래 컬럼을
// 오른쪽에 추가). 분석상태/실패사유/Hygiene실패이유는 Phase 5에서 새로 요구된 미분석·
// 실패 행 처리를 위해 앞에 추가한 것 — 그 외에는 기존 RowAnalysis 필드 그대로다.
export const ANALYSIS_COLUMN_HEADERS: readonly string[] = [
  "분석상태",
  "실패사유",
  "Hygiene등급",
  "G1_본문완결",
  "G2_발견전환",
  "G3_서사완결",
  "G4_원인구조성",
  "Hygiene실패이유",
  "참조소구",
  "참조바이럴엔진",
  "작성안소구",
  "AppealTransfer",
  "AppealTransfer근거",
  "이탈지점",
  "제품호기심",
  "제품호기심근거",
  "검색동기",
  "검색동기근거",
  "검색동기수정방향",
  "재구성판정",
  "Unchanged",
  "Persona",
  "Event",
  "결핍계기",
  "EndingMethod",
  "Reference결말유형",
  "Draft결말유형",
  "장애물_기능유지",
  "장애물_세부재구성",
  "SurfaceCloneRisk",
  "SurfaceClone인용",
  "재구성겹침지점",
  "재구성수정방향",
  "최종판정",
  "판정근거",
  "Hook",
  "NewPatternName",
  "감정",
  "감정_기타라벨",
  "화자",
  "화자_기타라벨",
  "공개방식",
  "공개방식_기타라벨",
  "판매튐",
  "건강주장",
  "구조문제점",
  "구조수정방향",
];

const BLANK_ANALYSIS_CELLS: readonly string[] = ANALYSIS_COLUMN_HEADERS.map(() => "");

const pass = (p: boolean) => (p ? "PASS" : "FAIL");
const yesNo = (v: boolean | null): string => (v === null ? "" : v ? "예" : "아니오");
const join = (items: readonly string[]): string => items.join(" | ");

function analysisCellsForResult(ai: RowAnalysis): string[] {
  const hasRef = ai.critical.reference !== null;
  const reconstruction = hasRef ? ai.critical.reconstruction : null;
  const appealTransfer = hasRef ? ai.critical.appealTransfer : null;

  const failedGateEvidence = (
    [
      ["G1", ai.hygiene.gates.G1_self_contained],
      ["G2", ai.hygiene.gates.G2_discovery],
      ["G3", ai.hygiene.gates.G3_narrative],
      ["G4", ai.hygiene.gates.G4_causal_structure],
    ] as const
  )
    .filter(([, gate]) => !gate.pass)
    .map(([label, gate]) => `${label}: ${gate.evidence}`);

  return [
    "", // 분석상태 — 호출부에서 채움
    "", // 실패사유 — 호출부에서 채움
    ai.hygiene.grade,
    pass(ai.hygiene.gates.G1_self_contained.pass),
    pass(ai.hygiene.gates.G2_discovery.pass),
    pass(ai.hygiene.gates.G3_narrative.pass),
    pass(ai.hygiene.gates.G4_causal_structure.pass),
    join(failedGateEvidence),
    hasRef && ai.critical.reference ? ai.critical.reference.coreAppeal : "",
    hasRef && ai.critical.reference ? ai.critical.reference.viralEngine : "",
    ai.critical.draftCoreAppeal,
    appealTransfer ? appealTransfer.value : "",
    appealTransfer ? appealTransfer.evidence : "",
    appealTransfer ? (appealTransfer.deviationPoint ?? "") : "",
    ai.critical.productCuriosity.value,
    ai.critical.productCuriosity.evidence,
    ai.critical.searchMotivation.value,
    ai.critical.searchMotivation.evidence,
    ai.critical.searchMotivation.liftDirection,
    reconstruction ? reconstruction.verdict : "",
    reconstruction ? `${reconstruction.unchangedCount}/${reconstruction.applicableCount}` : "",
    reconstruction ? reconstruction.persona.value : "",
    reconstruction ? reconstruction.event.value : "",
    reconstruction ? reconstruction.deficiencyTrigger.value : "",
    reconstruction ? reconstruction.endingMethod.value : "",
    reconstruction ? reconstruction.endingMethod.referenceType : "",
    reconstruction ? reconstruction.endingMethod.draftType : "",
    reconstruction ? yesNo(reconstruction.obstacle.functionPreserved) : "",
    reconstruction ? yesNo(reconstruction.obstacle.detailsTransformed) : "",
    reconstruction ? reconstruction.surfaceCloneRisk.value : "",
    reconstruction ? join(reconstruction.surfaceCloneRisk.quotedFragments) : "",
    reconstruction ? reconstruction.evidence : "",
    reconstruction ? reconstruction.revisionDirection : "",
    ai.finalVerdict.value,
    join(ai.finalVerdict.reasons),
    ai.diagnostic.hookCode,
    ai.diagnostic.newPatternCandidate ? ai.diagnostic.newPatternCandidate.proposedName : "",
    ai.diagnostic.emotion.value,
    ai.diagnostic.emotion.otherLabel ?? "",
    ai.diagnostic.speaker.value,
    ai.diagnostic.speaker.otherLabel ?? "",
    ai.diagnostic.disclosureMode.value,
    ai.diagnostic.disclosureMode.otherLabel ?? "",
    `${ai.diagnostic.salesMessageStandsOut.pass ? "정상" : "튐"} (${ai.diagnostic.salesMessageStandsOut.evidence})`,
    join(ai.diagnostic.healthClaimsToVerify),
    join(ai.diagnostic.topProblems),
    ai.diagnostic.revisionDirection,
  ];
}

// 한 행의 분석 컬럼 값을 순서대로 반환한다. entry가 없으면(원래 빈 행 등) 전부 공란.
export function buildAnalysisRowCells(entry: RowExportEntry | undefined): string[] {
  if (!entry) return [...BLANK_ANALYSIS_CELLS];

  const statusCell = STATUS_LABEL[entry.status];
  const errorCell = entry.status === "FAILED" ? (entry.error ?? "") : "";

  if (!entry.result) {
    const cells = [...BLANK_ANALYSIS_CELLS];
    cells[0] = statusCell;
    cells[1] = errorCell;
    return cells;
  }

  const cells = analysisCellsForResult(entry.result);
  cells[0] = statusCell;
  cells[1] = errorCell;
  return cells;
}
