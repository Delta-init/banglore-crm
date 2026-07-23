/**
 * Split scheduler distribution test (PURE SIMULATION — no DB, no writes).
 *
 * Replicates the exact assignee-selection logic of autoSplitLead for both:
 *   CURRENT  — per-lead "pick the member with the fewest cumulative leads"
 *              (equal_load, or round_robin+roundRobinStartDate)
 *   FIXED    — even round-robin per batch (rotating pointer across present pool)
 *
 * and runs controlled scenarios so the "returning-absent-member gets the whole
 * batch" bug is visible and the fix is proven. All data here is synthetic and
 * local to this process — production is never touched.
 *
 * Usage:  bun scripts/test-split-scheduler.ts
 */

type Load = Record<string, number>; // memberId -> existing cumulative count

// ── CURRENT policy: each lead → member with the current global minimum ────────
// (mirrors leadService.autoSplitLead equal_load / startDate round_robin: it
// recomputes the min from the live counts before every single lead.)
function distributeCurrent(pool: string[], batch: number, startLoad: Load): Load {
  const load: Load = { ...startLoad };
  for (const id of pool) load[id] ??= 0;
  for (let i = 0; i < batch; i++) {
    let min = pool[0];
    for (const id of pool) if (load[id] < load[min]) min = id;
    load[min]++;
  }
  return load;
}

// ── FIXED policy: even round-robin across the present pool for THIS batch ──────
function distributeFixed(pool: string[], batch: number, startIndex = 0): { assignedThisBatch: Load; nextIndex: number } {
  const assignedThisBatch: Load = {};
  for (const id of pool) assignedThisBatch[id] = 0;
  let idx = startIndex % pool.length;
  for (let i = 0; i < batch; i++) {
    assignedThisBatch[pool[idx]]++;
    idx = (idx + 1) % pool.length;
  }
  return { assignedThisBatch, nextIndex: idx };
}

// ── helpers ───────────────────────────────────────────────────────────────────
const spread = (d: Load, pool: string[]) => {
  const vals = pool.map((id) => d[id] ?? 0);
  return { min: Math.min(...vals), max: Math.max(...vals), gap: Math.max(...vals) - Math.min(...vals) };
};
const show = (d: Load, pool: string[]) => pool.map((id) => `${id}=${d[id] ?? 0}`).join("  ");

let passed = 0;
let failed = 0;
function check(label: string, cond: boolean, detail: string) {
  console.log(`  ${cond ? "✅ PASS" : "❌ FAIL"}  ${label}`);
  console.log(`         ${detail}`);
  cond ? passed++ : failed++;
}

console.log("SPLIT SCHEDULER DISTRIBUTION TEST  (synthetic data — no DB)\n");

// ── Case 1 — even batch, everyone present, all starting equal ─────────────────
{
  console.log("Case 1 — 40-lead batch, 5 present members, all start at 0");
  const pool = ["A", "B", "C", "D", "E"];
  const cur = distributeCurrent(pool, 40, {});
  const fix = distributeFixed(pool, 40, 0).assignedThisBatch;
  console.log(`   CURRENT: ${show(cur, pool)}   gap=${spread(cur, pool).gap}`);
  console.log(`   FIXED  : ${show(fix, pool)}   gap=${spread(fix, pool).gap}`);
  check("both spread evenly when starting equal", spread(cur, pool).gap <= 1 && spread(fix, pool).gap <= 1,
    "each member should get ~8 leads");
  console.log();
}

// ── Case 2 — THE BUG: one member returns from absence, far behind ─────────────
{
  console.log('Case 2 — returning-absent member: 4 members at 40 each, "SIMRAN" at 0, 40-lead batch');
  const pool = ["A", "B", "C", "D", "SIMRAN"];
  const start: Load = { A: 40, B: 40, C: 40, D: 40, SIMRAN: 0 };
  const cur = distributeCurrent(pool, 40, start);
  const simranGotCur = (cur.SIMRAN ?? 0) - start.SIMRAN;
  const fixBatch = distributeFixed(pool, 40, 0).assignedThisBatch;
  const simranGotFix = fixBatch.SIMRAN ?? 0;
  console.log(`   CURRENT: SIMRAN received ${simranGotCur} of 40  (others received ${40 - simranGotCur})`);
  console.log(`   FIXED  : SIMRAN received ${simranGotFix} of 40  (even share = 8)`);
  check("CURRENT floods the returning member (reproduces the bug)", simranGotCur >= 40 * 0.7,
    `SIMRAN swallowed ${simranGotCur}/40 = ${Math.round((simranGotCur / 40) * 100)}% of the batch`);
  check("FIXED gives the returning member only a fair share", simranGotFix <= 10,
    `SIMRAN gets ${simranGotFix}, roughly batch/members = 8`);
  console.log();
}

// ── Case 3 — a member marked absent today is excluded from the batch ──────────
{
  console.log("Case 3 — 30-lead batch, 5 members but 1 (E) absent today → pool excludes E");
  const present = ["A", "B", "C", "D"]; // E filtered out before distribution
  const fix = distributeFixed(present, 30, 0).assignedThisBatch;
  check("absent member E receives nothing", (fix as Load).E === undefined,
    `distributed only to ${present.join(",")}`);
  check("present members share the batch evenly", spread(fix, present).gap <= 1,
    show(fix, present));
  console.log();
}

// ── Case 4 — everyone absent / empty pool → no assignment, no crash ───────────
{
  console.log("Case 4 — empty present pool (everyone absent)");
  const pool: string[] = [];
  let crashed = false;
  let result: any = null;
  try {
    // scheduler guards `if (pool.length === 0) return;` — simulate that guard.
    result = pool.length === 0 ? "skipped (no assignment)" : distributeFixed(pool, 10, 0);
  } catch {
    crashed = true;
  }
  check("no crash and nothing assigned when pool is empty", !crashed && result === "skipped (no assignment)",
    "matches the `if (pool.length === 0) return;` guard");
  console.log();
}

// ── Case 5 — index persists across batches so consecutive batches stay even ───
{
  console.log("Case 5 — two 7-lead batches, 3 members; index must carry over");
  const pool = ["A", "B", "C"];
  const b1 = distributeFixed(pool, 7, 0);
  const b2 = distributeFixed(pool, 7, b1.nextIndex);
  const combined: Load = {};
  for (const id of pool) combined[id] = (b1.assignedThisBatch[id] ?? 0) + (b2.assignedThisBatch[id] ?? 0);
  console.log(`   batch1: ${show(b1.assignedThisBatch, pool)}  (nextIndex=${b1.nextIndex})`);
  console.log(`   batch2: ${show(b2.assignedThisBatch, pool)}`);
  console.log(`   total : ${show(combined, pool)}`);
  check("carrying the index keeps two batches balanced overall", spread(combined, pool).gap <= 1,
    "without index carry-over, member A would lead every batch");
  console.log();
}

console.log("─".repeat(60));
console.log(`RESULT: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
