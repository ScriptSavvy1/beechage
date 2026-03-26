import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Health-check endpoint: tests DB connectivity from Vercel serverless.
 * GET /api/health → { ok: true, userCount: N } or { ok: false, error: "..." }
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { count, error } = await supabase
      .from("users")
      .select("id", { count: "exact", head: true });

    if (error) throw error;

    return NextResponse.json({ ok: true, userCount: count });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Health check DB error:", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
