import { NextRequest } from 'next/server';
import dbConnect from '@/lib/db';
import { verifyAuth } from '@/lib/authGuard';
import {
  setAutoBid,
  getAutoBid,
  cancelAutoBid,
} from '@/lib/autoBid';
import {
  successResponse,
  errorResponse,
  handleValidationError,
} from '@/lib/apiResponse';

type RouteContext = { params: Promise<{ auctionId: string }> };

// Get the current user's auto-bid on this auction (null if none)
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const user = await verifyAuth(request);
    if (!user) return errorResponse('Unauthorized', 401);

    await dbConnect();
    const { auctionId } = await params;

    const autoBid = await getAutoBid(user._id, auctionId);
    return successResponse(autoBid);
  } catch (error) {
    return handleValidationError(error);
  }
}

// Create or replace the current user's auto-bid on this auction
async function upsert(request: NextRequest, { params }: RouteContext) {
  try {
    const user = await verifyAuth(request);
    if (!user) return errorResponse('Unauthorized', 401);

    await dbConnect();
    const { auctionId } = await params;
    const body = await request.json();

    const result = await setAutoBid(user._id, auctionId, {
      maxAmount: body.maxAmount,
      incrementType: body.incrementType,
      incrementValue: body.incrementValue,
      maxBidCount: body.maxBidCount,
    });
    if (!result.ok) return errorResponse(result.error, result.status);

    return successResponse(result.data, 201);
  } catch (error) {
    return handleValidationError(error);
  }
}

export const POST = upsert;
export const PUT = upsert;

// Cancel the current user's auto-bid on this auction
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const user = await verifyAuth(request);
    if (!user) return errorResponse('Unauthorized', 401);

    await dbConnect();
    const { auctionId } = await params;

    const cancelled = await cancelAutoBid(user._id, auctionId);
    if (!cancelled) return errorResponse('No active auto-bid found', 404);

    return successResponse({ cancelled: true });
  } catch (error) {
    return handleValidationError(error);
  }
}
