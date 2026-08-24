/**
 * Grants tracker view+edit to every existing role.
 *
 * Adding "tracker" to CRM_MODULES defaults it to false on roles created before
 * it existed, which would hide My Tracker from everyone but Super Admin. This
 * restores the intended default — everyone files their own day — and leaves
 * admins free to revoke it per role in the matrix afterwards.
 *
 *   bun src/scripts/grantTrackerPermission.ts
 */
import "dotenv/config";
import mongoose from "mongoose";
import { Role } from "../models/Role.js";

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI!, { authSource: "admin" });

  const roles = await Role.find({});
  let changed = 0;

  for (const role of roles) {
    const perms = (role.permissions ?? {}) as Record<string, unknown>;
    const current = perms.tracker as { view?: boolean } | undefined;
    if (current?.view) continue;

    role.set("permissions.tracker", {
      view: true,
      create: false,
      edit: true,
      delete: false,
      approve: false,
      export: false,
    });
    await role.save();
    changed += 1;
    console.log(`  granted tracker to: ${role.roleName}`);
  }

  console.log(`\n${changed} of ${roles.length} roles updated.`);
  await mongoose.disconnect();
};

run().catch((e) => {
  console.error("Failed:", e);
  process.exit(1);
});
