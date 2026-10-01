import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import dbConnect from '@/lib/db';
import User from '@/models/User';
import { signToken } from '@/lib/auth';
import { errorResponse, handleValidationError } from '@/lib/apiResponse';

export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    const { name, email, password } = await request.json();

    if (!name || !email || !password) {
      return errorResponse('Name, email, and password are required', 400);
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return errorResponse('Email already registered', 409);
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
    });

    const token = await signToken({
      userId: user._id.toString(),
      email: user.email,
    });

    const response = NextResponse.json(
      {
        success: true,
        data: { _id: user._id, name: user.name, email: user.email },
      },
      { status: 201 }
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
    return handleValidationError(error);
  }
}
