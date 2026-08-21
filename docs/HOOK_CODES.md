# HOOK_CODES.md — Hook Code A~M 정의 (확정)

이 문서에 있는 정의는 **확정판**이며, `docs/DATA_CONTRACT.md`의 `diagnostic.hookCode` enum과 정확히 일치한다.
정의를 바꾸려면 `promptVersion`을 반드시 올린다.

## 중요 — 이 체계의 위상

- **A~M은 "현재까지 발견된 분류"**일 뿐, 세상의 모든 바이럴 콘텐츠가 A~M에 속한다고 가정하지 않는다.
- 어떤 콘텐츠가 A~M 어디에도 명확히 들어가지 않지만 흥미로우면 **버리지 않는다.**
  - Review 분석에서는 `hookCode = "NEW_PATTERN_CANDIDATE"` 로 반환.
  - Scout 파이프라인에서는 `classification = "NEW_PATTERN_CANDIDATE"` 로 저장.
- `NEW_PATTERN_CANDIDATE`는 **사용자가 승인해야만** 새 Hook Code로 승격될 수 있다. AI가 임의로 A~M을 확장하지 않는다.

## Enum (Review `hookCode` 반환 가능 값)

```
A | B | C | D | E | F | G | H | I | J | K | L | M | NEW_PATTERN_CANDIDATE
```

`OTHER`는 이 축에서는 사용하지 않는다. A~M에 명확히 속하지 않으면 반드시 `NEW_PATTERN_CANDIDATE`.

## `NEW_PATTERN_CANDIDATE` 반환 시 추가 필드 (Review)

AI가 `hookCode = "NEW_PATTERN_CANDIDATE"`를 반환할 때는 다음을 함께 제안한다 (`DATA_CONTRACT.md §2.2` 참조):

- `whyDifferent` — 기존 A~M과 어떻게 다른지 한 문장
- `structureSummary` — 콘텐츠의 핵심 구조 요약(짧게)
- `proposedName` — 임시 패턴명(사용자가 최종 확정 전까지의 라벨)
- `linguisticFeatures[]` — 검색에 사용할 수 있는 언어적 특징(짧은 구절 목록)

## 정의

| 코드 | 이름 | 정의 |
|---|---|---|
| **A** | 직접 추천형 | 화자가 겪음 → 발견 → 추천 |
| **B** | 위장된 자랑/반전 | 손해·실연·실패 등 부정적 사건 속에서 다른 만족을 발견 |
| **C** | 장애물 나열형 | 여러 실패 시도 → 마지막 해결 |
| **D** | 안티추천 뒤집기 | 다른 것들을 불신/비추천 → 하나만 예외 인정 |
| **E** | 장르클리셰 반전 | 태몽·사주·타로 등 반전 구조 장르 활용 |
| **F** | 순수 리스트형 | 행동·아이템 나열, 결과 또는 숫자 훅 |
| **G** | 발견형 | 강한 결핍 서사 없이 우연한 발견/신상/감탄 |
| **H** | 권위+허무개그 | 전문가·권위 → "이렇게 간단한 걸 왜 몰랐지" 식 허무 낙차 |
| **I** | 부담-면제리스트 | 과도한 기준/해야 할 것들 나열 → 최소 솔루션으로 부담 면제 |
| **J** | 선언문형 명령 리스트 | 강한 선언·훈계 → 균질한 행동 리스트 |
| **K** | 상황별 제품 매칭 리스트 | 여러 상황·고민에 각기 다른 솔루션 매칭 |
| **L** | 시크한 관찰자형 | 절박한 경험담이 아니라 무심·시크하게 관찰·훈수 |
| **M** | 나이듦 수용/철듦형 | 예전엔 이해 못했지만 나이 들며 이해하게 된 성숙 서사 |

## 새 Hook Code 승격 절차 (참고)

1. Review 또는 Scout에서 `NEW_PATTERN_CANDIDATE`가 여러 번 관찰됨.
2. 사용자가 그중 하나의 `proposedName`·구조를 확정 승인.
3. 이 문서에 새 코드 항목을 추가.
4. `DATA_CONTRACT.md`의 `hookCode` enum 갱신.
5. `promptVersion` 상승 (예: `v1` → `v2`).
6. 기존 캐시 자연 무효화.
