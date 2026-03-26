"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";

export type LoginResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Server action that calls NextAuth's server-side signIn().
 * This bypasses the flaky client-side signIn() from next-auth/react
 * which can hang on CSRF token fetch in beta versions.
 */
export async function loginAction(
  _prev: LoginResult | null,
  formData: FormData,
): Promise<LoginResult> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { ok: false, error: "Email and password are required." };
  }

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: "/",
    });
    // signIn throws a NEXT_REDIRECT on success, so we never reach here.
    return { ok: true };
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return { ok: false, error: "Invalid email or password." };
        default:
          return { ok: false, error: "Something went wrong." };
      }
    }
    // NextAuth v5 throws a special redirect error on success.
    // Re-throw it so Next.js handles the redirect.
    throw error;
  }
}
