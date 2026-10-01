import { Types } from 'mongoose';
import Auction, { IAuction } from '@/models/Auction';
import Bid, { IBid } from '@/models/Bid';

// server.ts exposes the Socket.io server on globalThis (see server.ts)
type RoomEmitter = {
  to: (room: string) => { emit: (event: string, payload: unknown) => void };
};

interface CommitBidParams {
  auctionId: string;
  bidderId: Types.ObjectId | string;
  amount: number;
  isAutoBid?: boolean;
  /**
   * Auto-bids pass the exact auction state they computed their counter-bid
   * from. The write only succeeds if that state is still current, so two
   * processors reacting to the same bid can never both place a response.
   * Manual bids omit this and only require `amount > currentBid`.
   */
  expected?: {
    currentBid: number;
    currentBidder: Types.ObjectId | string | null;
  };
}

/**
 * The single atomic write path for placing a bid (manual and automatic).
 * Returns null when the compare-and-set loses (auction moved on, ended, or
 * the amount is no longer high enough). Emits `bid:placed` on success.
 */
export async function commitBid({
  auctionId,
  bidderId,
  amount,
  isAutoBid = false,
  expected,
}: CommitBidParams): Promise<{ bid: IBid; auction: IAuction } | null> {
  const filter: Record<string, unknown> = {
    _id: auctionId,
    status: 'active',
    endTime: { $gt: new Date() },
  };
  if (expected) {
    filter.currentBid = expected.currentBid;
    filter.currentBidder = expected.currentBidder;
  } else {
    filter.currentBid = { $lt: amount };
  }

  const updated = await Auction.findOneAndUpdate(
    filter,
    { currentBid: amount, currentBidder: bidderId },
    { new: true }
  );
  if (!updated) return null;

  const bid = await Bid.create({
    auction: auctionId,
    bidder: bidderId,
    amount,
    isAutoBid,
  });

  const io = (globalThis as { io?: RoomEmitter }).io;
  if (io) {
    const populatedBid = await bid.populate('bidder', 'name');
    io.to(`auction:${auctionId}`).emit('bid:placed', {
      auctionId,
      bid: {
        _id: bid._id.toString(),
        amount: bid.amount,
        bidder: populatedBid.bidder,
        isAutoBid: bid.isAutoBid,
        createdAt: bid.createdAt.toISOString(),
      },
      currentBid: updated.currentBid,
    });
  }

  return { bid, auction: updated };
}
