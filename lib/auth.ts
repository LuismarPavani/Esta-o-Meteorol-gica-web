import { SignJWT, jwtVerify } from 'jose';

export const COOKIE = 'session';
const secret = () => new TextEncoder().encode(process.env.AUTH_SECRET!);

export async function createSession(uid: string) {
  return new SignJWT({ uid }).setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d').sign(secret());
}

export async function verifySession(token?: string): Promise<{ uid: string } | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return typeof payload.uid === 'string' ? { uid: payload.uid } : null;
  } catch { return null; }
}
