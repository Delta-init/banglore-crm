import { createHash, createHmac, randomBytes } from "node:crypto";
import { env } from "../config/env.js";

/* ────────────────────────────────────────────────────────────────────────────
   The HRMS's signed integration API (/api/v1/integrations/…), as the other
   sales CRMs call it (2026-11-04, for My Wallet): X-Delta-Client, -Timestamp,
   -Nonce and -Signature — an HMAC of METHOD \n PATH_WITH_QUERY \n TIMESTAMP \n
   NONCE \n sha256(body), byte for byte the HRMS's (a mismatch is a blanket 401).
   A 4xx comes back as an HrmsError carrying the HRMS's status and message; the
   HRMS out of reach or failing is a 503; its refusing this server's signature
   is a 502 (never a 401, which the web would read as the person's own session
   ending).
──────────────────────────────────────────────────────────────────────────── */

const TIMEOUT_MS = 8_000;
const apiUrl = () => env.HRMS_API_URL.replace(/\/+$/, "").replace(/\/api\/v1$/, "");

export const hrmsConfigured = (): boolean => !!(env.HRMS_API_URL && env.HRMS_CLIENT_ID && env.HRMS_INTEGRATION_SECRET);

/** A refusal from the HRMS, or the HRMS out of reach: `status` and `message` are fit to pass on as they are. */
export class HrmsError extends Error {
  readonly statusCode: number;
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "HrmsError";
    this.statusCode = status;
  }
}

function signedHeaders(method: string, signedPath: string, rawBody: string): Record<string, string> {
  const timestamp = String(Date.now());
  const nonce = randomBytes(16).toString("hex");
  const canonical = [method, signedPath, timestamp, nonce, createHash("sha256").update(rawBody).digest("hex")].join("\n");
  return {
    "X-Delta-Client": env.HRMS_CLIENT_ID,
    "X-Delta-Timestamp": timestamp,
    "X-Delta-Nonce": nonce,
    "X-Delta-Signature": createHmac("sha256", env.HRMS_INTEGRATION_SECRET).update(canonical).digest("hex"),
  };
}

/** One signed request; the answer's `data`. Throws an HrmsError (see above). */
export async function hrmsRequest<T>(
  method: "GET" | "POST" | "DELETE",
  path: string,
  query: Record<string, string> = {},
  body?: unknown,
  /** Longer for an answer the HRMS has to ask finance for first — the wallet. */
  timeoutMs: number = TIMEOUT_MS,
): Promise<T> {
  const qs = new URLSearchParams(query).toString();
  const signedPath = `/api/v1/integrations${path}${qs ? `?${qs}` : ""}`;
  const rawBody = body === undefined ? "" : JSON.stringify(body);
  let res: Response;
  try {
    res = await fetch(`${apiUrl()}${signedPath}`, {
      method,
      headers: { ...signedHeaders(method, signedPath, rawBody), ...(rawBody ? { "Content-Type": "application/json" } : {}) },
      ...(rawBody ? { body: rawBody } : {}),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new HrmsError("The HRMS could not be reached — try again in a moment", 503);
  }
  const answer = (await res.json().catch(() => null)) as { data?: T; message?: unknown } | null;
  const said = answer && typeof answer.message === "string" && answer.message.trim() ? answer.message.trim() : "";
  if (res.status === 401) throw new HrmsError("The HRMS refused this server's credentials (HRMS_CLIENT_ID / HRMS_INTEGRATION_SECRET)", 502);
  if (res.status >= 500) throw new HrmsError(`The HRMS isn't answering right now (${res.status}) — try again in a moment`, 503);
  if (!res.ok) throw new HrmsError(said || `The HRMS refused this (${res.status})`, res.status);
  if (!answer || typeof answer !== "object" || !("data" in answer)) throw new HrmsError("The HRMS's answer wasn't its API — check HRMS_API_URL", 502);
  return answer.data as T;
}
