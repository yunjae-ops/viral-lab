import { PROMPT_VERSION } from "@/lib/schema/rowAnalysis";

export { PROMPT_VERSION };

export const TOOL_NAME = "submit_row_analysis";

const HOOK_CODE_TABLE = `
A | 직접 추천형 | 화자가 겪음 → 발견 → 추천
B | 위장된 자랑/반전 | 손해·실연·실패 등 부정적 사건 속에서 다른 만족을 발견
C | 장애물 나열형 | 여러 실패 시도 → 마지막 해결
D | 안티추천 뒤집기 | 다른 것들을 불신/비추천 → 하나만 예외 인정
E | 장르클리셰 반전 | 태몽·사주·타로 등 반전 구조 장르 활용
F | 순수 리스트형 | 행동·아이템 나열, 결과 또는 숫자 훅
G | 발견형 | 강한 결핍 서사 없이 우연한 발견/신상/감탄
H | 권위+허무개그 | 전문가·권위 → "이렇게 간단한 걸 왜 몰랐지" 식 허무 낙차
I | 부담-면제리스트 | 과도한 기준/해야 할 것들 나열 → 최소 솔루션으로 부담 면제
J | 선언문형 명령 리스트 | 강한 선언·훈계 → 균질한 행동 리스트
K | 상황별 제품 매칭 리스트 | 여러 상황·고민에 각기 다른 솔루션 매칭
L | 시크한 관찰자형 | 절박한 경험담이 아니라 무심·시크하게 관찰·훈수
M | 나이듦 수용/철듦형 | 예전엔 이해 못했지만 나이 들며 이해하게 된 성숙 서사
`.trim();

export const SYSTEM_PROMPT = `
너는 Threads 바이럴 콘텐츠 작성안을 검수하는 내부 분석가다.
아래 규칙을 정확히 따르고, 반드시 도구 호출(tool call) \`${TOOL_NAME}\`로만 결과를 반환한다. 다른 텍스트를 출력하지 않는다.

## 0. 최상위 원칙
Review의 목적은 "잘 쓰인 글인가"가 아니라:
1. 레퍼런스가 준 심리적 엔진을 새 소재로 옮겨오는 데 성공했는가 (Appeal Transfer)
2. 사람들이 검색까지 가는가 (Search Motivation)
3. 표면 서사를 새로 만들었는가 (Reconstruction Quality)
이다.

## 1. Hygiene Gate (구조 완성도) — 4개
- G1 본문 완결성: 질문·댓글의 답변에 의존하지 않고 본문만으로 내용이 완결되는가.
- G2 발견/전환: "근데", "그런데", "알고 보니", "웃긴 건", "실제로 해보니" 같은 단어가 있는지가 아니라 **의미상 전환**이 실제로 존재하는가를 판단한다. 단어만 있고 전환이 없으면 실패로 본다.
- G3 서사 완결: 서사가 본문 안에서 완결되는가.
- G4 결과·원인 구조성: 결과의 원인이 구체적이고 구조적으로 활용 가능한가.
각 gate에 pass(boolean)와 evidence(근거 한 줄)를 채운다. passedCount와 grade는 형식상 채우되, 서버가 항상 재계산해 덮어쓰므로 정확한 값 여부에 신경 쓰지 말고 각 gate 판단 자체에 집중한다.

## 2. Critical Gate
### 2.1 Reference / Draft Core Appeal (레퍼런스가 있을 때만 reference 채움)
- coreAppeal: 사람들이 실제로 욕망·반응한 심리적 소구 한 문장. **단순 주제 요약 금지.**
  - BAD (주제 요약): "다이소 화장품 추천"
  - GOOD (심리적 소구): "비싼 해결책보다 저렴하고 별것 아닌 제품에서 오히려 더 눈에 띄는 만족을 경험한 가격/기대 역전"
- viralEngine: 그 소구를 강하게 만든 표현 장치 (대비·반전·사회적 증거·반복사용 증거·관계·숫자·상황).
- draftCoreAppeal: 작성안에서도 동일한 기준으로 별도 추출 (레퍼런스 유무와 무관하게 항상 채운다).

### 2.2 Appeal Transfer (레퍼런스가 있을 때만)
STRONG | PARTIAL | MISMATCH. 표면 문장 복제가 아니라 **심리적 엔진**이 넘어왔는지 판단. evidence 필수, deviationPoint(가장 크게 이탈한 지점, 없으면 null).

### 2.3 Product Curiosity
STRONG | MEDIUM | WEAK. 글을 다 읽었을 때 "이게 뭐지? 무슨 제품이지?"라는 자연스러운 궁금증이 생기는가.

### 2.4 Search Motivation (Product Curiosity보다 엄격)
STRONG | MEDIUM | WEAK. 제품을 전혀 모르는 사람이 글을 다 읽은 직후 네이버에 제품명·키워드를 직접 검색할 정도의 **행동 동기**가 생기는가.
- **금지:** 본문을 미완성으로 만들거나 답을 댓글로 미루는 방식으로 만든 궁금증은 STRONG으로 평가하지 않는다. "이야기가 본문 안에서 완결됨 + 제품 자체는 궁금해짐"만 좋은 상태다.
- **금지:** 제품명 노출 횟수·정보량이 많다고 STRONG으로 평가하지 않는다. 기준은 정보격차·의외성·욕망·대비·결과·상황적 자기관련성이다.
liftDirection: 검색 동기를 높이기 위한 핵심 수정 방향.

## 3. Reconstruction Quality (레퍼런스가 있을 때만)
원칙: "심리적 엔진은 보존하되, 그 엔진을 전달하는 사건과 서사는 새로 만든다." Appeal Transfer(심리적 엔진 이전)와 Reconstruction(표면 서사 재설계)은 절대 같은 축이 아니다.

### 3.1 4개 축 — 각 CHANGED/SAME(/ADDED)/NOT_APPLICABLE
- persona: 화자·시점이 실질적으로 달라졌는가.
- event: 구체적으로 어떤 사건이 발생했는지.
- deficiencyTrigger: "왜 이 문제가 화자에게 갑자기 더 심각하고 절실한 문제가 되었는가". ADDED = 레퍼런스에 명시적 트리거가 없었는데 작성안에서 자연스럽게 새로 만든 경우(변화로 취급). **금지:** 제품을 팔기 위해 억지로 과장된 비극·위험 상황을 사실처럼 제시하는 방식은 좋은 재구성으로 평가하지 않는다 — 이 경우 evidence에 이유를 남기고 topProblems에도 반영한다.
- endingMethod: 결말의 서사 기능이 바뀌었는가 + endingType(정보 질문/감정 질문/선언/관찰/추천/반전/결론/리스트 마감/OTHER). disclosureMode(글 전체 표현 형식)와 절대 혼동하지 않는다.

**단순 단어 치환은 어떤 축에서도 CHANGED로 인정하지 않는다:**
| Reference | Draft | 판정 |
|---|---|---|
| 엄마 | 이모 | SAME (이름만 치환) |
| 친구 | 직장동료 | SAME (관계 실질 동일) |
| 스타벅스 | 다른 카페 | SAME (장소 이름만 치환) |
| 119 | 응급실 | SAME (기능 동일) |
| 3년 | 2년 | SAME (숫자만 치환) |
| 10kg | 8kg | SAME (숫자만 치환) |
표면 단어가 달라졌는지가 아니라 "독립적으로 새로운 사건을 설계했는가"를 판단한다.

### 3.2 Obstacle (장애물, 별도 평가)
장애물은 단순 디테일이 아니라 전환의 낙차를 만드는 Viral Engine의 일부일 수 있으므로 삭제하면 안 되고, 기능은 유지하되 내용은 재구성해야 한다.
- referenceHasObstacle=false이면 functionPreserved/detailsTransformed는 반드시 null.
- referenceHasObstacle=true이면 두 값 모두 boolean 필수.

### 3.3 Surface Clone Risk
LOW | MEDIUM | HIGH. 확인 요소: 문장 순서·특징적 표현·고유 숫자·특정 장소·특이 사건·신체 부위·관계·제품 외 고유 명사·장애물의 구체적 목록·같은 순서로 이어지는 디테일. quotedFragments에 실제 겹치는 표현·수치를 인용(각 500자 이내).

### 3.4 unchangedCount / applicableCount / verdict
형식상 채우되(unchangedCount, applicableCount, verdict), **너는 이 값을 스스로 확정하지 않는다.** 서버가 4개 축의 enum 값만 보고 항상 재계산해 덮어쓴다. 너는 각 축의 value/evidence를 정확하게 판단하는 데만 집중한다.
- evidence: 가장 크게 원문과 겹치는 지점 (없으면 "없음").
- revisionDirection: 재구성하려면 무엇을 바꿔야 하는지 (없으면 "유지 권장").

AI는 "법적으로 표절이다/아니다"라고 단정하지 않는다. 이 판정은 내부 재구성 훈련 기준이다.

## 4. Diagnostic
### Hook Code (A~M 중 하나 또는 NEW_PATTERN_CANDIDATE)
${HOOK_CODE_TABLE}
A~M은 지금까지 발견된 분류일 뿐이며 모든 콘텐츠가 A~M에 속한다고 가정하지 않는다. 명확히 속하지 않으면 NEW_PATTERN_CANDIDATE를 반환하고 whyDifferent/structureSummary/proposedName/linguisticFeatures를 채운다. OTHER는 이 축에서 사용하지 않는다.

### 감정태도 / 화자 / 정보공개방식
- emotion: 절박함 | 시크함 | 순수감탄 | 놀람 | OTHER
- speaker: 본인 1인칭 | 딸-엄마 관찰 | 친구-친구 관찰 | 순수 목격자 | OTHER
- disclosureMode: 직접서술 | 리스트 | 대화체 | 선언문 | OTHER (글 전체 표현 형식. endingMethod.endingType과 다른 개념이다)
OTHER면 otherLabel 필수, 아니면 반드시 null.

### 기타 필드
listHomogeneity(applicable/pass/evidence), salesMessageStandsOut(pass/evidence), healthClaimsToVerify(검증 필요한 건강 주장 목록, 없으면 빈 배열), topProblems(1~3개), revisionDirection.
임의의 백분율 필드는 만들지 않는다.

## 5. Final Verdict
형식상 채우되(value, reasons), **너는 이 값을 스스로 확정하지 않는다.** 서버가 결정적 규칙으로 항상 재계산해 덮어쓴다. READY|NEEDS_REVISION|FAIL 중 네가 판단하기에 가장 근접한 값과 이유를 적당히 채워도 되지만, 최종 응답에는 반영되지 않는다.

## 6. 레퍼런스가 없는 경우
사용자 메시지에 레퍼런스 원문이 없다고 명시되면: critical.reference=null, critical.appealTransfer=null, critical.reconstruction=null로 반환한다. draftCoreAppeal, productCuriosity, searchMotivation은 레퍼런스 유무와 무관하게 항상 채운다.

이제 사용자 메시지의 작성안(과 있다면 레퍼런스 원문)을 분석하고 ${TOOL_NAME} 도구를 호출해 결과를 반환하라.
`.trim();

export function buildUserMessage(params: { draft: string; refOriginal: string | null }): string {
  const { draft, refOriginal } = params;
  if (refOriginal === null) {
    return [
      "레퍼런스 원문: 없음 (이 행은 Draft 단독 분석 대상이다. reference/appealTransfer/reconstruction은 모두 null로 반환하라.)",
      "",
      "작성안(리뷰내용):",
      draft,
    ].join("\n");
  }
  return [
    "레퍼런스 원문:",
    refOriginal,
    "",
    "작성안(리뷰내용):",
    draft,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Tool input JSON Schema (Anthropic tool-use 강제 호출용).
// lib/schema/rowAnalysis.ts의 Zod 스키마와 1:1 대응. 최종 런타임 검증은 Zod가 담당한다.
// ---------------------------------------------------------------------------

const evidenceProp = { type: "string", minLength: 1 } as const;

const hygieneGateJson = {
  type: "object",
  properties: { pass: { type: "boolean" }, evidence: evidenceProp },
  required: ["pass", "evidence"],
};

const hygieneJson = {
  type: "object",
  properties: {
    gates: {
      type: "object",
      properties: {
        G1_self_contained: hygieneGateJson,
        G2_discovery: hygieneGateJson,
        G3_narrative: hygieneGateJson,
        G4_causal_structure: hygieneGateJson,
      },
      required: ["G1_self_contained", "G2_discovery", "G3_narrative", "G4_causal_structure"],
    },
    passedCount: { type: "integer", minimum: 0, maximum: 4 },
    grade: { type: "string", enum: ["A", "B", "FAIL"] },
  },
  required: ["gates", "passedCount", "grade"],
};

const referenceCoreJson = {
  type: "object",
  properties: {
    coreAppeal: { type: "string", minLength: 1 },
    viralEngine: { type: "string", minLength: 1 },
  },
  required: ["coreAppeal", "viralEngine"],
};

const appealTransferJson = {
  type: "object",
  properties: {
    value: { type: "string", enum: ["STRONG", "PARTIAL", "MISMATCH"] },
    evidence: evidenceProp,
    deviationPoint: { type: ["string", "null"] },
  },
  required: ["value", "evidence", "deviationPoint"],
};

const productCuriosityJson = {
  type: "object",
  properties: {
    value: { type: "string", enum: ["STRONG", "MEDIUM", "WEAK"] },
    evidence: evidenceProp,
  },
  required: ["value", "evidence"],
};

const searchMotivationJson = {
  type: "object",
  properties: {
    value: { type: "string", enum: ["STRONG", "MEDIUM", "WEAK"] },
    evidence: evidenceProp,
    liftDirection: { type: "string", minLength: 1 },
  },
  required: ["value", "evidence", "liftDirection"],
};

const personaEventJson = {
  type: "object",
  properties: {
    value: { type: "string", enum: ["CHANGED", "SAME", "NOT_APPLICABLE"] },
    referenceSummary: { type: "string", minLength: 1 },
    draftSummary: { type: "string", minLength: 1 },
    evidence: evidenceProp,
  },
  required: ["value", "referenceSummary", "draftSummary", "evidence"],
};

const deficiencyTriggerJson = {
  type: "object",
  properties: {
    value: { type: "string", enum: ["CHANGED", "SAME", "ADDED", "NOT_APPLICABLE"] },
    referenceSummary: { type: ["string", "null"] },
    draftSummary: { type: "string", minLength: 1 },
    evidence: evidenceProp,
  },
  required: ["value", "referenceSummary", "draftSummary", "evidence"],
};

const endingTypeJson = {
  type: "string",
  enum: ["정보 질문", "감정 질문", "선언", "관찰", "추천", "반전", "결론", "리스트 마감", "OTHER"],
};

const endingMethodJson = {
  type: "object",
  properties: {
    value: { type: "string", enum: ["CHANGED", "SAME", "NOT_APPLICABLE"] },
    referenceType: endingTypeJson,
    draftType: endingTypeJson,
    evidence: evidenceProp,
  },
  required: ["value", "referenceType", "draftType", "evidence"],
};

const obstacleJson = {
  type: "object",
  properties: {
    referenceHasObstacle: { type: "boolean" },
    draftHasObstacle: { type: "boolean" },
    functionPreserved: { type: ["boolean", "null"] },
    detailsTransformed: { type: ["boolean", "null"] },
    evidence: evidenceProp,
  },
  required: ["referenceHasObstacle", "draftHasObstacle", "functionPreserved", "detailsTransformed", "evidence"],
};

const surfaceCloneRiskJson = {
  type: "object",
  properties: {
    value: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
    quotedFragments: { type: "array", items: { type: "string", maxLength: 500 } },
    evidence: evidenceProp,
  },
  required: ["value", "quotedFragments", "evidence"],
};

const reconstructionJson = {
  type: "object",
  properties: {
    persona: personaEventJson,
    event: personaEventJson,
    deficiencyTrigger: deficiencyTriggerJson,
    endingMethod: endingMethodJson,
    obstacle: obstacleJson,
    surfaceCloneRisk: surfaceCloneRiskJson,
    unchangedCount: { type: "integer", minimum: 0, maximum: 4 },
    applicableCount: { type: "integer", minimum: 0, maximum: 4 },
    verdict: { type: "string", enum: ["TRANSFORMED", "BORDERLINE", "TOO_CLOSE"] },
    evidence: { type: "string", minLength: 1 },
    revisionDirection: { type: "string", minLength: 1 },
  },
  required: [
    "persona",
    "event",
    "deficiencyTrigger",
    "endingMethod",
    "obstacle",
    "surfaceCloneRisk",
    "unchangedCount",
    "applicableCount",
    "verdict",
    "evidence",
    "revisionDirection",
  ],
};

function otherableEnumJson(values: string[]) {
  return {
    type: "object",
    properties: {
      value: { type: "string", enum: [...values, "OTHER"] },
      otherLabel: { type: ["string", "null"] },
    },
    required: ["value", "otherLabel"],
  };
}

const newPatternCandidateJson = {
  type: ["object", "null"],
  properties: {
    whyDifferent: { type: "string", minLength: 1 },
    structureSummary: { type: "string", minLength: 1 },
    proposedName: { type: "string", minLength: 1 },
    linguisticFeatures: { type: "array", items: { type: "string", minLength: 1 }, minItems: 1 },
  },
  required: ["whyDifferent", "structureSummary", "proposedName", "linguisticFeatures"],
};

const diagnosticJson = {
  type: "object",
  properties: {
    hookCode: {
      type: "string",
      enum: ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "NEW_PATTERN_CANDIDATE"],
    },
    hookCodeReason: { type: "string", minLength: 1 },
    newPatternCandidate: newPatternCandidateJson,
    emotion: otherableEnumJson(["절박함", "시크함", "순수감탄", "놀람"]),
    speaker: otherableEnumJson(["본인 1인칭", "딸-엄마 관찰", "친구-친구 관찰", "순수 목격자"]),
    disclosureMode: otherableEnumJson(["직접서술", "리스트", "대화체", "선언문"]),
    listHomogeneity: {
      type: "object",
      properties: {
        applicable: { type: "boolean" },
        pass: { type: "boolean" },
        evidence: { type: "string", minLength: 1 },
      },
      required: ["applicable", "pass", "evidence"],
    },
    salesMessageStandsOut: {
      type: "object",
      properties: { pass: { type: "boolean" }, evidence: { type: "string", minLength: 1 } },
      required: ["pass", "evidence"],
    },
    healthClaimsToVerify: { type: "array", items: { type: "string" } },
    topProblems: { type: "array", items: { type: "string", minLength: 1 }, minItems: 1, maxItems: 3 },
    revisionDirection: { type: "string", minLength: 1 },
  },
  required: [
    "hookCode",
    "hookCodeReason",
    "newPatternCandidate",
    "emotion",
    "speaker",
    "disclosureMode",
    "listHomogeneity",
    "salesMessageStandsOut",
    "healthClaimsToVerify",
    "topProblems",
    "revisionDirection",
  ],
};

const finalVerdictJson = {
  type: "object",
  properties: {
    value: { type: "string", enum: ["READY", "NEEDS_REVISION", "FAIL"] },
    reasons: { type: "array", items: { type: "string", minLength: 1 } },
  },
  required: ["value", "reasons"],
};

export function buildToolInputSchema(refExists: boolean) {
  const critical = refExists
    ? {
        type: "object",
        properties: {
          reference: referenceCoreJson,
          draftCoreAppeal: { type: "string", minLength: 1 },
          appealTransfer: appealTransferJson,
          productCuriosity: productCuriosityJson,
          searchMotivation: searchMotivationJson,
          reconstruction: reconstructionJson,
        },
        required: [
          "reference",
          "draftCoreAppeal",
          "appealTransfer",
          "productCuriosity",
          "searchMotivation",
          "reconstruction",
        ],
      }
    : {
        type: "object",
        properties: {
          reference: { type: "null" },
          draftCoreAppeal: { type: "string", minLength: 1 },
          appealTransfer: { type: "null" },
          productCuriosity: productCuriosityJson,
          searchMotivation: searchMotivationJson,
          reconstruction: { type: "null" },
        },
        required: [
          "reference",
          "draftCoreAppeal",
          "appealTransfer",
          "productCuriosity",
          "searchMotivation",
          "reconstruction",
        ],
      };

  return {
    type: "object",
    properties: {
      hygiene: hygieneJson,
      critical,
      diagnostic: diagnosticJson,
      finalVerdict: finalVerdictJson,
    },
    required: ["hygiene", "critical", "diagnostic", "finalVerdict"],
  };
}
