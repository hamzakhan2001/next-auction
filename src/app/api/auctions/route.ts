import { NextRequest } from 'next/server';
import dbConnect from '@/lib/db';
import Auction from '@/models/Auction';
import Product from '@/models/Product';
import { verifyAuth } from '@/lib/authGuard';
import {
  successResponse,
  errorResponse,
  handleValidationError,
} from '@/lib/apiResponse';

export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const seller = searchParams.get('seller');

    const filter: Record<string, string> = {};
    if (status) filter.status = status;
    if (seller) filter.seller = seller;

    const auctions = await Auction.find(filter)
      .populate('product', 'title imageUrl startingPrice')
      .populate('seller', 'name')
      .populate('currentBidder', 'name')
      .populate('winner', 'name')
      .sort({ createdAt: -1 });

    return successResponse(auctions);
  } catch (error) {
    return handleValidationError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    await dbConnect();
    const { productId, startTime, endTime } = await request.json();

    if (!productId || !startTime || !endTime) {
      return errorResponse('Product ID, start time, and end time are required', 400);
    }

    const product = await Product.findById(productId);
    if (!product) {
      return errorResponse('Product not found', 404);
    }

    if (product.owner.toString() !== user._id.toString()) {
      return errorResponse('You can only create auctions for your own products', 403);
    }

    if (product.hasAuction) {
      return errorResponse('This product already has an auction', 400);
    }

    const auction = await Auction.create({
      product: productId,
      seller: user._id,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      currentBid: product.startingPrice,
      status: 'pending',
    });

    product.hasAuction = true;
    await product.save();

    return successResponse(auction, 201);
  } catch (error) {
    return handleValidationError(error);
  }
}
