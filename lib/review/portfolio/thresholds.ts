// Portfolio 경고 임계값 — 한 곳에서 관리 (DATA_CONTRACT §3.2 "초기 임계").
// 실운영 데이터로 조정될 수 있는 튜닝 값이며, 여기 값만 바꾸면 전체 경고 로직에 반영된다.
export const PORTFOLIO_THRESHOLDS = {
  OVERUSE: 0.4,
  MISMATCH_HEAVY: 0.3,
  SEARCH_WEAK_HEAVY: 0.35,
  FORMAT_VS_SEARCH_MAX_CATEGORY_RATIO: 0.4,
  FORMAT_VS_SEARCH_SEARCH_WEAK_MIN: 0.3,
  RECONSTRUCTION_TOO_CLOSE_HEAVY: 0.35,
  SURFACE_CLONE_HEAVY: 0.15,
  AXIS_WEAK: 0.5,
} as const;
