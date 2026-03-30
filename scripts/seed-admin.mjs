/**
 * Seed script: create tenant + ADMIN user.
 *
 * Usage: node scripts/seed-admin.mjs
 *
 * One ADMIN per tenant — controls everything.
 * ADMIN creates RECEPTION and LAUNDRY users via the app.
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

const TENANT_ID = "00000000-0000-0000-0000-000000000001";
const TENANT_NAME = "BeecHage";
const TENANT_SLUG = "bh";

const ADMIN_EMAIL = "admin@beechage.com";
const ADMIN_PASSWORD = "Admin@123";
const ADMIN_NAME = "Admin";

async function ensureTenant() {
  console.log(`Ensuring tenant: ${TENANT_NAME} (${TENANT_SLUG})`);
  const { error } = await supabase
    .from("tenants")
    .upsert({ id: TENANT_ID, name: TENANT_NAME, slug: TENANT_SLUG, plan: "pro" }, { onConflict: "slug" });
  if (error) { console.error("Tenant error:", error.message); process.exit(1); }
  console.log("✓ Tenant ready.");

  const { error: be } = await supabase
    .from("branches")
    .upsert({ tenant_id: TENANT_ID, name: "Main Branch", is_default: true }, { onConflict: "tenant_id,name" });
  if (be) console.warn("Branch warning:", be.message);
  else console.log("✓ Branch ready.");
}

async function ensureAdmin() {
  console.log(`\nProcessing: ${ADMIN_EMAIL} (ADMIN)`);

  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const existing = existingUsers?.users?.find((u) => u.email === ADMIN_EMAIL);

  if (existing) {
    console.log(`  Exists (${existing.id}) — updating to ADMIN...`);

    await supabase.auth.admin.updateUserById(existing.id, {
      app_metadata: { tenant_id: TENANT_ID, role: "ADMIN" },
    });

    await supabase.from("users").update({ tenant_id: TENANT_ID, role: "ADMIN" }).eq("id", existing.id);

    await supabase
      .from("tenant_memberships")
      .upsert({ user_id: existing.id, tenant_id: TENANT_ID, role: "ADMIN", is_active: true }, { onConflict: "user_id,tenant_id" });

    console.log("  ✓ ADMIN updated.");
    return;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
    app_metadata: { tenant_id: TENANT_ID, role: "ADMIN" },
    user_metadata: { name: ADMIN_NAME },
  });

  if (error) {
    console.error("  ✗ Error:", error.message);
    return;
  }

  console.log(`  ✓ Created: ${data.user.id}`);
}

async function main() {
  await ensureTenant();
  await ensureAdmin();

  console.log("\n═══════════════════════════════════");
  console.log("  Credentials:");
  console.log("═══════════════════════════════════");
  console.log(`  ADMIN      ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  console.log("═══════════════════════════════════\n");
}

main();
