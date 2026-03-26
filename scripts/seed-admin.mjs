/**
 * Seed script: create initial admin user via Supabase Admin API.
 *
 * Usage:
 *   node scripts/seed-admin.mjs
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ADMIN_EMAIL = "admin@beechage.com";
const ADMIN_PASSWORD = "Admin@123";
const ADMIN_NAME = "Admin";

async function main() {
  console.log(`Creating admin user: ${ADMIN_EMAIL}`);

  const { data, error } = await supabase.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
    user_metadata: {
      name: ADMIN_NAME,
      role: "ADMIN",
    },
  });

  if (error) {
    if (error.message.includes("already been registered")) {
      console.log("Admin user already exists — skipping.");
      return;
    }
    console.error("Error creating admin:", error.message);
    process.exit(1);
  }

  console.log("Admin user created:", data.user.id);
  console.log(`\nCredentials:\n  Email:    ${ADMIN_EMAIL}\n  Password: ${ADMIN_PASSWORD}`);
}

main();
