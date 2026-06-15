import { jwtVerify } from "jose";
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "./constants";

function getSecretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    return null;
  }
  return new TextEncoder().encode(secret);
}

async function hasValidSession(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return false;

  const secret = getSecretKey();
  if (!secret) return false;

  try {
    await jwtVerify(token, secret);
    return true;
  } catch {
    return false;
  }
}

export async function updateSession(request: NextRequest) {
  const isLoggedIn = await hasValidSession(request);
  const isAuthRoute =
    request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/signup");

  const isApiRoute = request.nextUrl.pathname.startsWith("/api");

  if (
    !isLoggedIn &&
    !isAuthRoute &&
    !isApiRoute &&
    request.nextUrl.pathname !== "/"
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next({ request });
}
