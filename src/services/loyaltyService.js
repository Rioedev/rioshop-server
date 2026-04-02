const LOYALTY_TIERS = ["bronze", "silver", "gold", "platinum"];

const DEFAULT_TIER_THRESHOLDS = {
  bronze: 0,
  silver: 1000,
  gold: 5000,
  platinum: 15000,
};

const DEFAULT_POINTS_RULE = {
  amountStep: 1000,
  pointsPerStep: 1,
};

const toSafeInt = (value, fallback = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return Math.max(0, Math.floor(Number(fallback) || 0));
  }
  return Math.max(0, Math.floor(parsed));
};

const clampPercent = (value) => Math.min(100, Math.max(0, Number(value || 0)));

export class LoyaltyService {
  getTierThresholds() {
    const bronze = 0;
    const silver = toSafeInt(
      process.env.LOYALTY_TIER_SILVER_MIN,
      DEFAULT_TIER_THRESHOLDS.silver,
    );
    const gold = Math.max(
      silver,
      toSafeInt(process.env.LOYALTY_TIER_GOLD_MIN, DEFAULT_TIER_THRESHOLDS.gold),
    );
    const platinum = Math.max(
      gold,
      toSafeInt(process.env.LOYALTY_TIER_PLATINUM_MIN, DEFAULT_TIER_THRESHOLDS.platinum),
    );

    return {
      bronze,
      silver,
      gold,
      platinum,
    };
  }

  getPointsRule() {
    const amountStep = Math.max(
      1,
      toSafeInt(process.env.LOYALTY_POINTS_STEP_AMOUNT, DEFAULT_POINTS_RULE.amountStep),
    );
    const pointsPerStep = Math.max(
      1,
      toSafeInt(process.env.LOYALTY_POINTS_PER_STEP, DEFAULT_POINTS_RULE.pointsPerStep),
    );

    return {
      amountStep,
      pointsPerStep,
    };
  }

  resolveTierByLifetimePoints(lifetimePoints = 0) {
    const safeLifetimePoints = toSafeInt(lifetimePoints, 0);
    const thresholds = this.getTierThresholds();

    if (safeLifetimePoints >= thresholds.platinum) {
      return "platinum";
    }
    if (safeLifetimePoints >= thresholds.gold) {
      return "gold";
    }
    if (safeLifetimePoints >= thresholds.silver) {
      return "silver";
    }
    return "bronze";
  }

  getNextTier(currentTier = "bronze") {
    const currentIndex = LOYALTY_TIERS.indexOf((currentTier || "").toString().trim().toLowerCase());
    if (currentIndex < 0 || currentIndex >= LOYALTY_TIERS.length - 1) {
      return null;
    }
    return LOYALTY_TIERS[currentIndex + 1];
  }

  buildTierProgress(currentTier = "bronze", lifetimePoints = 0) {
    const safeLifetimePoints = toSafeInt(lifetimePoints, 0);
    const thresholds = this.getTierThresholds();
    const normalizedTier = this.resolveTierByLifetimePoints(safeLifetimePoints);
    const nextTier = this.getNextTier(normalizedTier);
    const currentTierMinPoints = thresholds[normalizedTier] || 0;
    const nextTierMinPoints = nextTier ? thresholds[nextTier] || 0 : null;

    if (!nextTier || nextTierMinPoints === null) {
      return {
        currentTier: normalizedTier,
        currentTierMinPoints,
        nextTier: null,
        nextTierMinPoints: null,
        pointsToNextTier: 0,
        progressToNextTier: 100,
      };
    }

    const pointsToNextTier = Math.max(0, nextTierMinPoints - safeLifetimePoints);
    const denominator = Math.max(1, nextTierMinPoints - currentTierMinPoints);
    const numerator = Math.max(0, safeLifetimePoints - currentTierMinPoints);
    const progressToNextTier = clampPercent(Math.round((numerator / denominator) * 100));

    return {
      currentTier: normalizedTier,
      currentTierMinPoints,
      nextTier,
      nextTierMinPoints,
      pointsToNextTier,
      progressToNextTier,
    };
  }

  calculateEarnPoints(amount = 0) {
    const safeAmount = Math.max(0, Number(amount || 0));
    const rule = this.getPointsRule();
    if (safeAmount <= 0) {
      return 0;
    }

    return Math.max(0, Math.floor(safeAmount / rule.amountStep) * rule.pointsPerStep);
  }

  buildLoyaltySnapshot(loyalty = {}) {
    const points = toSafeInt(loyalty?.points || 0, 0);
    const lifetimePoints = toSafeInt(loyalty?.lifetimePoints || 0, 0);
    const tier = this.resolveTierByLifetimePoints(lifetimePoints);
    const progress = this.buildTierProgress(tier, lifetimePoints);

    return {
      tier,
      points,
      lifetimePoints,
      tierExpiresAt: loyalty?.tierExpiresAt || null,
      pointsHistory: Array.isArray(loyalty?.pointsHistory) ? loyalty.pointsHistory : [],
      summary: progress,
    };
  }
}

export default new LoyaltyService();
