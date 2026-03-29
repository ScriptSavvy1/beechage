/**
 * Seed script: create tenant + OWNER + ADMIN users.
 *
 * Usage: node scripts/seed-admin.mjs
 *
 * OWNER creation uses the seed_set_owner() DB function which
 * sets a bypass flag so the guard triggers allow it.
 * This RPC is blocked for authenticated/anon users — only service_role can call it.
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

const USERS = [
  { email: "owner@beechage.com", password: "Owner@123", name: "Owner", role: "OWNER" },
  { email: "admin@beechage.com", password: "Admin@123", name: "Admin", role: "ADMIN" },
];

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

async function ensureUser({ email, password, name, role }) {
  console.log(`\nProcessing: ${email} (${role})`);

  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const existing = existingUsers?.users?.find((u) => u.email === email);

  if (existing) {
    console.log(`  Exists (${existing.id}) — updating...`);

    // Update app_metadata
    await supabase.auth.admin.updateUserById(existing.id, {
      app_metadata: { tenant_id: TENANT_ID, role },
    });

    if (role === "OWNER") {
      // Use the secure seed_set_owner RPC (sets bypass flag in same transaction)
      const { error } = await supabase.rpc("seed_set_owner", {
        p_user_id: existing.id,
        p_tenant_id: TENANT_ID,
      });
      if (error) {
        console.error("  seed_set_owner error:", error.message);
        return;
      }
    } else {
      await supabase.from("users").update({ tenant_id: TENANT_ID, role }).eq("id", existing.id);
      await supabase
        .from("tenant_memberships")
        .upsert({ user_id: existing.id, tenant_id: TENANT_ID, role, is_active: true }, { onConflict: "user_id,tenant_id" });
    }

    console.log(`  ✓ ${role} updated.`);
    return;
  }

  // Create new user — trigger caps OWNER → ADMIN, we promote after
  const { data, error } = await supabase.auth.admin.createUser({
    email, password, email_confirm: true,
    app_metadata: { tenant_id: TENANT_ID, role: role === "OWNER" ? "ADMIN" : role },
    user_metadata: { name },
  });

  if (error) {
    console.error(`  ✗ Error:`, error.message);
    return;
  }

  console.log(`  ✓ Created: ${data.user.id}`);

  if (role === "OWNER") {
    // Promote via secure RPC
    const { error: promoteErr } = await supabase.rpc("seed_set_owner", {
      p_user_id: data.user.id,
      p_tenant_id: TENANT_ID,
    });
    if (promoteErr) {
      console.error("  ✗ Promotion error:", promoteErr.message);
    } else {
      // Also fix the app_metadata to say OWNER (was set to ADMIN during create)
      await supabase.auth.admin.updateUserById(data.user.id, {
        app_metadata: { tenant_id: TENANT_ID, role: "OWNER" },
      });
      console.log("  ✓ Promoted to OWNER");
    }
  }
}

async function main() {
  await ensureTenant();
  for (const user of USERS) await ensureUser(user);

  console.log("\n═══════════════════════════════════");
  console.log("  Credentials:");
  console.log("═══════════════════════════════════");
  for (const u of USERS) console.log(`  ${u.role.padEnd(10)} ${u.email} / ${u.password}`);
  console.log("═══════════════════════════════════\n");
}

main();
