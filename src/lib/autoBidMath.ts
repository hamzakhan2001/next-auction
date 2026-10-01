import type { AutoBidIncrementType } from '@/models/AutoBid';

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

interface CounterBidConfig {
  incrementType: AutoBidIncrementType;
  incrementValue: number;
  maxAmount: number;
}

/**
 * Computes the amount an auto-bid should place against `currentBid`.
 *
 * - fixed:      currentBid + incrementValue
 * - percentage: currentBid * (1 + incrementValue / 100)
 * - always at least one cent above currentBid
 * - clamped to maxAmount (we bid exactly the cap rather than skipping)
 *
 * Returns null when even the cap can't beat currentBid (auto-bid is exhausted).
 */
export function calculateCounterBid(
  config: CounterBidConfig,
  currentBid: number
): number | null {
  const raw =
    config.incrementType === 'fixed'
      ? currentBid + config.incrementValue
      : currentBid * (1 + config.incrementValue / 100);

  let next = Math.max(round2(raw), round2(currentBid + 0.01));
  if (next > config.maxAmount) next = config.maxAmount;
  next = round2(next);

  return next > currentBid ? next : null;
}
