import { NextRequest } from 'next/server';
import { verifyToken } from './auth';
import dbConnect from './db';
import User, { IUser } from '@/models/User';

export async function verifyAuth(request: NextRequest): Promise<IUser | null> {
  const token = request.cookies.get('token')?.value;
  if (!token) return null;

  const decoded = await verifyToken(token);
  if (!decoded) return null;

  await dbConnect();
  const user = await User.findById(decoded.userId);
  return user;
}
