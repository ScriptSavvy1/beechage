import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Middleware — routing guards for ADMIN, RECEPTION, and LAUNDRY roles.
 */
export async function middleware(req: NextRequest) {
  const { user, supabaseResponse } = await updateSession(req);

  const { pathname } = req.nextUrl;
  const isLoggedIn = !!user;
  const role = user?.user_metadata?.role as string | undefined;

  // Let API auth routes pass through
  const isApiAuth = pathname.startsWith("/api/auth");
  if (isApiAuth) {
    return supabaseResponse;
  }

  const isLogin = pathname === "/login";

  if (isLogin) {
    if (isLoggedIn) {
      const home = role === "ADMIN" ? "/admin" : role === "LAUNDRY" ? "/laundry" : "/reception";
      return NextResponse.redirect(new URL(home, req.url));
    }
    return supabaseResponse;
  }

  if (!isLoggedIn) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === "/") {
    const home = role === "ADMIN" ? "/admin" : role === "LAUNDRY" ? "/laundry" : "/reception";
    return NextResponse.redirect(new URL(home, req.url));
  }

  if (pathname.startsWith("/admin") && role !== "ADMIN") {
    const home = role === "LAUNDRY" ? "/laundry" : "/reception";
    return NextResponse.redirect(new URL(home, req.url));
  }

  if (pathname.startsWith("/reception") && role !== "RECEPTION") {
    const home = role === "ADMIN" ? "/admin" : "/laundry";
    return NextResponse.redirect(new URL(home, req.url));
  }

  if (pathname.startsWith("/laundry") && role !== "LAUNDRY") {
    const home = role === "ADMIN" ? "/admin" : "/reception";
    return NextResponse.redirect(new URL(home, req.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/", "/login", "/admin", "/admin/:path*", "/reception", "/reception/:path*", "/laundry", "/laundry/:path*"],
};
