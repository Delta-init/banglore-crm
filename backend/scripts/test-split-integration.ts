/**
 * Split scheduler INTEGRATION test — exercises the REAL autoSplitLeadPublic
 * code against an isolated throwaway database that is created, used, and then
 * DROPPED. Production and the normal local crm_db are never touched.
 *
 * Reproduces the "returning-absent member" scenario end-to-end and asserts the
 * batch is spread evenly instead of flooding one person.
 *
 * Usage:  bun scripts/test-split-integration.ts
 *         TEST_URI="mongodb://localhost:27017/crm_db_splittest" bun scripts/test-split-integration.ts
 */
import mongoose from "mongoose";
import { Lead } from "../src/models/Lead.js";
import { User } from "../src/models/User.js";
import { Team } from "../src/models/Team.js";
import { Role } from "../src/models/Role.js";
import { autoSplitLeadPublic } from "../src/services/leadService.js";

const TEST_URI = process.env.TEST_URI || "mongodb://localhost:27017/crm_db_splittest";

async function main() {
  if (/72\.60\.|banglore_v1/.test(TEST_URI)) {
    console.error("Refusing to run integration test against a production-looking URI. Aborting.");
    process.exit(1);
  }
  await mongoose.connect(TEST_URI);
  console.log(`connected (throwaway): ${TEST_URI}\n`);

  // Clean slate.
  await Promise.all([Lead.deleteMany({}), User.deleteMany({}), Team.deleteMany({}), Role.deleteMany({})]);

  const role = await Role.create({ roleName: "BDE", isSystemRole: false });

  const names = ["A", "B", "C", "D", "SIMRAN"];
  const members = await User.create(
    names.map((n, i) => ({
      name: n,
      email: `${n.toLowerCase()}@test.local`,
      password: "x".repeat(60),
      role: role._id,
      status: "active",
    })),
  );
  const byName = Object.fromEntries(members.map((m) => [m.name, m._id]));

  const team = await Team.create({
    name: "SplitTest Team",
    status: "active",
    members: members.map((m) => m._id),
    leaders: [],
    inactiveMembers: [],
    absentToday: [],
    settings: {
      autoAssign: true,
      splitMode: "round_robin",
      roundRobinIndex: 0,
      includedMembers: [],
      splitTime: null,
    },
  });

  const reporter = members[0]._id; // any valid user id satisfies the required ref
  const admin = members[0]._id.toString();

  // Existing cumulative load: A–D already hold 40 each; SIMRAN was absent → 0.
  const existing: any[] = [];
  for (const n of ["A", "B", "C", "D"]) {
    for (let i = 0; i < 40; i++) {
      existing.push({
        name: `old-${n}-${i}`, phone: `9${n.charCodeAt(0)}${String(i).padStart(6, "0")}`,
        source: "seed", reporter, team: team._id, assignedTo: byName[n], assignedAt: new Date(), status: "assigned",
      });
    }
  }
  await Lead.insertMany(existing);

  // Today's batch: 40 unassigned leads waiting for the split.
  const BATCH = 40;
  const batchDocs = Array.from({ length: BATCH }, (_, i) => ({
    name: `new-${i}`, phone: `8${String(i).padStart(9, "0")}`,
    source: "seed", reporter, team: team._id, assignedTo: null, status: "new",
  }));
  const batch = await Lead.insertMany(batchDocs);

  // Drive it exactly like splitScheduler.tick does: one lead at a time.
  for (const l of batch) {
    await autoSplitLeadPublic(team._id.toString(), l._id.toString(), admin, undefined, true);
  }

  // Tally who got today's batch.
  const got: Record<string, number> = {};
  for (const n of names) {
    got[n] = await Lead.countDocuments({ _id: { $in: batch.map((b) => b._id) }, assignedTo: byName[n] });
  }
  const total = Object.values(got).reduce((a, b) => a + b, 0);
  const max = Math.max(...Object.values(got));
  const min = Math.min(...Object.values(got));
  const even = BATCH / names.length;

  console.log("Today's 40-lead batch distribution (SIMRAN returning from absence):");
  for (const n of names) console.log(`   ${n.padEnd(8)} ${got[n]}  ${"█".repeat(got[n])}`);
  console.log();

  let pass = true;
  const assert = (label: string, cond: boolean, detail: string) => {
    console.log(`  ${cond ? "✅ PASS" : "❌ FAIL"}  ${label}\n         ${detail}`);
    if (!cond) pass = false;
  };
  assert("all 40 leads were assigned", total === BATCH, `${total}/${BATCH} assigned`);
  assert("SIMRAN is NOT flooded (real code)", got.SIMRAN <= even + 1, `SIMRAN got ${got.SIMRAN} (even share = ${even})`);
  assert("batch is spread evenly", max - min <= 1, `max=${max} min=${min} gap=${max - min}`);

  // Tear down the throwaway database entirely.
  await mongoose.connection.dropDatabase();
  console.log(`\nthrowaway database dropped — no residual test data.`);

  await mongoose.disconnect();
  process.exit(pass ? 0 : 1);
}

main().catch(async (e) => {
  console.error("ERROR:", e);
  try { await mongoose.connection.dropDatabase(); } catch {}
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
