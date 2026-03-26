import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

/**
 * Diagnostic endpoint: tests the exact same auth logic as NextAuth authorize().
 * GET /api/auth-test?email=admin@laundry.local&password=Password123!
 *
 * Returns JSON with step-by-step results so we can pinpoint exactly where
 * the login flow breaks on Vercel.
 *
 * ⚠️  Remove this endpoint after debugging!
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const email = url.searchParams.get("email") ?? "";
  const password = url.searchParams.get("password") ?? "";

  const steps: Record<string, unknown> = { email, passwordProvided: !!password };

  try {
    // Step 1: User lookup
    const user = await prisma.user.findUnique({ where: { email } });
    steps.userFound = !!user;
    steps.userActive = user?.isActive ?? null;
    steps.userRole = user?.role ?? null;

    if (!user) {
      return NextResponse.json({ ok: false, steps, error: "User not found" });
    }

    // Step 2: bcrypt compare
    const valid = await bcrypt.compare(password, user.passwordHash);
    steps.bcryptValid = valid;

    if (!valid) {
      return NextResponse.json({ ok: false, steps, error: "Password mismatch" });
    }

    // Step 3: What authorize() would return
    steps.authResult = { id: user.id, email: user.email, name: user.name, role: user.role };

    return NextResponse.json({ ok: true, steps });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    steps.exception = msg;
    return NextResponse.json({ ok: false, steps, error: msg }, { status: 500 });
  }
}
