import { NextRequest } from 'next/server';
import dbConnect from '@/lib/db';
import Product from '@/models/Product';
import { verifyAuth } from '@/lib/authGuard';
import {
  successResponse,
  errorResponse,
  handleValidationError,
} from '@/lib/apiResponse';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    await dbConnect();
    const { productId } = await params;
    const product = await Product.findById(productId).populate(
      'owner',
      'name email'
    );

    if (!product) {
      return errorResponse('Product not found', 404);
    }

    return successResponse(product);
  } catch (error) {
    return handleValidationError(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    await dbConnect();
    const { productId } = await params;
    const product = await Product.findById(productId);

    if (!product) {
      return errorResponse('Product not found', 404);
    }

    if (product.owner.toString() !== user._id.toString()) {
      return errorResponse('Not authorized to update this product', 403);
    }

    if (product.hasAuction) {
      return errorResponse('Cannot edit product with an active auction', 400);
    }

    const body = await request.json();
    const updated = await Product.findByIdAndUpdate(
      productId,
      { title: body.title, description: body.description, imageUrl: body.imageUrl, startingPrice: body.startingPrice },
      { new: true, runValidators: true }
    );

    return successResponse(updated);
  } catch (error) {
    return handleValidationError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    await dbConnect();
    const { productId } = await params;
    const product = await Product.findById(productId);

    if (!product) {
      return errorResponse('Product not found', 404);
    }

    if (product.owner.toString() !== user._id.toString()) {
      return errorResponse('Not authorized to delete this product', 403);
    }

    if (product.hasAuction) {
      return errorResponse('Cannot delete product with an auction', 400);
    }

    await Product.findByIdAndDelete(productId);
    return successResponse({ message: 'Product deleted' });
  } catch (error) {
    return handleValidationError(error);
  }
}
