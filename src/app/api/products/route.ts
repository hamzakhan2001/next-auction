import { NextRequest } from 'next/server';
import dbConnect from '@/lib/db';
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
    const owner = searchParams.get('owner');

    const filter = owner ? { owner } : {};
    const products = await Product.find(filter)
      .populate('owner', 'name email')
      .sort({ createdAt: -1 });

    return successResponse(products);
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
    const body = await request.json();

    const product = await Product.create({
      ...body,
      owner: user._id,
    });

    return successResponse(product, 201);
  } catch (error) {
    return handleValidationError(error);
  }
}
