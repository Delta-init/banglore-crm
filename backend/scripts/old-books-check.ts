/**
 * Finance's old books counted for their salesperson in the Bangalore CRM (the user, 2026-11-25) — revenue only (no
 * commission here), in rupees at OLD_BOOKS_INR_PER_AED — on a scratch database, against a stand-in finance:
 *
 *   - Case 1: a read-only pass writes nothing and lists who isn't a user here; then each old-books invoice with
 *     November money is kept for the user whose email finance has, in their team, only the money from 1 Nov on,
 *     at ₹25 to the dirham.
 *   - Case 2: the figures — Reports revenue overview, revenue by team, a team's revenue, rewards (closedBy), the
 *     old-books card; October/June money and someone not a user here count nowhere; a real lead's money as before.
 *   - Case 3: later passes — another payment counted once; run again: the same; voided in finance: off every figure;
 *     finance away: the tick carries on and what was kept stays.
 *
 * Run by old-books-check.sh. Scratch database only.
 */
import { Types } from "mongoose";

const uri = process.env.MONGODB_URI ?? "";
if (!/127\.0\.0\.1|localhost/.test(uri) || !/e2e|test|scratch/i.test(uri)) {
  console.error(`Refusing to run: MONGODB_URI must be a scratch database, got "${uri}"`);
  process.exit(1);
}

let failures = 0, checks = 0;
function check(label: string, ok: boolean, detail = "") {
  checks++;
  if (ok) console.log(`  \x1b[32m✓\x1b[0m ${label}`);
  else { failures++; console.log(`  \x1b[31m✗ ${label}${detail ? ` — ${detail}` : ""}\x1b[0m`); }
}
const section = (s: string) => console.log(`\n${s}`);
const j = (v: unknown) => JSON.stringify(v).slice(0, 500);

/* ── A stand-in finance: the old books' list ── */
const SECRET = "old-books-check-secret-long-enough";
let invoices: any[] = [];
let away = false;
let asked = 0;
const { signRequest } = await import("../src/utils/signing.js");
const fin = Bun.serve({
  port: 0,
  async fetch(req) {
    const url = new URL(req.url);
    const ts = req.headers.get("x-delta-timestamp") ?? "", nonce = req.headers.get("x-delta-nonce") ?? "";
    if (req.headers.get("x-delta-signature") !== signRequest(SECRET, req.method, url.pathname + url.search, ts, nonce, "")) {
      return Response.json({ error: { message: "Bad signature" } }, { status: 401 });
    }
    if (away) return Response.json({ error: { message: "down" } }, { status: 503 });
    if (url.pathname === "/api/v1/integrations/old-books/payments") {
      asked++;
      const from = url.searchParams.get("from") ?? "";
      return Response.json({ data: invoices.filter((i) => i.payments.some((p: any) => p.paidOn >= from)) });
    }
    return Response.json({ error: "Not found" }, { status: 404 });
  },
});

const vapid = (await import("web-push")).default.generateVAPIDKeys();
Object.assign(process.env, {
  VAPID_PUBLIC_KEY: vapid.publicKey, VAPID_PRIVATE_KEY: vapid.privateKey,
  JWT_SECRET: "old-books-check-jwt", JWT_REFRESH_SECRET: "old-books-check-refresh",
  NODE_ENV: "test", RUN_SCHEDULERS: "false", OLD_BOOKS_INR_PER_AED: "25",
  FINANCE_API_URL: `http://127.0.0.1:${fin.port}`, FINANCE_CLIENT_ID: "banglore-crm-check", FINANCE_INTEGRATION_SECRET: SECRET,
  FINANCE_ORG_ID: "org-blr", R2_ACCOUNT_ID: "", R2_ACCESS_KEY_ID: "", R2_SECRET_ACCESS_KEY: "",
});

const mongoose = (await import("mongoose")).default;
await mongoose.connect(uri);
await mongoose.connection.dropDatabase();
const db = mongoose.connection.db!;
await import("../src/models/Role.js");
const { syncOldBooks, oldBooksTick } = await import("../src/services/oldBooks.js");
const { OldBooksSale } = await import("../src/models/OldBooksSale.js");
const { ReportService } = await import("../src/services/reportService.js");
const { closedBy } = await import("../src/services/rewardsService.js");

// ── People, a team, one real lead with rupee money ───────────────────────────
const roleId = new Types.ObjectId();
await db.collection("roles").insertOne({ _id: roleId, roleName: "BDE", isSystemRole: false, permissions: {} });
const ids: Record<string, Types.ObjectId> = {};
for (const name of ["Tina", "Athira", "Gopika"]) {
  ids[name] = new Types.ObjectId();
  await db.collection("users").insertOne({ _id: ids[name], name, email: `${name.toLowerCase()}@e2e.test`, role: roleId, status: "active" });
}
const T1 = new Types.ObjectId();
await db.collection("teams").insertOne({ _id: T1, name: "Team One", status: "active", leaders: [ids.Tina], members: [ids.Athira, ids.Gopika] });
await db.collection("leads").insertOne({ _id: new Types.ObjectId(), name: "Real lead", phone: "+910000000001", assignedTo: ids.Gopika, team: T1, status: "Enrolled", payments: [{ amount: 10000, paidAt: new Date("2026-11-10T10:00:00Z") }] });

// ── Finance's old books ──────────────────────────────────────────────────────
const oid = () => String(new Types.ObjectId());
const inv = (n: string, who: string, course: string, total: number, pays: [string, number][], status?: string) => {
  const paid = pays.reduce((s, p) => s + p[1], 0);
  return {
    invoiceId: oid(), invoiceNumber: n, organizationId: "org-dubai", customerName: `Client ${n}`, salespersonName: who,
    salespersonEmail: `${who.toLowerCase()}@e2e.test`, course, currency: "AED", issueDate: pays[0]![0], totalMinor: total * 100,
    balanceMinor: (total - paid) * 100, status: status ?? (paid >= total ? "paid" : "partial"),
    payments: pays.map(([d, a]) => ({ id: oid(), paidOn: d, amountMinor: a * 100, method: "billexpro" })),
  };
};
const A = inv("DMDT006238", "Athira", "Market Break-out Trading Program — (× 0.5)", 1200, [["2026-06-18", 600], ["2026-11-11", 600]]);
const B = inv("DMDT006460", "Gopika", "Digital Marketing — (× 0.5)", 1300, [["2026-07-06", 650], ["2026-11-06", 650]]);
const C = inv("DMDT005211", "Arya", "Delta Wave Theory Program", 2500, [["2025-12-31", 1500], ["2026-11-04", 1000]]);
const E = inv("DMDT006982", "Athira", "Market Break-out Trading Program — (× 0.5)", 599.5, [["2026-10-03", 599.5]]);
invoices = [A, B, C, E];

const svc = new ReportService();
const NOV: [string, string] = ["2026-11-01", "2026-11-30"];

// ── Case 1 ───────────────────────────────────────────────────────────────────
section("Case 1 — kept for the user whose email finance has, in rupees");
const dry = await syncOldBooks({ write: false });
check("a read-only pass writes nothing", dry.invoices === 3 && (await OldBooksSale.countDocuments()) === 0, j(dry));
check("it lists who isn't a user here (Arya, AED 1,000)", dry.notHere.length === 1 && dry.notHere[0]!.invoice === "DMDT005211" && dry.notHere[0]!.paidAed === 1000, j(dry.notHere));
check("and who is, in rupees (Athira ₹15,000)", dry.here.some((h) => h.invoice === "DMDT006238" && h.paidInr === 15000), j(dry.here));
check("finance asked from 1 Nov", asked === 1);
await syncOldBooks();
const a = await OldBooksSale.findOne({ invoiceNumber: "DMDT006238" }).lean();
check("3 kept (one with no user here), the October-only one not asked for", (await OldBooksSale.countDocuments()) === 3);
check("Athira's: her team, only November's AED 600 as ₹15,000", String(a?.assignedTo) === String(ids.Athira) && String(a?.team) === String(T1) && a?.payments.length === 1 && a?.payments[0]?.amount === 15000 && a?.payments[0]?.aed === 600 && a?.allPayments.length === 2, j(a));

// ── Case 2 ───────────────────────────────────────────────────────────────────
section("Case 2 — every figure that adds up payments by day takes them in");
const ov: any = await svc.getRevenueOverview(...NOV);
check("revenue overview: ₹10,000 lead + ₹15,000 + ₹16,250 old books = ₹41,250", JSON.stringify(ov).includes("41250"), j(ov));
const teams: any = await svc.getRevenueTeams(...NOV);
check("revenue by team counts them", JSON.stringify(teams).includes("41250"), j(teams));
const tr: any = await svc.getTeamRevenue(String(T1), ...NOV);
check("the team's own revenue counts them", JSON.stringify(tr).includes("41250"), j(tr));
check("rewards (closedBy) for the team: ₹41,250", (await closedBy([ids.Athira, ids.Gopika, ids.Tina], "2026-11")) === 41250);
check("rewards for Athira in October: nothing", (await closedBy([ids.Athira], "2026-10")) === 0);
check("rewards for Athira in June: the old first payment isn't counted", (await closedBy([ids.Athira], "2026-06")) === 0);
const ob = await svc.getOldBooks(...NOV);
check("old-books card: 2 payments, ₹31,250 (AED 1,250)", ob.count === 2 && ob.total === 31250 && ob.totalAed === 1250 && ob.rows.some((r) => r.name === "Athira" && r.invoiceNumber === "DMDT006238"), j(ob));
const oct = await svc.getOldBooks("2026-10-01", "2026-10-31");
check("old-books card October: none", oct.count === 0, j(oct));

// ── Case 3 ───────────────────────────────────────────────────────────────────
section("Case 3 — later passes, a void, finance away");
B.payments.push({ id: oid(), paidOn: "2026-11-20", amountMinor: 0, method: "billexpro" });
A.payments.push({ id: oid(), paidOn: "2026-11-25", amountMinor: 10000, method: "billexpro" });
await syncOldBooks();
await syncOldBooks();
check("another payment counted once (₹2,500 more), a zero one never, run twice", (await closedBy([ids.Athira], "2026-11")) === 17500, String(await closedBy([ids.Athira], "2026-11")));
A.status = "void";
await syncOldBooks();
check("voided in finance: off the figures", (await closedBy([ids.Athira], "2026-11")) === 0 && (await svc.getOldBooks(...NOV)).count === 1, j([await closedBy([ids.Athira], "2026-11"), await svc.getOldBooks(...NOV)]));
away = true;
let threw = false;
try { await oldBooksTick(); } catch { threw = true; }
check("finance away: the tick doesn't throw, what was kept stays", !threw && (await OldBooksSale.countDocuments()) === 3);

console.log(`\n${checks - failures}/${checks} checks passed`);
fin.stop(true);
await mongoose.disconnect();
process.exit(failures ? 1 : 0);
