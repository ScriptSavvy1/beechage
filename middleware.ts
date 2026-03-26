import NextAuth from "next-auth";
import authConfig from "@/auth.config";
import { NextResponse } from "next/server";

/**
 * Middleware using NextAuth v5's built-in auth() helper.
 *
 * IMPORTANT: We import from auth.config.ts (NOT lib/auth.ts) to avoid
 * bundling Prisma/bcrypt into the Edge middleware runtime.
 *
 * Why this fixes the Vercel login issue:
 *   The previous middleware used getToken() from "next-auth/jwt" which
 *   uses a different cookie name/salt than the auth handler on HTTPS.
 *   After a successful sign-in, the cookie was set but getToken() couldn't
 *   read it, so the middleware always thought the user was logged out.
 *   Using NextAuth().auth as middleware ensures the same cookie/JWT config.
 */
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;
  const role = req.auth?.user?.role as string | undefined;

  // Let /api/auth routes pass through
  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // Login page
  if (pathname === "/login") {
    if (isLoggedIn) {
      const home = role === "ADMIN" ? "/admin" : "/reception";
      return NextResponse.redirect(new URL(home, req.url));
    }
    return NextResponse.next();
  }

  // Not logged in → redirect to login
  if (!isLoggedIn) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Root → redirect to role-based home
  if (pathname === "/") {
    const home = role === "ADMIN" ? "/admin" : "/reception";
    return NextResponse.redirect(new URL(home, req.url));
  }

  // Role-based access control
  if (pathname.startsWith("/admin") && role !== "ADMIN") {
    return NextResponse.redirect(new URL("/reception", req.url));
  }
  if (pathname.startsWith("/reception") && role !== "RECEPTION") {
    return NextResponse.redirect(new URL("/admin", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/", "/login", "/admin", "/admin/:path*", "/reception", "/reception/:path*"],
};
