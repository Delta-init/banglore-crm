/**
 * The finance handover goes out when it is queued, not on the next tick.
 *
 * In-process, against a throwaway database and a stand-in finance — the timer
 * is never started, so anything delivered here was delivered by the kick:
 *
 *   Case 1 — happy path: a queued enrolment reaches finance within moments.
 *   Case 2 — edge: one queued while a delivery is already running goes out in
 *            the same burst instead of waiting for the timer.
 *   Case 3 — error: finance down leaves it pending; the wait between tries
 *            grows, but never past a quarter of an hour.
 *   Case 4 — auth: finance refusing our credentials (401) is retried, not
 *            abandoned; with the link not configured nothing is sent at all.
 *
 * Run: CRM_HANDOVER_TEST_DB=mongodb://127.0.0.1:<port>/crm_handover_e2e \
 *        bun --no-env-file test tests/finance/handoverKick.test.ts
 * CRM_HANDOVER_TEST_DB must point at a throwaway mongod; without it the whole
 * file is skipped (so `bun test tests/` never touches a database it was not
 * given), and it refuses anything not on 127.0.0.1/localhost named *e2e*.
 */
import { afterAll, describe, expect, it } from "bun:test";
import { createServer } from "node:http";

type Mode = "ok" | "slow" | "down" | "unauthorised";
let mode: Mode = "ok";
let received = 0;
const finance = createServer((req, res) => {
  const reply = (status: number, body: unknown) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  };
  req.resume();
  req.on("end", () => {
    if (req.url !== "/api/v1/integrations/enrolments") return reply(404, { error: { message: "Not found" } });
    if (mode === "down") return reply(503, { error: { message: "Finance is down" } });
    if (mode === "unauthorised") return reply(401, { error: { message: "Bad signature" } });
    received++;
    const ok = () => reply(200, { data: { invoiceId: `inv-${received}`, invoiceNumber: `IN-${String(received).padStart(5, "0")}`, customerId: "c", duplicate: false, flags: [] } });
    if (mode === "slow") setTimeout(ok, 400);
    else ok();
  });
});
await new Promise<void>((resolve) => finance.listen(0, "127.0.0.1", resolve));
const port = (finance.address() as { port: number }).port;

const TEST_DB = process.env.CRM_HANDOVER_TEST_DB ?? "";
process.env.MONGODB_URI = TEST_DB || "mongodb://127.0.0.1:1/unset_e2e";
process.env.JWT_SECRET = "handover-kick-test-jwt-secret-0123456789";
process.env.JWT_REFRESH_SECRET = "handover-kick-test-refresh-secret-0123456789";
process.env.FINANCE_API_URL = `http://127.0.0.1:${port}`;
process.env.FINANCE_CLIENT_ID = "crm-test";
process.env.FINANCE_INTEGRATION_SECRET = "handover-kick-test-integration-secret";
process.env.FINANCE_ORG_ID = "000000000000000000000001";

const mongoose = (await import("mongoose")).default;
if (TEST_DB) {
  await mongoose.connect(process.env.MONGODB_URI);
  const host = mongoose.connection.host;
  const dbName = mongoose.connection.db!.databaseName;
  if (!["127.0.0.1", "localhost"].includes(host) || !/e2e/.test(dbName)) {
    throw new Error(`Refusing to run: not a throwaway database (${host}/${dbName})`);
  }
  await mongoose.connection.dropDatabase();
}

const { env } = await import("../../src/config/env.js");
const { FinanceHandover } = await import("../../src/models/FinanceHandover.js");
const { kickFinanceHandover } = await import("../../src/services/financeHandoverWorker.js");

const MIN = 60_000;
const queue = async () => {
  const studentId = new mongoose.Types.ObjectId();
  // Lead and enrollment number are unique, so each stand-in student carries its own.
  await mongoose.connection.db!.collection("students").insertOne({
    _id: studentId, name: "Test Student", leadId: new mongoose.Types.ObjectId(), enrollmentNumber: `TEST-${studentId}`,
  });
  const row = await FinanceHandover.create({ studentId, payload: { student: String(studentId) }, status: "pending", nextAttemptAt: new Date() });
  return row._id;
};
const rowOf = async (id: unknown) => FinanceHandover.findById(id).lean();
/** Wait for a condition without ever sleeping past it; gives up after `ms`. */
const until = async (ok: () => Promise<boolean>, ms = 3000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await ok()) return true;
    await new Promise((r) => setTimeout(r, 50));
  }
  return false;
};
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

afterAll(async () => {
  if (TEST_DB) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
  finance.close();
});

describe.skipIf(!TEST_DB)("finance handover, sent when queued", () => {
  it("Case 1 — happy path: out within moments of being queued", async () => {
    mode = "ok";
    const id = await queue();
    kickFinanceHandover();
    expect(await until(async () => (await rowOf(id))?.status === "sent")).toBe(true);
    const row = await rowOf(id);
    expect(row?.invoiceNumber).toMatch(/^IN-\d+$/);
    const student = await mongoose.connection.db!.collection("students").findOne({ _id: row!.studentId });
    expect(student?.financeInvoiceNumber).toBe(row?.invoiceNumber);
  });

  it("Case 2 — edge: one queued mid-delivery goes out in the same burst", async () => {
    mode = "slow";
    const first = await queue();
    kickFinanceHandover();
    await wait(100); // the first is now in flight
    const second = await queue();
    kickFinanceHandover();
    expect(await until(async () => (await rowOf(first))?.status === "sent" && (await rowOf(second))?.status === "sent")).toBe(true);
  });

  it("Case 3 — error: finance down stays pending, and never waits past 15 minutes", async () => {
    mode = "down";
    const id = await queue();
    kickFinanceHandover();
    expect(await until(async () => ((await rowOf(id))?.attempts ?? 0) === 1)).toBe(true);
    let row = await rowOf(id);
    expect(row?.status).toBe("pending");
    const firstWait = new Date(row!.nextAttemptAt!).getTime() - Date.now();
    expect(firstWait).toBeGreaterThan(0.9 * MIN);
    expect(firstWait).toBeLessThan(1.1 * MIN);

    // Ninth failure: nine squared is 81 minutes — capped to 15.
    await FinanceHandover.updateOne({ _id: id }, { $set: { attempts: 8, nextAttemptAt: new Date() } });
    kickFinanceHandover();
    expect(await until(async () => ((await rowOf(id))?.attempts ?? 0) === 9)).toBe(true);
    row = await rowOf(id);
    const capped = new Date(row!.nextAttemptAt!).getTime() - Date.now();
    expect(row?.status).toBe("pending");
    expect(capped).toBeGreaterThan(14 * MIN);
    expect(capped).toBeLessThanOrEqual(15 * MIN);
  });

  it("Case 4 — auth: a refused signature is retried; not configured sends nothing", async () => {
    mode = "unauthorised";
    const refused = await queue();
    kickFinanceHandover();
    expect(await until(async () => ((await rowOf(refused))?.attempts ?? 0) === 1)).toBe(true);
    expect((await rowOf(refused))?.status).toBe("pending");

    mode = "ok";
    const url = env.FINANCE_API_URL;
    env.FINANCE_API_URL = "";
    const before = received;
    const idle = await queue();
    kickFinanceHandover();
    await wait(500);
    env.FINANCE_API_URL = url;
    expect(received).toBe(before);
    expect((await rowOf(idle))?.attempts ?? 0).toBe(0);
    expect((await rowOf(idle))?.status).toBe("pending");
  });
});
