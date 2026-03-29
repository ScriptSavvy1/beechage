/**
 * Seed script: create initial tenant + admin user via Supabase Admin API.
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

const TENANT_NAME = "BeecHage";
const TENANT_SLUG = "bh";
const TENANT_ID = "00000000-0000-0000-0000-000000000001";

const ADMIN_EMAIL = "admin@beechage.com";
const ADMIN_PASSWORD = "Admin@123";
const ADMIN_NAME = "Admin";

async function main() {
  // 1. Create default tenant
  console.log(`Creating tenant: ${TENANT_NAME} (${TENANT_SLUG})`);
  const { error: tenantError } = await supabase
    .from("tenants")
    .upsert({
      id: TENANT_ID,
      name: TENANT_NAME,
      slug: TENANT_SLUG,
      plan: "pro",
    }, { onConflict: "slug" });

  if (tenantError) {
    console.error("Error creating tenant:", tenantError.message);
    process.exit(1);
  }
  console.log("Tenant created/verified.");

  // 2. Create default branch
  console.log("Creating default branch...");
  const { error: branchError } = await supabase
    .from("branches")
    .upsert({
      tenant_id: TENANT_ID,
      name: "Main Branch",
      is_default: true,
    }, { onConflict: "tenant_id,name" });

  if (branchError) {
    console.error("Error creating branch:", branchError.message);
    // Non-fatal, continue
  } else {
    console.log("Branch created/verified.");
  }

  // 3. Create admin user with tenant_id in app_metadata
  console.log(`Creating admin user: ${ADMIN_EMAIL}`);
  const { data, error } = await supabase.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
    app_metadata: {
      tenant_id: TENANT_ID,
      role: "OWNER",
    },
    user_metadata: {
      name: ADMIN_NAME,
    },
  });

  if (error) {
    if (error.message.includes("already been registered")) {
      console.log("Admin user already exists — updating app_metadata...");

      // Find existing user and update their app_metadata
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const existing = existingUsers?.users?.find(u => u.email === ADMIN_EMAIL);
      if (existing) {
        await supabase.auth.admin.updateUserById(existing.id, {
          app_metadata: {
            tenant_id: TENANT_ID,
            role: "OWNER",
          },
        });
        console.log("Updated app_metadata for existing admin.");

        // Also update public.users
        await supabase
          .from("users")
          .update({ tenant_id: TENANT_ID, role: "OWNER" })
          .eq("id", existing.id);

        // Ensure membership exists
        await supabase
          .from("tenant_memberships")
          .upsert({
            user_id: existing.id,
            tenant_id: TENANT_ID,
            role: "OWNER",
            is_active: true,
          }, { onConflict: "user_id,tenant_id" });

        console.log("Admin user fully configured.");
      }
      return;
    }
    console.error("Error creating admin:", error.message);
    process.exit(1);
  }

  console.log("Admin user created:", data.user.id);
  console.log(`\nCredentials:\n  Email:    ${ADMIN_EMAIL}\n  Password: ${ADMIN_PASSWORD}`);
  console.log(`\nTenant: ${TENANT_NAME} (${TENANT_SLUG})`);
}

main();
