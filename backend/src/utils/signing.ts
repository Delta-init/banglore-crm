import crypto from "node:crypto";

/**
 * The canonical string both ends of the finance integration sign.
 *
 * Its counterpart is `buildCanonical` in the finance repo's
 * `apps/api/src/lib/signing.ts`. Change one and you must change both — the
 * failure it guards against is the two repos disagreeing by a single character
 * about what gets signed, which shows up only as a blanket 401 that explains
 * nothing.
 *
 *   METHOD \n PATH_WITH_QUERY \n TIMESTAMP \n NONCE \n sha256(body)
 */
export function buildCanonical(
  method: string,
  url: string,
  timestamp: string,
  nonce: string,
  rawBody: string,
): string {
  const bodyHash = crypto.createHash("sha256").update(rawBody).digest("hex");
  return [method.toUpperCase(), url, timestamp, nonce, bodyHash].join("\n");
}

export function signRequest(
  secret: string,
  method: string,
  url: string,
  timestamp: string,
  nonce: string,
  rawBody: string,
): string {
  return crypto
    .createHmac("sha256", secret)
    .update(buildCanonical(method, url, timestamp, nonce, rawBody))
    .digest("hex");
}
