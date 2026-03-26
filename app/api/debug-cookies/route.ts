import { NextResponse } from "next/server";
import { cookies } from "next/headers";

/**
 * Diagnostic: shows all cookies the server can see.
 * Helps debug whether NextAuth session cookies are actually set.
 * GET /api/debug-cookies
 */
export async function GET() {
  const cookieStore = await cookies();
  const all = cookieStore.getAll();
  
  const cookieInfo = all.map((c) => ({
    name: c.name,
    valuePreview: c.value.substring(0, 30) + "...",
    length: c.value.length,
  }));

  return NextResponse.json({
    cookieCount: all.length,
    cookies: cookieInfo,
    authSecret: process.env.AUTH_SECRET ? "set (" + process.env.AUTH_SECRET.length + " chars)" : "NOT SET",
    authUrl: process.env.AUTH_URL ?? "NOT SET",
  });
}
