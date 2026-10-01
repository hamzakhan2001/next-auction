import { NextRequest } from 'next/server';
import dbConnect from '@/lib/db';
import Auction from '@/models/Auction';
import Bid from '@/models/Bid';
import { verifyAuth } from '@/lib/authGuard';
import {
  successResponse,
  errorResponse,
  handleValidationError,
} from '@/lib/apiResponse';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ auctionId: string }> }
) {
  try {
    await dbConnect();
    const { auctionId } = await params;

    const bids = await Bid.find({ auction: auctionId })
      .populate('bidder', 'name')
      .sort({ createdAt: -1 });

    return successResponse(bids);
  } catch (error) {
    return handleValidationError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ auctionId: string }> }
) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    await dbConnect();
    const { auctionId } = await params;
    const { amount } = await request.json();

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return errorResponse('Valid bid amount is required', 400);
    }

    const auction = await Auction.findById(auctionId);
    if (!auction) {
      return errorResponse('Auction not found', 404);
    }

    // On-demand status update
    const now = new Date();
    if (auction.status === 'pending' && auction.startTime <= now) {
      auction.status = 'active';
    }
    if (auction.status === 'active' && auction.endTime <= now) {
      auction.status = 'ended';
      auction.winner = auction.currentBidder;
      await auction.save();
      return errorResponse('Auction has ended', 400);
    }

    if (auction.status !== 'active') {
      return errorResponse(
        `Auction is ${auction.status}, not accepting bids`,
        400
      );
    }

    // Seller cannot bid on own auction
    if (auction.seller.toString() === user._id.toString()) {
      return errorResponse('You cannot bid on your own auction', 400);
    }

    // Bid must be higher than current highest
    if (amount <= auction.currentBid) {
      return errorResponse(
        `Bid must be higher than current bid of $${auction.currentBid.toFixed(2)}`,
        400
      );
    }

    // Atomic update to prevent race conditions
    const updated = await Auction.findOneAndUpdate(
      {
        _id: auctionId,
        status: 'active',
        currentBid: { $lt: amount },
      },
      {
        currentBid: amount,
        currentBidder: user._id,
      },
      { new: true }
    );

    if (!updated) {
      return errorResponse(
        'Bid was outbid by another user. Try again with a higher amount.',
        409
      );
    }

    const bid = await Bid.create({
      auction: auctionId,
      bidder: user._id,
      amount,
    });

    // Socket.io emit (will work once server.ts sets globalThis.io)
    const io = (globalThis as any).io;
    if (io) {
      const populatedBid = await bid.populate('bidder', 'name');
      io.to(`auction:${auctionId}`).emit('bid:placed', {
        auctionId,
        bid: {
          _id: bid._id.toString(),
          amount: bid.amount,
          bidder: populatedBid.bidder,
          createdAt: bid.createdAt.toISOString(),
        },
        currentBid: updated.currentBid,
      });
    }

    return successResponse(bid, 201);
  } catch (error) {
    return handleValidationError(error);
  }
}
