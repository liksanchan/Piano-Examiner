import { SignJWT, jwtVerify } from "jose";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users, type User } from "@/lib/db/schema";
import { SESSION_COOKIE } from "./constants";

export interface SessionPayload {
  userId: string;
  email: string;
}

function getSecretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET must be set in .env.local and be at least 32 characters.",
    );
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(payload: SessionPayload) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getSecretKey());
}

export async function verifySessionToken(
  token: string,
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (
      typeof payload.userId !== "string" ||
      typeof payload.email !== "string"
    ) {
      return null;
    }
    return { userId: payload.userId, email: payload.email };
  } catch {
    return null;
  }
}

function useSecureCookies() {
  if (process.env.COOKIE_SECURE === "true") return true;
  if (process.env.COOKIE_SECURE === "false") return false;
  // Only require HTTPS on real deployments — not local `npm start` on http://localhost.
  return Boolean(
    process.env.RENDER ||
      process.env.RENDER_EXTERNAL_URL ||
      process.env.VERCEL_URL,
  );
}

export function sessionCookieOptions(maxAge = 60 * 60 * 24 * 30) {
  return {
    httpOnly: true,
    secure: useSecureCookies(),
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function getCurrentUser(): Promise<
  Pick<User, "id" | "email" | "displayName"> | null
> {
  const session = await getSession();
  if (!session) return null;

  const db = getDb();
  const user = await db.query.users.findFirst({
    where: eq(users.id, session.userId),
    columns: { id: true, email: true, displayName: true },
  });

  if (!user) {
    // Stale cookie (e.g. after Render redeploy wiped the DB) — clear it to avoid redirect loops.
    await clearSessionCookie();
    return null;
  }

  return user;
}

export async function jsonWithSession<T extends Record<string, unknown>>(
  data: T,
  payload: SessionPayload,
  init?: ResponseInit,
) {
  const token = await createSessionToken(payload);
  const response = NextResponse.json(data, init);
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return response;
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, "", { ...sessionCookieOptions(0), maxAge: 0 });
}

export function logoutResponse() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(0), maxAge: 0 });
  return response;
}
