import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Health-check endpoint: tests DB connectivity from Vercel serverless.
 * GET /api/health → { ok: true, userCount: N } or { ok: false, error: "..." }
 */
export async function GET() {
  try {
    const count = await prisma.user.count();
    return NextResponse.json({ ok: true, userCount: count, dbUrl: process.env.DATABASE_URL?.substring(0, 30) + "..." });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Health check DB error:", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
