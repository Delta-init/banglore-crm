/* ─────────────────────────────────────────────────────────────────────────────
   One email, one client (the user, 2026-10-10).

   Finance knows a client by their email alone: an enrolment sent with an email
   that another client already has there is filed under that other client — their
   name, their phone, their invoices — and a correction that keeps it renames
   them. So an email is "taken" for a client when another record in this CRM
   holds it and is somebody else, and a close or a correction is refused with it.

   Who is somebody else: when both phones are known, a different number (its last
   nine digits, so +971 50…, 00971 50… and 050… are one number); when either is
   missing, a different name (case and spaces aside). The same phone is the same
   person — a second course is ordinary.

   Only what can be worked out from the records themselves lives here, nothing
   that reads the database: scripts/shared-emails-report.ts uses it against the
   live data and must not load the models.
───────────────────────────────────────────────────────────────────────────── */

/** An email as it is compared: trimmed and lower-cased, otherwise exact. */
export const emailKey = (v: unknown): string => String(v ?? "").trim().toLowerCase();

/** A phone as it is compared: its last nine digits. "" when it has none — not known. */
export const phoneKey = (v: unknown): string => String(v ?? "").replace(/\D/g, "").slice(-9);

/** A name as it is compared: trimmed, and case and spaces aside. */
export const nameKey = (v: unknown): string => String(v ?? "").toLowerCase().replace(/\s+/g, "");

export interface Person {
  name?: string | null;
  phone?: string | null;
}

/**
 * Whether two records are the same person: by phone when both have one, else by
 * name. (A student and the lead it was closed from are always the same person —
 * that is for whoever asks to say, by leaving its own lead and student out.)
 */
export function samePerson(a: Person, b: Person): boolean {
  const pa = phoneKey(a.phone);
  const pb = phoneKey(b.phone);
  if (pa && pb) return pa === pb;
  return nameKey(a.name) === nameKey(b.name);
}

/*
 * A made-up email (the user, 2026-10-29): noemail@gmail.com and the like, typed
 * when the client gave none. Finance and the CS Portal tell clients apart by
 * their email, so two closes with one such address became one client — Najad
 * Ahmed's invoice and his $500 bonus went to Mohammed Lebbie. Refused wherever
 * a taken email is: it stands for nobody, so it is everybody's.
 */
const MADE_UP_NAME =
  /^(no[-_.]?e?[-_.]?mails?([-_.]?id)?|no[-_.]?mail[-_.]?address|none|nil|null|na|n[-_.]a|not[-_.]?available|not[-_.]?given|unknown|dummy|test(ing)?|example|sample|fake|abc|xyz|asdf|no[-_.]?reply|nothing)[-_.]?\d*$/;
const MADE_UP_DOMAIN = /^(noemail|nomail|no-email)\.com$/;

/** Whether an email is a made-up one: its name before the @ (noemail, none, na, test…) or its domain (noemail.com). */
export function madeUpEmail(v: unknown): boolean {
  const key = emailKey(v);
  const at = key.lastIndexOf("@");
  if (at <= 0) return false;
  return MADE_UP_NAME.test(key.slice(0, at)) || MADE_UP_DOMAIN.test(key.slice(at + 1));
}

/** Whoever else holds an email: a student, by its enrolment number, or a lead, by its name — or, for a made-up one, nobody (`name` is the email). */
export interface EmailHolder {
  kind: "student" | "lead" | "made_up";
  id: string;
  name: string;
  /** The student's enrolment number (STU-0021). Never set for a lead. */
  code?: string;
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** For a database query matching an email however it was stored: any case, stray spaces. */
export const emailPattern = (email: string): RegExp => new RegExp(`^\\s*${escapeRegex(emailKey(email))}\\s*$`, "i");

/**
 * What the close, the correction and the email check say when an email is
 * somebody else's — naming them, never their phone: "This email is already used
 * by mohammed lebbie (STU-0021), a different client — enter Halif's own email."
 */
export function takenMessage(holder: Pick<EmailHolder, "kind" | "name" | "code">, clientName?: string | null): string {
  if (holder.kind === "made_up") {
    const client = String(clientName ?? "").trim();
    return `${holder.name} is a made-up email — enter ${client ? `${client}'s` : "the client's"} own email. Finance and the CS Portal tell clients apart by their email, so a made-up one makes different clients one.`;
  }
  const name = String(holder.name ?? "").trim();
  const who = holder.kind === "student"
    ? `${name || "another client"}${holder.code ? ` (${holder.code})` : ""}`
    : name ? `${name} (a lead)` : "an unnamed lead";
  const client = String(clientName ?? "").trim();
  return `This email is already used by ${who}, a different client — enter ${client ? `${client}'s` : "the client's"} own email.`;
}

/** An email shown without giving it away: its first two characters, then ***@domain. */
export function maskEmail(email: string): string {
  const key = emailKey(email);
  const at = key.lastIndexOf("@");
  if (at < 0) return `${key.slice(0, 2)}***`;
  return `${key.slice(0, Math.min(2, at))}***${key.slice(at)}`;
}
