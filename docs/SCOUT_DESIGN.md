# SCOUT_DESIGN.md — Scout 시스템 설계

Scout는 Review 완성·실사용 검증 이후에만 개발한다. 이 문서는 그 시점에 착수할 수 있도록 원칙과 구조를 미리 확정해둔다.
데이터 스키마의 정확한 컬럼은 `docs/DATA_CONTRACT.md §6`, Phase별 산출물·통과 기준은 `docs/ACCEPTANCE_TESTS.md` 후반부 참조.

---

## 1. 한 줄 정의와 목적

Scout는 Threads에서 **내가 아직 확보하지 않은 새로운 콘텐츠 구조**를 지속적으로 발견하는 도구다.

- 검색어 몇십 개를 반복 실행해서 후보 수를 늘리는 프로그램이 **아니다.** 그렇게 하면 같은 글만 반복 수집되어 다양성이 사라진다.
- 두 가지를 **동시에** 한다:
  1. 이미 알고 있는 좋은 바이럴 패턴을 효율적으로 찾기.
  2. 아직 A~M 어디에도 명확히 안 들어가는 새로운 패턴을 지속적으로 탐험하기.

핵심 개념: **Search Gene Pool, Novelty, Diversity, Exploration.**

---

## 2. 수렴(convergence) 방지: 왜 이 설계가 필요한가

Scout가 매번 같은 소수의 검색어로만 돌면, 결과 후보군이 소수의 구조·화자·감정에 몰려간다. 그 상태에서 잘 뽑는 것 = 이미 있는 것과 비슷한 걸 잘 뽑는 것 = **다양성 붕괴**.

이걸 막기 위한 5개 축(모두 이 문서에 정의):

1. **Search Gene Pool** — 검색어를 하드코딩하지 않고 관리·확장 가능하게.
2. **Semantic/Structural Clustering** — 다른 검색어가 같은 구조의 글을 가져와도 같은 무더기로 묶어 상한을 건다.
3. **Diversity Quota** — 최종 추천에서 동일 Family/Hook/화자/공개방식/Cluster의 독점을 막는다.
4. **Explore 슬롯** — 안전한 후보(Exploit)만 뽑지 않고, 낯설지만 흥미로운 후보를 항상 일정 비율 섞는다.
5. **NEW_PATTERN_CANDIDATE** — 기존 분류에 안 맞는 후보를 버리지 않고 보존·누적·승격 절차.

---

## 3. Search Gene Pool

### 3.1 구조

`Search Family → Seed Query`.

### 3.2 초기 Seed 예시 (사용자가 준 것)

| Family | Seed 예시 |
|---|---|
| 발견 | 우연히 발견 · 처음 봤는데 · 이걸 이제 앎 · 왜 아무도 안 알려줌 · 신상인데 |
| 기대 뒤집기 | 별 기대 안했는데 · 솔직히 맛없을 줄 · 안 사려고 했는데 · 반신반의했는데 · 생각 바뀜 |
| 반복사용/중독 | 벌써 몇 번째 · 또 삼 · 쟁여두는 중 · 맨날 먹는 · 없으면 다시 사는 |
| 관계 | 친구가 알려준 · 남친이 사온 · 동생이 먹길래 · 엄마가 알려준 · 회사 사람이 먹길래 |
| 상황 | 출근 전에 · 야근할 때 · 당 떨어질 때 · 운동 끝나고 · 입 심심할 때 |
| 품평 | 초코 좋아하면 · 단 거 싫어하는 사람 기준 · 내 기준 1등 · 요즘 먹은 것 중 · 이건 인정 |
| 논쟁/반대 | 나만 이해 안 됨 · 호불호 왜 갈림 · 과대평가인 줄 · 유행하는 이유 알겠음 · 솔직히 비추 |
| 리스트 | 요즘 잘 산 것 · 삶의 질 올라간 것 · 회사 서랍템 · 냉장고 필수템 · 재구매템 |
| 변화/세대 | 예전엔 이해 못했는데 · 20대엔 몰랐는데 · 나이 먹으니까 · 취향 바뀐 것 · 요즘 이상하게 |
| 권위/비용 대비 | 비싼 거 다 해봤는데 · 유명한 거 다 써봤는데 · 몇 년을 고생했는데 · 전문가가 알려준 · 이렇게 간단한 걸 |

이 목록은 **시작 Seed일 뿐이다.** 사용자가 코드 수정 없이 추가·수정·비활성화 가능.

### 3.3 Query 상태 (`seed_queries.state`)

- `ACTIVE` — 실제 실행 대상
- `CANDIDATE` — AI 또는 사용자가 제안한 후보. 실행되지 않음
- `REJECTED` — 사용자가 명시 거부
- `DISABLED` — 임시 비활성화 (재활성화 가능)

**AI가 만든 Query는 반드시 `CANDIDATE`로 시작.** 사용자 승인 시 `ACTIVE`.

### 3.4 Query 출처 (`seed_queries.provenance`)

- `USER_MANUAL` — 사용자가 직접 입력
- `AI_EXPANSION` — Family/기존 Seed를 바탕으로 AI가 확장
- `SAVED_REFERENCE` — 사용자가 SAVE한 레퍼런스에서 AI가 뽑아낸 언어 특징
- `DISCOVERED_PATTERN` — `NEW_PATTERN_CANDIDATE` 관찰에서 파생

추가로 필요하면 `parent_seed_id`(자기 참조)와 `source_reference_id`(FK)를 함께 기록.

### 3.5 Gene Pool 자가 확장

사용자가 어떤 레퍼런스를 SAVE하면 AI가 그 콘텐츠의 "검색 가능한 언어 특징"을 추출해 Query 후보를 제안한다. 예:

- 원문 구조: "브랜드 관계자 직접 호출 → 반복 구매 증거 → 계속 판매해달라는 요청"
- AI 제안 Query 후보: `관계자분들 제발`, `계속 팔아줘`, `왜 단종`, `다시 내줘`, `상시 판매`, `쟁여놔야겠다`

이 후보는 자동 `ACTIVE`가 되지 않는다(§3.3).

### 3.6 Query Performance (초기엔 데이터 축적만)

`query_runs` 테이블에 실행별 `raw_count`, `deduped_count`, `recommended_count`, `saved_count`를 기록. 초기 MVP에서는 자동 최적화 알고리즘을 만들지 않는다. **데이터만 축적할 수 있는 구조를 준비.**

예상 관찰:
```
Query A: 실행 20회 · 후보 300개 · SAVE 4개  → 낮은 효율
Query B: 실행  8회 · 후보  80개 · SAVE 14개 → 높은 효율
```

---

## 4. Search Family ≠ Hook Code

- **Search Family** = "새 콘텐츠를 찾기 위한 탐색" 체계 (검색어 그룹).
- **Hook Code** = "발견된 콘텐츠 분류" 체계 (`docs/HOOK_CODES.md`의 A~M + NEW_PATTERN_CANDIDATE).

두 축을 절대 통합하지 않는다. `scout_candidates`에 `family_id`(탐색 origin)와 `hook / classification`(발견된 구조)을 별개 컬럼으로 유지한다.

이유: Family "관계"로 찾은 글이 Hook "L(시크한 관찰자형)"일 수도, "A(직접 추천형)"일 수도 있다. 두 축을 합치면 이 다양성이 소실된다.

---

## 4a. Review와의 개념 재사용 (Reference Core Appeal / Viral Engine / Reconstruction 훈련 데이터)

Review Phase에서 도입된 개념 중 Scout가 향후 활용할 수 있는 것.

- **`referenceCoreAppeal` / `referenceViralEngine`** — 사람들이 반응한 심리적 소구 한 문장 및 그 표현 장치. `saved_references.core_appeal` / `saved_references.viral_engine` 컬럼(`DATA_CONTRACT §6.4`)에 저장. Scout C의 Novelty 판정에서 similarity/novelty의 강력한 축(기존 저장분과 후보의 core appeal이 얼마나 다른가).
- **Reconstruction 훈련 데이터** — Review Phase에서 축적된 축별 SAME 카운트, `reconstructionVerdict` 분포, `surfaceCloneRisk` 분포는 사용자가 어떤 서사 축을 새로 만드는 데 약한지 보여준다. Scout가 그 약점을 우선 채우도록 **Diversity Quota**의 축별 상한을 동적으로 낮추거나, 특정 축의 SAME 비율이 임계 초과인 경우 그 축이 강한 후보를 Explore 슬롯에 추가로 배정하는 방식으로 활용 가능. 초기 MVP에서는 저장만 하고 이 자동 연동은 만들지 않는다.
- 초기 MVP(Scout C~D)에서 위 컬럼은 존재하되 비어 있어도 된다. 사용자가 SAVE 시 수동 편집 가능하고, AI가 초안을 제안할 수도 있다.
- Scout에서는 Review와 달리 "이전 성공 여부(appealTransfer)"·"재구성 verdict(reconstruction)"를 계산하지 않는다. Scout의 대상은 이미 유통 중인 원본 콘텐츠지, 그것을 재활용한 draft가 아니기 때문이다.

---

## 5. NEW_PATTERN_CANDIDATE

A~M 어디에도 명확히 안 들어가지만 콘텐츠 자체가 흥미로우면 버리지 않는다.

- `scout_candidates.classification = "NEW_PATTERN_CANDIDATE"` 로 저장.
- AI가 함께 반환하는 부가정보:
  - `whyDifferent` — 기존 A~M과 다른 이유 한 줄
  - `structureSummary` — 핵심 구조 요약
  - `proposedName` — 임시 패턴명
  - `linguisticFeatures[]` — 검색에 사용할 수 있는 언어적 특징 (Gene Pool 자가 확장의 씨앗)
- `pattern_candidates` 테이블에 관찰 누적 (`occurrence_count`).
- **AI가 새 Hook Code를 자동 확정하지 않는다.** 승격 절차는 D-018 참조.

---

## 6. Novelty / Similarity

Scout 후보는 기존 `saved_references`와 비교한다. **단일 recommendation score를 초기부터 만들지 않는다** (D-013).

개별로 저장하는 값:

- `quality_score` — AI 1차 품질 평가
- `novelty_score` — 기존 저장분 대비 novelty
- `similarity_max` — 기존 저장분 중 최대 similarity
- `family_id` — 후보를 데려온 Search Family (참조용 캐시)
- `hook / classification` — 발견된 Hook (또는 NEW_PATTERN_CANDIDATE)

비교에 사용할 수 있는 축(가능한 만큼):
- 의미 유사성 · 스토리 구조 · Hook Code · 감정태도 · 화자 · 정보공개방식 · Search Family

기존과 매우 유사한 후보는 우선순위를 낮추고, 어느 정도 적합도가 있으면서 구조적으로 매우 다르면 Novelty 보너스. 정확한 가중치는 실 운영 데이터로 조정.

---

## 7. Semantic / Structural Clustering

서로 다른 검색어가 사실상 같은 유형의 글을 가져올 수 있다. 예: `별 기대 안했는데` · `생각보다 괜찮음` · `맛없을 줄 알았는데` — 전부 기대반전 구조.

### 파이프라인 순서

`Exact Dedup (permalink) → Semantic/Structural Clustering → Diversity Quota`.

### 초기 방식(MVP)

**Vector DB를 도입하지 않는다** (D-016). 아래 중 하나로 시작하고, 실 운영 데이터로 조정:

- (a) 단순 lexical 유사도(문자 n-gram Jaccard) + AI가 뽑은 짧은 "구조 키" 매칭
- (b) SAVE·후보를 batch로 AI에 넘겨 "같은 구조 후보끼리 묶기"

정확한 방식 확정은 Scout Phase D 시작 시.

### Cluster 상한

동일 `cluster_id`에서 최종 추천에 올라가는 후보 수는 상한을 둔다. 값은 설정값.

---

## 8. Diversity Quota

최종 추천을 AI 점수순으로만 정렬하지 않는다. 다음 각 축에 상한(설정값):

- 동일 Search Family 최대 N개
- 동일 Hook Code 최대 N개
- 동일 화자 최대 N개
- 동일 정보공개방식 최대 N개
- 동일 Cluster 최대 N개

N은 코드 하드코딩 금지. 설정값(env 또는 관리 UI)으로 관리 (D-017).

---

## 9. Exploit / Explore

최종 추천을 두 종류로 분리:

- **Exploit** — 우리가 아는 원칙상 높은 평가를 받은 안정적 후보.
- **Explore** — 기존과 구조적으로 멀거나 A~M에 명확히 안 들어가지만 콘텐츠가 흥미로운 후보.

초기 비율: **Exploit 70–80% / Explore 20–30%.** 값은 설정값 (D-017).

Explore 슬롯은 quality가 조금 낮아도 novelty가 높으면 선정될 수 있다.

---

## 10. Threads 수집

### 공식 API 우선

공식 Threads keyword search API를 유일한 자동 수집 경로로 사용한다. 저장 가능한 값(가능한 만큼):
- `text` · `permalink` · `username` · `posted_at`
- `seed_query_id` (실행에 사용한 Query)
- `search_mode` (`TOP` / `RECENT`)

### 값 조작 금지

공식 API가 주지 않는 값을 AI가 만들어내지 않는다 (D-011). 예: 조회수를 가져오지 못했는데 "바이럴 조회수 15만" 같은 값을 AI가 생성 → 금지.

### 원문 fallback

임의 URL 크롤링은 핵심 의존성으로 만들지 않는다. 사용자가 원하면 `scout_candidates.manual_body`에 원문을 직접 붙여넣는다.

---

## 11. Optional Public Engagement Verification (조회수)

### 목적

가능하면 실제 반응이 검증된 레퍼런스를 우선 SAVE하고 싶다. 그래서 "조회수 1만 이상" 필터를 제공하고 싶다. 그러나 공식 keyword search에서 타인의 view count가 직접 제공되지 않을 수 있으므로 **핵심 의존성으로 만들지 않는다** (D-019).

### 저장 필드

- `views: integer | null`
- `viewSource ∈ "PUBLIC_UI" | "MANUAL" | "UNAVAILABLE"`
- `viewCheckedAt: timestamptz | null`

값이 없으면 `views: null, viewSource: "UNAVAILABLE"`. **후보를 삭제하지 않는다.**

### 안전 규칙 (절대 준수, D-019)

- **로그인 우회 금지 · CAPTCHA 우회 금지 · Rate Limit 우회 금지 · 접근 제한 우회 금지.**
- 공개 상태에서 로그인 없이 확인 가능한 데이터만 사용.
- 이 모듈이 고장나도 Scout의 검색·분석·저장은 정상 동작.

### 최소 조회수 필터

설정값. 예: `제한 없음 | 1,000+ | 10,000+ | 100,000+`.

### 비용 최적화 (§21)

Raw Candidate 전부의 URL을 방문하지 않는다. Pipeline:

```
Threads 검색 후보 3,000개
  → Exact Dedup
  → 저품질/무관 후보 제거
  → AI 1차 구조 평가
  → 상위 200~300개만 공개 조회수 Verification
  → 필요하면 10,000+ 필터
  → Novelty
  → Diversity
  → 최종 20개
```

정확한 개수는 실운영 데이터로 조정.

---

## 12. 전체 Pipeline

```
Search Gene Pool
      ↓
오늘 사용할 Query Sampling
      ↓
Threads API (TOP / RECENT 검색)
      ↓
Raw Candidate
      ↓
Exact Dedup (permalink)
      ↓
기본 품질 필터
      ↓
AI Classification (Hook/감정/화자/공개방식 / NEW_PATTERN_CANDIDATE)
      ↓
Semantic / Structural Clustering
      ↓
필요한 후보만 Optional Engagement Verification
      ↓
기존 저장 레퍼런스와 Similarity / Novelty 비교
      ↓
Diversity Quota
      ↓
Exploit + Explore 슬롯 배분
      ↓
오늘의 최종 추천
      ↓
사용자: SAVE / REJECT
      ↓
Feedback 저장 → New Query Candidate / NEW_PATTERN_CANDIDATE 생성
```

---

## 13. Scout Phase 계획 (요약)

세부 통과 기준은 `docs/ACCEPTANCE_TESTS.md` 후반부.

- **Phase A** — Search Family + Seed Query 관리, 수동 검색 실행, Threads API 결과 화면 표시 (저장 없음)
- **Phase B** — SAVE/REJECT + Supabase + Exact Dedup
- **Phase C** — AI 분류 + 기존 레퍼런스 대비 Novelty
- **Phase D** — Semantic Clustering + Diversity Quota + Explore 슬롯
- **Phase E** — 신규 Query Candidate 제안 + NEW_PATTERN_CANDIDATE 승격 절차 + Query Performance
- **Phase F** — Optional Public Engagement Verification (조회수 필터)
- **Phase G** — Cron 자동 수집 (모든 수동 과정이 안정된 이후에만)

각 Phase 완료 후 사용자 명시 승인 없이 다음 Phase로 진행하지 않는다.

---

## 14. Scout에서 만들지 않는 것 (MVP 오버엔지니어링 금지)

- Vector DB (Pinecone, Weaviate, pgvector)
- 대규모 Queue / Microservice
- OAuth
- 자동 ML 추천 시스템 · 초기부터 복잡한 단일 recommendation 공식(D-013)
- 무리한 크롤링 · 로그인/CAPTCHA/Rate Limit/접근 제한 우회
- 초기부터 자동 Query 최적화 알고리즘 (데이터 축적만)

필요가 실제로 확인되면 그때 추가.
