import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * Role checks use JWT only — no Prisma/bcrypt in Edge.
 *
 * IMPORTANT: We explicitly set the cookie name to match what NextAuth v5
 * uses. On HTTPS (Vercel), NextAuth v5 sets the cookie as
 * "__Secure-authjs.session-token", but getToken() may default to the
 * v4 cookie name "next-auth.session-token". This mismatch is why login
 * appeared to succeed but the middleware couldn't read the session.
 */
export async function middleware(req: NextRequest) {
  const secret = process.env.AUTH_SECRET;
  const isSecure = req.url.startsWith("https://");

  const token = await getToken({
    req,
    secret,
    // NextAuth v5 cookie name — different on HTTP vs HTTPS
    cookieName: isSecure
      ? "__Secure-authjs.session-token"
      : "authjs.session-token",
  });

  const { pathname } = req.nextUrl;
  const isLoggedIn = !!token;
  const role = token?.role as string | undefined;

  const isApiAuth = pathname.startsWith("/api/auth");
  if (isApiAuth) {
    return NextResponse.next();
  }

  const isLogin = pathname === "/login";

  if (isLogin) {
    if (isLoggedIn) {
      const home = role === "ADMIN" ? "/admin" : "/reception";
      return NextResponse.redirect(new URL(home, req.url));
    }
    return NextResponse.next();
  }

  if (!isLoggedIn) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === "/") {
    const home = role === "ADMIN" ? "/admin" : "/reception";
    return NextResponse.redirect(new URL(home, req.url));
  }

  if (pathname.startsWith("/admin") && role !== "ADMIN") {
    return NextResponse.redirect(new URL("/reception", req.url));
  }

  if (pathname.startsWith("/reception") && role !== "RECEPTION") {
    return NextResponse.redirect(new URL("/admin", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/admin", "/admin/:path*", "/reception", "/reception/:path*"],
};
