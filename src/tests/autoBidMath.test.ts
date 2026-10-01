import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateCounterBid } from '../src/lib/autoBidMath';

const fixed = (incrementValue: number, maxAmount: number) => ({
  incrementType: 'fixed' as const,
  incrementValue,
  maxAmount,
});
const pct = (incrementValue: number, maxAmount: number) => ({
  incrementType: 'percentage' as const,
  incrementValue,
  maxAmount,
});

test('fixed increment adds the dollar amount', () => {
  assert.equal(calculateCounterBid(fixed(100, 3000), 2600), 2700);
  assert.equal(calculateCounterBid(fixed(100, 3000), 2800), 2900);
});

test('percentage increment matches the spec examples', () => {
  assert.equal(calculateCounterBid(pct(5, 5000), 4100), 4305);
  assert.equal(calculateCounterBid(pct(5, 5000), 4400), 4620);
});

test('counter-bid is clamped to maxAmount rather than skipped', () => {
  assert.equal(calculateCounterBid(fixed(100, 3000), 2950), 3000);
  assert.equal(calculateCounterBid(pct(50, 3000), 2900), 3000);
});

test('returns null when the cap cannot beat the current bid', () => {
  assert.equal(calculateCounterBid(fixed(100, 3000), 3000), null);
  assert.equal(calculateCounterBid(fixed(100, 3000), 3100), null);
});

test('always outbids by at least one cent', () => {
  assert.equal(calculateCounterBid(pct(0.01, 1000), 100), 100.01);
});

test('rounds to cents without float artifacts', () => {
  assert.equal(calculateCounterBid(pct(5, 9999), 4400), 4620);
  assert.equal(calculateCounterBid(pct(3, 9999), 99.99), 102.99);
});
