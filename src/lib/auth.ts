import { SignJWT, jwtVerify } from 'jose';

const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
const ALG = 'HS256';

export async function signToken(payload: {
  userId: string;
  email: string;
}): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret);
}

export async function verifyToken(
  token: string
): Promise<{ userId: string; email: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as { userId: string; email: string };
  } catch {
    return null;
  }
}
