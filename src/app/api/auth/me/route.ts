import { NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/authGuard';
import { successResponse, errorResponse } from '@/lib/apiResponse';

export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return errorResponse('Not authenticated', 401);
    }

    return successResponse({
      _id: user._id,
      name: user.name,
      email: user.email,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Internal server error';
    return errorResponse(message, 500);
  }
}
