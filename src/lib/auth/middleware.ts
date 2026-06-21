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

function clearSessionOnResponse(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", {
    path: "/",
    maxAge: 0,
    httpOnly: true,
    sameSite: "lax",
  });
  return response;
}

async function getSessionState(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    return { isLoggedIn: false, clearCookie: false };
  }

  const secret = getSecretKey();
  if (!secret) {
    return { isLoggedIn: false, clearCookie: false };
  }

  try {
    await jwtVerify(token, secret);
    return { isLoggedIn: true, clearCookie: false };
  } catch {
    return { isLoggedIn: false, clearCookie: true };
  }
}

export async function updateSession(request: NextRequest) {
  const { isLoggedIn, clearCookie } = await getSessionState(request);
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
    const response = NextResponse.redirect(url);
    if (clearCookie) clearSessionOnResponse(response);
    return response;
  }

  const response = NextResponse.next({ request });
  if (clearCookie) clearSessionOnResponse(response);
  return response;
}
