import { Types } from 'mongoose';
import Auction from '@/models/Auction';
import AutoBid, { IAutoBid, AutoBidIncrementType } from '@/models/AutoBid';
import { commitBid } from '@/lib/bidding';
import { calculateCounterBid, round2 } from '@/lib/autoBidMath';

/**
 * Upper bound on loop iterations (placed bids + lost races) for a single
 * trigger. Stops runaway bidding wars, e.g. two auto-bids with huge caps and
 * tiny increments. A later manual bid simply triggers processing again.
 */
export const MAX_AUTO_BID_ITERATIONS = 50;

export interface AutoBidInput {
  maxAmount: unknown;
  incrementType: unknown;
  incrementValue: unknown;
  maxBidCount?: unknown;
}

type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number };

const fail = (error: string, status = 400) => ({
  ok: false as const,
  error,
  status,
});

// ---------------------------------------------------------------------------
// Configuration (create / read / cancel)
// ---------------------------------------------------------------------------

export async function setAutoBid(
  userId: Types.ObjectId | string,
  auctionId: string,
  input: AutoBidInput
): Promise<ServiceResult<IAutoBid>> {
  const { maxAmount, incrementType, incrementValue, maxBidCount } = input;

  if (typeof maxAmount !== 'number' || !Number.isFinite(maxAmount) || maxAmount <= 0) {
    return fail('A valid maximum amount is required');
  }
  if (incrementType !== 'fixed' && incrementType !== 'percentage') {
    return fail('Increment type must be "fixed" or "percentage"');
  }
  if (
    typeof incrementValue !== 'number' ||
    !Number.isFinite(incrementValue) ||
    incrementValue <= 0
  ) {
    return fail('Increment value must be a positive number');
  }
  if (incrementType === 'percentage' && incrementValue > 100) {
    return fail('Percentage increment cannot exceed 100');
  }
  let bidCountLimit: number | null = null;
  if (maxBidCount !== undefined && maxBidCount !== null && maxBidCount !== '') {
    if (
      typeof maxBidCount !== 'number' ||
      !Number.isInteger(maxBidCount) ||
      maxBidCount < 1
    ) {
      return fail('Maximum bid count must be a whole number of at least 1');
    }
    bidCountLimit = maxBidCount;
  }

  const auction = await Auction.findById(auctionId);
  if (!auction) return fail('Auction not found', 404);

  if (auction.status !== 'active' || auction.endTime <= new Date()) {
    return fail('Auto-bid can only be set on an active auction');
  }
  if (auction.seller.toString() === userId.toString()) {
    return fail('You cannot set an auto-bid on your own auction');
  }

  const cap = round2(maxAmount);
  if (cap <= auction.currentBid) {
    return fail(
      `Maximum amount must be higher than the current bid of $${auction.currentBid.toFixed(2)}`
    );
  }

  const update = {
    maxAmount: cap,
    incrementType: incrementType as AutoBidIncrementType,
    incrementValue,
    maxBidCount: bidCountLimit,
    bidsUsed: 0,
    lastBidAmount: null,
    status: 'active' as const,
  };
  const options = {
    new: true,
    upsert: true,
    setDefaultsOnInsert: true,
    runValidators: true,
  };
  const filter = { auction: auctionId, bidder: userId };

  let autoBid: IAutoBid | null;
  try {
    autoBid = await AutoBid.findOneAndUpdate(filter, update, options);
  } catch (err) {
    // Two concurrent upserts can race on the unique index; the second attempt
    // then updates the existing document.
    if ((err as { code?: number })?.code !== 11000) throw err;
    autoBid = await AutoBid.findOneAndUpdate(filter, update, options);
  }
  return { ok: true, data: autoBid! };
}

/** The user's auto-bid on this auction (active or exhausted), else null. */
export async function getAutoBid(
  userId: Types.ObjectId | string,
  auctionId: string
): Promise<IAutoBid | null> {
  return AutoBid.findOne({
    auction: auctionId,
    bidder: userId,
    status: { $in: ['active', 'exhausted'] },
  });
}

export async function cancelAutoBid(
  userId: Types.ObjectId | string,
  auctionId: string
): Promise<boolean> {
  const cancelled = await AutoBid.findOneAndUpdate(
    {
      auction: auctionId,
      bidder: userId,
      status: { $in: ['active', 'exhausted'] },
    },
    { status: 'cancelled' },
    { new: true }
  );
  return !!cancelled;
}

/** Called whenever an auction ends: all of its active auto-bids are cancelled. */
export async function deactivateAutoBidsForAuction(
  auctionId: string | Types.ObjectId
): Promise<void> {
  await AutoBid.updateMany(
    { auction: auctionId, status: 'active' },
    { status: 'cancelled' }
  );
}

// ---------------------------------------------------------------------------
// Trigger engine
// ---------------------------------------------------------------------------

async function markExhausted(autoBidId: Types.ObjectId) {
  await AutoBid.updateOne(
    { _id: autoBidId, status: 'active' },
    { status: 'exhausted' }
  );
}

async function recordAutoBidUse(autoBidId: Types.ObjectId, amount: number) {
  const updated = await AutoBid.findOneAndUpdate(
    { _id: autoBidId, status: 'active' },
    { $inc: { bidsUsed: 1 }, $set: { lastBidAmount: amount } },
    { new: true }
  );
  if (!updated) return; // cancelled while the bid was in flight

  const capReached = amount >= updated.maxAmount;
  const countUsedUp =
    updated.maxBidCount != null && updated.bidsUsed >= updated.maxBidCount;
  if (capReached || countUsedUp) await markExhausted(updated._id);
}

/**
 * Reacts to a bid on `auctionId`: lets the highest-cap eligible auto-bid
 * counter the current leader, then repeats (a bidding war between competing
 * auto-bids) until nobody can or should bid, or the safety limit is hit.
 *
 * Each iteration re-reads the auction and acts on *current* state, never on
 * the bid that happened to wake us up, and commits with a compare-and-set on
 * that exact state. Concurrent triggers therefore can't both respond to the
 * same bid: the loser's write fails, it re-reads, sees an auto-bid already
 * leading, and stops.
 *
 * The leader is never eligible, which is what prevents self-triggering.
 */
export async function processAutoBids(
  auctionId: string
): Promise<{ placed: number; hitSafetyLimit: boolean }> {
  let placed = 0;

  for (let i = 0; i < MAX_AUTO_BID_ITERATIONS; i++) {
    const auction = await Auction.findById(auctionId);
    if (!auction || auction.status !== 'active' || auction.endTime <= new Date()) {
      return { placed, hitSafetyLimit: false };
    }

    const candidates = await AutoBid.find({
      auction: auctionId,
      status: 'active',
      bidder: { $ne: auction.currentBidder },
    }).sort({ maxAmount: -1, createdAt: 1 });

    let acted = false;
    for (const autoBid of candidates) {
      const countUsedUp =
        autoBid.maxBidCount != null && autoBid.bidsUsed >= autoBid.maxBidCount;
      const amount = countUsedUp
        ? null
        : calculateCounterBid(autoBid, auction.currentBid);

      if (amount === null) {
        await markExhausted(autoBid._id);
        continue; // try the next-highest cap
      }

      const result = await commitBid({
        auctionId,
        bidderId: autoBid.bidder,
        amount,
        isAutoBid: true,
        expected: {
          currentBid: auction.currentBid,
          currentBidder: auction.currentBidder,
        },
      });
      acted = true; // placed, or lost a race: either way re-read the state
      if (result) {
        placed++;
        await recordAutoBidUse(autoBid._id, amount);
      }
      break;
    }

    if (!acted) return { placed, hitSafetyLimit: false };
  }

  console.warn(
    `> Auto-bid safety limit (${MAX_AUTO_BID_ITERATIONS}) reached on auction ${auctionId}`
  );
  return { placed, hitSafetyLimit: true };
}
