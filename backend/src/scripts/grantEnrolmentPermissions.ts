/**
 * Gives every existing role what closing a lead through its enrolment needs.
 *
 * Closing a lead now goes through the enrolment dialog, which reads the lead's
 * student (students:view), creates it (students:create) and uploads the
 * payment receipt; My Enrolments and correcting a sent-back enrolment are the
 * new "enrolments" module (view, edit). "students" was never on the
 * permission-matrix screen, so no role but Super Admin could be given it, and
 * a brand-new module defaults to nothing — so without this, every counsellor
 * would be refused the close.
 *
 * Only touches a module a role has no view on, so running it again after
 * somebody has adjusted things by hand changes nothing. Same pattern as
 * grantTrackerPermission.ts.
 *
 * A dry run unless --write is given:
 *   bun src/scripts/grantEnrolmentPermissions.ts           # shows what it would change
 *   bun src/scripts/grantEnrolmentPermissions.ts --write   # changes it
 */
import "dotenv/config";
import mongoose from "mongoose";
import { Role } from "../models/Role.js";

const DEFAULTS: Record<string, { view: boolean; create: boolean; edit: boolean; delete: boolean; approve: boolean; export: boolean }> = {
  students:   { view: true, create: true, edit: true, delete: false, approve: false, export: false },
  enrolments: { view: true, create: false, edit: true, delete: false, approve: false, export: false },
};

const write = process.argv.includes("--write");

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI!, { authSource: "admin" });

  const roles = await Role.find({});
  let changed = 0;

  for (const role of roles) {
    if (role.isSystemRole && role.roleName === "Super Admin") continue; // has everything already
    const perms = (role.permissions ?? {}) as Record<string, { view?: boolean } | undefined>;
    const granted: string[] = [];
    for (const [mod, fallback] of Object.entries(DEFAULTS)) {
      // Checked on view, not existence: the schema gives every module an
      // all-false subdocument by default.
      if (perms[mod]?.view) continue;
      role.set(`permissions.${mod}`, fallback);
      granted.push(mod);
    }
    if (!granted.length) continue;
    changed += 1;
    console.log(`  ${write ? "granted" : "would grant"} ${granted.join(" + ")} to: ${role.roleName}`);
    if (write) await role.save();
  }

  console.log(`\n${changed} of ${roles.length} roles ${write ? "updated" : "would be updated (dry run — add --write)"}.`);
  await mongoose.disconnect();
};

run().catch((e) => {
  console.error("Failed:", e);
  process.exit(1);
});
