# RECONSTRUCTION_RULES.md — Reconstruction Quality 판정 규칙

이 문서는 Review의 Critical Gate 안에서 동작하는 **Reconstruction Quality** 판정의 완전한 규칙집이다.
`docs/SPEC.md §1.4a`와 `docs/DATA_CONTRACT.md §2.2 critical.reconstruction` 스키마의 근거 문서.
정의를 바꾸면 반드시 `promptVersion`을 올린다. 현재 `promptVersion = v3`.

---

## 0. 왜 이 평가가 필요한가

레퍼런스를 활용할 때 **모든 것을 바꾸는 것이 목적이 아니다.** 다음을 반드시 구분한다.

### 유지해야 하는 것
레퍼런스가 실제로 사람들의 반응을 만든 **핵심 심리적 엔진**.
- Reference Core Appeal / Reference Viral Engine
- 대비 구조 / 반전의 기능 / 장애물이 만들어내는 낙차 / 발견·전환의 역할

이 축은 이미 **Appeal Transfer**가 평가한다.

### 다시 만들어야 하는 것
레퍼런스의 **표면 서사와 구체적 디테일**. 최소 4개 축 + 장애물 + 표면 복제 위험을 각각 별도로 판단.

**한 줄 원칙:** "심리적 엔진은 보존하되, 그 엔진을 전달하는 사건과 서사는 새로 만든다."

---

## 1. 기존 개념과의 역할 분리

| 축 | 무엇을 보는가 | 판정 |
|---|---|---|
| **Appeal Transfer** (기존) | 원본이 터진 심리적 이유(Core Appeal + Viral Engine)가 draft에서도 살아 있는가 | `STRONG / PARTIAL / MISMATCH` |
| **Reconstruction Quality** (신규) | 표면 서사(Persona/Event/Trigger/Ending) 및 장애물을 새로 설계했는가 | `TRANSFORMED / BORDERLINE / TOO_CLOSE` |
| **Surface Clone Risk** (기존 referenceCloneRisk 이동·재명명) | 원문의 실제 표현·고유 디테일이 지나치게 복제됐는가 | `LOW / MEDIUM / HIGH` |

세 축은 서로 **독립적**이다. Appeal Transfer=STRONG인데 Reconstruction=TOO_CLOSE, Reconstruction=TRANSFORMED인데 Appeal Transfer=MISMATCH가 모두 가능하며, 각각 다른 개선 조치가 필요하다 (§7).

> 이 문서에서 다루지 않는 개념은 `docs/SPEC.md §1.4`와 `docs/HOOK_CODES.md` 참조.

---

## 2. 4개 표면 서사 축

### 2.1 Persona (화자·시점)

**enum:** `CHANGED | SAME | NOT_APPLICABLE`

비교 대상: 레퍼런스 화자가 누구인가 · 작성안 화자가 누구인가 · 두 사람의 관계·시점이 실질적으로 달라졌는가.

- **CHANGED 예:**
  - Reference: 엄마의 경험을 이야기하는 딸
  - Draft: 친구의 경험을 이야기하는 화자
- **SAME 예 (이름만 바꿈):**
  - Reference: 엄마 얘기하는 딸
  - Draft: 이모 얘기하는 조카 → 실질 관계·시점 동일 → **SAME**

AI 반환 필드: `value`, `referenceSummary`(레퍼런스 화자 한 줄), `draftSummary`(작성안 화자 한 줄), `evidence`(왜 그렇게 판정했는지).

### 2.2 Event (사건)

**enum:** `CHANGED | SAME | NOT_APPLICABLE`

구체적으로 어떤 사건이 발생했는지 비교.

- **CHANGED 예:**
  - Reference: 새벽에 증상이 심해져 119를 부름 → 특정 음료를 시도
  - Draft: 데이트 중 문제가 발생해 응급실에 감 → 연인 앞에서 부끄러운 사건이 발생
- **SAME 예 (명사만 치환):**
  - Reference: 새벽에 증상 → 119
  - Draft: 밤에 증상 → 응급실
  - 사건 순서·기능이 동일 → **SAME**

**단순 명사 치환을 재구성으로 인정하지 않는다** (§4 참조).

AI 반환 필드: `value`, `referenceSummary`, `draftSummary`, `evidence`.

### 2.3 Deficiency Trigger (결핍 계기)

**enum:** `CHANGED | SAME | ADDED | NOT_APPLICABLE`

정의: "왜 이 문제가 화자에게 **갑자기 더 심각하고 절실한 문제**가 되었는가."

예시:
- 연인에게 부끄러움 / 자녀에게 들킨 사건 / 회사에서 난처했던 사건 / 중요한 일정 직전 문제 발생 / 반복 실패로 인한 좌절

**ADDED**: 레퍼런스에는 명시적 Trigger가 없었는데 작성안에서 자연스러운 Trigger를 새로 만든 경우. **재구성 측면에서는 변화(unchangedCount에 포함 안 됨)로 취급.**

**금지 규칙:** 제품을 팔기 위해 억지로 과장된 비극이나 위험 상황을 만들어 사실처럼 제시하는 방식은 좋은 재구성으로 평가하지 않는다. 이 경우 `evidence`에 그 이유를 남기고 verdict 판단에는 CHANGED/ADDED로 처리하지 않는다(SAME으로 처리하지도 않는다 — 별도의 `topProblems`에 기록되도록 프롬프트에 명시).

AI 반환 필드: `value`, `referenceSummary`(없으면 `null`), `draftSummary`, `evidence`.

### 2.4 Ending Method (결말 방식)

**enum (변화 여부):** `CHANGED | SAME | NOT_APPLICABLE`

**결말 유형 enum (`endingType`):** `정보 질문 | 감정 질문 | 선언 | 관찰 | 추천 | 반전 | 결론 | 리스트 마감 | OTHER`

- **CHANGED 예:**
  - Reference: 정보를 얻기 위한 질문으로 종료 ("좋은 방법 있어?") → `endingType = 정보 질문`
  - Draft: 본문 안에서 서사를 완결하고 다른 성격의 감정/관찰/선언으로 종료 → `endingType = 관찰`
- **SAME 예:** 마지막 한 문장만 바꿨더라도 전체 서사의 결말 기능이 동일하면 SAME.

**정보공개방식(diagnostic)과의 구분:**
- `disclosureMode` = 글 전체 표현 형식 (`직접서술 / 리스트 / 대화체 / 선언문 / OTHER`)
- `endingMethod.endingType` = **마지막 서사 기능** (위 9종)

두 축은 다른 것을 본다. 예: 리스트로 서술된 글이 마지막에 반전으로 끝날 수 있다 (`disclosureMode = 리스트`, `endingType = 반전`).

AI 반환 필드: `value`(CHANGED/SAME/NOT_APPLICABLE), `referenceType`(위 enum), `draftType`(위 enum), `evidence`.

---

## 3. Obstacle (장애물) — 별도 처리

장애물은 단순 디테일이 아니라 **전환의 낙차를 만드는 Viral Engine의 일부**일 수 있으므로 4개 축과 별도로 평가한다.

### 3.1 스키마

- `referenceHasObstacle: boolean` — 레퍼런스에 장애물(여러 시도의 실패 등)이 있는가
- `draftHasObstacle: boolean` — 작성안에 장애물이 있는가
- `functionPreserved: boolean | null` — 레퍼런스 장애물의 **기능**(전환의 낙차 생성 등)이 작성안에서도 유지되는가. 레퍼런스에 없으면 `null`.
- `detailsTransformed: boolean | null` — 장애물의 **구체 내용**이 새로 구성되었는가 (단순 이름 치환은 false). 레퍼런스에 없으면 `null`.
- `evidence: string`

### 3.2 판정 원칙

| 경우 | 처리 |
|---|---|
| `referenceHasObstacle === false` | `functionPreserved = null, detailsTransformed = null`. 판정 대상 아님 (`N/A`). |
| Reference에 장애물, Draft에 없음 (`draftHasObstacle === false`) | `functionPreserved = false`. Viral Engine 훼손 가능성. `topProblems`에 반영. |
| Reference·Draft 모두 있고 기능 유지 + 세부 재구성 | 이상적: `functionPreserved = true, detailsTransformed = true`. |
| Reference·Draft 모두 있고 기능 유지 + 이름만 치환 | `functionPreserved = true, detailsTransformed = false`. Surface Clone Risk와 함께 재구성 권고. |

### 3.3 예시

**BAD** (이름만 바꾼 목록):
- Reference: A 실패 → B 실패 → C 실패
- Draft: A 이름만 변경 → B 이름만 변경 → C 이름만 변경 → `functionPreserved=true, detailsTransformed=false`

**GOOD** (기능 유지 + 내용 재구성):
- Reference: 비용 많이 든 전문 관리 → 특정 음료 → 생활 습관 시도
- Draft: 다른 종류의 현실적인 해결 시도들을 새로 구성. "여러 대안을 거쳤지만 해결되지 않음 → 마지막 발견의 가치가 커짐" 기능만 유지 → `functionPreserved=true, detailsTransformed=true`

---

## 4. Surface Clone Risk

기존 `diagnostic.referenceCloneRisk`를 **`critical.reconstruction.surfaceCloneRisk`로 이동·재명명**. enum 대소문자도 `low/medium/high` → `LOW/MEDIUM/HIGH`로 통일.

**enum:** `LOW | MEDIUM | HIGH`

확인 요소 (프롬프트에 명시):
- 문장 순서 / 특징적인 표현 / 고유한 숫자 / 특정 장소 / 특이한 사건 / 신체 부위 / 관계 / 제품 외 고유 명사 / 장애물의 구체적인 목록 / 같은 순서로 이어지는 디테일

스키마:
- `value: LOW | MEDIUM | HIGH`
- `quotedFragments: string[]` — 실제 겹치는 표현·수치 인용
- `evidence: string`

**HIGH이면 Final Verdict에서 READY 불가** (§6).

---

## 5. 단순 단어 치환 금지 (전역)

다음은 어떤 축에서도 `CHANGED`로 평가하지 않는다.

| Reference | Draft | 판정 |
|---|---|---|
| 엄마 | 이모 | 이름만 치환 → SAME 가능성 높음 |
| 친구 | 직장동료 | 관계 실질 동일 → SAME |
| 스타벅스 | 다른 카페 | 장소 이름만 치환 → SAME |
| 119 | 응급실 | 기능 동일 → SAME |
| 3년 | 2년 | 숫자만 치환 → SAME |
| 10kg | 8kg | 숫자만 치환 → SAME |

AI는 **표면 단어가 달라졌는지가 아니라 "독립적으로 새로운 사건을 설계했는가"를 판단한다.** 이 규칙은 프롬프트 상수에 그대로 명시된다.

---

## 6. 서버 계산 (verdict / unchangedCount)

### 6.1 unchangedCount

- 4개 축(Persona / Event / DeficiencyTrigger / EndingMethod) 중 `value === "SAME"`인 개수.
- **`NOT_APPLICABLE`은 count 대상 아님 (분자·분모 모두에서 제외).**
- `ADDED`(DeficiencyTrigger 전용)는 변화로 취급 (SAME이 아님).

### 6.2 applicableCount

- 4개 축 중 `value !== "NOT_APPLICABLE"`인 개수.
- Portfolio에서 축별 SAME 비율을 계산할 때 분모로 쓴다.

### 6.3 verdict

- `unchangedCount === 0` → **`TRANSFORMED`**
- `unchangedCount === 1` → **`BORDERLINE`**
- `unchangedCount >= 2` → **`TOO_CLOSE`**

**AI가 verdict/unchangedCount를 임의 확정해서는 안 된다.** 각 축의 enum값을 근거로 서버가 계산해 덮어씀.

### 6.4 UI/문서 카피 (정확히 이 문구로)

- **TRANSFORMED**: 레퍼런스의 심리적 엔진은 활용하면서 표면 서사를 충분히 새로 구성함.
- **BORDERLINE**: 일부 핵심 서사 요소가 원문과 너무 가까움. 재구성 여지가 있음.
- **TOO_CLOSE**: 2개 이상의 주요 서사 요소가 사실상 원문과 동일하여 현재 내부 기준상 단순 각색/치환에 가까움. 다시 작성 권장.

**AI는 "법적으로 표절이다/아니다"라고 단정하지 않는다.** 이 판정은 내부 재구성 훈련 기준일 뿐이다.

---

## 7. Appeal Transfer × Reconstruction 조합 해석

| Appeal Transfer | Reconstruction | 의미 | 조치 |
|---|---|---|---|
| STRONG | TRANSFORMED | 이상적 | 유지 |
| STRONG | TOO_CLOSE | 원본이 터진 이유는 살렸지만 스토리를 너무 그대로 베낌 | 재구성 필요 |
| MISMATCH | TRANSFORMED | 이야기는 새로 만들었지만 원본이 터진 이유를 잃음 | "이 레퍼런스 활용 재구성"으로는 실패 |
| MISMATCH | TOO_CLOSE | 심리적 엔진도 잃고 서사도 그대로 | 전면 재작성 |

**두 축은 UI에서 반드시 독립적으로 표시**한다 (§8, `SPEC.md §1.6`).

---

## 8. UI 요구사항 (SPEC §1.6 확장)

레퍼런스가 존재하는 행 상세 화면의 **Critical Gate 아래**에 `RECONSTRUCTION` 섹션 추가. 최소 표시:

```
RECONSTRUCTION
  Persona                  Reference → Draft   CHANGED / SAME
  Event                    Reference → Draft   CHANGED / SAME
  Deficiency Trigger       Reference → Draft   CHANGED / SAME / ADDED / N/A
  Ending Method            Reference → Draft   CHANGED / SAME / N/A
                           (endingType: Reference → Draft)
  Obstacle                 기능 유지 여부 · 세부내용 재구성 여부
  Surface Clone Risk       LOW / MEDIUM / HIGH
  Unchanged                {unchangedCount} / {applicableCount}
  Reconstruction Verdict   TRANSFORMED / BORDERLINE / TOO_CLOSE
  가장 크게 원문과 겹치는 지점    {reconstruction.evidence}
  재구성하려면 무엇을 바꿔야 하는지  {reconstruction.revisionDirection}
```

레퍼런스가 없는 행에서는 이 섹션 전체를 숨긴다.

---

## 9. Final Verdict 반영 (SPEC §1.5 / DATA_CONTRACT §2.4 개정)

**refExists = (refOriginal !== null && refOriginal !== "")**

**FAIL** — 아래 중 하나라도 참이면:
- `hygiene.grade === "FAIL"`
- `searchMotivation.value === "WEAK"`
- `refExists && appealTransfer.value === "MISMATCH"`
- **NEW:** `refExists && reconstruction.verdict === "TOO_CLOSE"`
- **NEW:** `refExists && reconstruction.surfaceCloneRisk.value === "HIGH"`

**READY** — FAIL이 아니면서 모두 참이어야:
- `hygiene.grade === "A"`
- `searchMotivation.value === "STRONG"`
- `refExists ? appealTransfer.value === "STRONG" : true`
- **NEW:** `refExists ? reconstruction.verdict === "TRANSFORMED" : true`
- **NEW:** `refExists ? reconstruction.surfaceCloneRisk.value !== "HIGH" : true`

**NEEDS_REVISION** — 위 두 조건 어디에도 해당하지 않는 나머지. `BORDERLINE`은 READY가 아니라 최소 NEEDS_REVISION.

레퍼런스가 없는 draft에서는 Reconstruction은 Final Verdict 계산에서 제외한다.

`reasons[]`에는 원인을 사람이 읽을 수 있게 나열 (예: `"reconstruction.verdict = TOO_CLOSE (Persona/Event SAME)"`, `"surfaceCloneRisk = HIGH — 특이 숫자 3개 그대로"`).

---

## 10. Portfolio 훈련 지표 (SPEC §1.8 확장)

레퍼런스가 존재하는 행만을 대상으로:

- `reconstructionVerdict` 분포: `{ TRANSFORMED, BORDERLINE, TOO_CLOSE }`
- `surfaceCloneRisk` 분포: `{ LOW, MEDIUM, HIGH }`
- 축별 SAME 횟수 (denominator = 축별 applicable 행 수):
  - `personaSame`
  - `eventSame`
  - `deficiencyTriggerSame`
  - `endingSame`
- 향후 확장 예정 (컬럼은 지금 준비, 초기엔 표시 안 해도 무방):
  - `obstacleDeletedCount` — 레퍼런스에 장애물이 있었는데 draft에서 삭제한 개수
  - `obstacleDetailClonedCount` — 장애물 내용을 사실상 복제한 개수

사용 예:
```
최근 30개 (레퍼런스 있음 기준):
  Persona SAME 3 / 30
  Event SAME 14 / 28
  Deficiency Trigger SAME 11 / 20
  Ending SAME 2 / 27
→ "사건과 결핍 계기를 새로 만드는 능력이 가장 부족하다"
```

이 훈련 피드백은 Portfolio `recommendation` 자유서술에 자동 반영되도록 프롬프트에 데이터를 주입한다 (AI가 별도 카운트를 만들지 않는다).

---

## 11. Acceptance Test 케이스 (ACCEPTANCE_TESTS Phase 2/3에 삽입)

프롬프트가 단순 문자 유사도 검사로 흐르지 않는지 육안 확인.

- **Case 1** — 제품명·단어만 몇 개 변경, Persona/Event/Trigger/Ending 사실상 동일 → **TOO_CLOSE 예상**.
- **Case 2** — Core Appeal/Viral Engine 유지 + Persona/Event/Trigger/Ending 모두 새로 설계 → **Appeal Transfer STRONG + Reconstruction TRANSFORMED 예상**.
- **Case 3** — 스토리는 완전히 새로우나 Reference Core Appeal 상실 → **Reconstruction TRANSFORMED + Appeal Transfer MISMATCH 예상**.
- **Case 4** — Reference에 장애물 나열이 있었지만 Draft에서 삭제 → **obstacle.functionPreserved=false**, `topProblems`에 반영.
- **Case 5** — Reference 장애물의 기능은 유지, 실패 방법·사건은 새로 구성 → **detailsTransformed=true**.
- **Case 6** — 문장은 대부분 바뀌었지만 특이한 숫자/사건/순서/디테일이 그대로 남음 → **Surface Clone Risk MEDIUM 또는 HIGH 예상**.
