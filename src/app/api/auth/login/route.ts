import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import dbConnect from '@/lib/db';
import User from '@/models/User';
import { signToken } from '@/lib/auth';
import { errorResponse } from '@/lib/apiResponse';

export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    const { email, password } = await request.json();

    if (!email || !password) {
      return errorResponse('Email and password are required', 400);
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select(
      '+password'
    );
    if (!user) {
      return errorResponse('Invalid credentials', 401);
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return errorResponse('Invalid credentials', 401);
    }

    const token = await signToken({
      userId: user._id.toString(),
      email: user.email,
    });

    const response = NextResponse.json(
      {
        success: true,
        data: { _id: user._id, name: user.name, email: user.email },
      },
      { status: 200 }
    );

    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Internal server error';
    return errorResponse(message, 500);
  }
}
