import crypto from "node:crypto";
import { Role } from "../models/Role.js";
import { User } from "../models/User.js";
import { CRM_MODULES } from "../types/index.js";
import type { ModulePermissions } from "../types/index.js";

/**
 * Answering the Root portal's questions about this CRM's people.
 *
 * The portal is where access across the estate is decided: who may open what,
 * and as whom. It could already sign somebody in here, but it could not see
 * what it had done — the role it recorded was whatever an administrator had
 * typed into a box, and the two could drift apart for months with the portal
 * still reporting the one it remembered.
 *
 * So this answers three things: which roles this CRM actually has, what one
 * account actually holds, and — when asked — changes it. Provisioning is the
 * fourth, and deliberately separate: a grant says where somebody may go, and
 * creating an account makes them exist here, which is a larger act.
 */

const httpError = (message: string, statusCode: number) =>
  Object.assign(new Error(message), { statusCode });

export interface PortalRole {
  key: string;
  name: string;
  description: string;
  permissions: string[];
  isSystem: boolean;
}

/**
 * Permissions as a flat list the portal can show.
 *
 * They are stored here as a map of module to six booleans, which is right for
 * this application and useless to another one. "leads:create" reads the same
 * everywhere, and the portal shows it beside the role so that choosing one is
 * a decision about what somebody will be able to do rather than a guess from
 * its name.
 */
function flatten(permissions: Record<string, ModulePermissions> | undefined): string[] {
  const out: string[] = [];
  for (const mod of CRM_MODULES) {
    const p = permissions?.[mod];
    if (!p) continue;
    for (const action of ["view", "create", "edit", "delete", "approve", "export"] as const) {
      if (p[action]) out.push(`${mod}:${action}`);
    }
  }
  return out;
}

/**
 * The roles this CRM has.
 *
 * `key` and `name` are the same string. This CRM identifies a role by its
 * name and has no separate stable key, so inventing one here would be a
 * second identifier that nothing else in this application knows.
 */
export async function listRolesForPortal(): Promise<{ organization: string; roles: PortalRole[] }> {
  const roles = await Role.find({}).sort({ roleName: 1 }).lean();
  return {
    organization: "Banglore CRM",
    roles: roles.map((r) => ({
      key: r.roleName,
      name: r.roleName,
      description: r.description ?? "",
      permissions: flatten(r.permissions as Record<string, ModulePermissions> | undefined),
      isSystem: Boolean(r.isSystemRole),
    })),
  };
}

export interface PortalUserState {
  exists: boolean;
  inOrganization: boolean;
  name: string;
  email: string;
  status: string;
  membershipStatus: string | null;
  roleKey: string | null;
  roleName: string | null;
  permissions: string[];
  lastLoginAt: string | null;
}

/**
 * What an account actually holds here, right now.
 *
 * Answers "no such person" rather than erroring: the portal asks this about
 * everybody it knows, and most of them will legitimately have no account in
 * this CRM. A 404 would make the ordinary case look like a fault and bury the
 * real ones.
 */
export async function describeUserForPortal(email: string): Promise<PortalUserState> {
  const wanted = email.toLowerCase().trim();
  if (!wanted) throw httpError("email is required", 400);

  const blank: PortalUserState = {
    exists: false, inOrganization: false, name: "", email: wanted, status: "",
    membershipStatus: null, roleKey: null, roleName: null, permissions: [], lastLoginAt: null,
  };

  const user = await User.findOne({ email: wanted }).populate("role").lean();
  if (!user) return blank;

  const role = user.role as unknown as
    { roleName?: string; permissions?: Record<string, ModulePermissions> } | null;

  return {
    exists: true,
    // One organization per deployment here, so being present is being a member.
    inOrganization: true,
    name: user.name ?? "",
    email: user.email,
    status: user.status ?? "",
    membershipStatus: user.status ?? null,
    roleKey: role?.roleName ?? null,
    roleName: role?.roleName ?? null,
    permissions: flatten(role?.permissions),
    lastLoginAt: null,
  };
}

/** The role, matched the way a person would write it. */
async function findRole(name: string) {
  const wanted = name.trim();
  const role = await Role.findOne({
    roleName: new RegExp(`^${wanted.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
  });
  if (role) return role;

  const available = (await Role.find({}).select("roleName").lean()).map((r) => r.roleName).join(", ");
  throw httpError(`This CRM has no role "${wanted}". It has: ${available}.`, 400);
}

/**
 * Change what somebody is here, because the portal said so.
 *
 * Creates nothing. Provisioning is its own call and its own decision; if an
 * edit created accounts as a side effect, a typo in an email address would
 * quietly make a second one.
 */
export async function setUserRoleFromPortal(input: {
  email: string;
  role?: string;
  status?: string;
}): Promise<{ detail: string; roleKey: string; membershipStatus: string }> {
  const email = input.email.toLowerCase().trim();
  if (!email) throw httpError("email is required", 400);
  if (!input.role && !input.status) {
    throw httpError("Nothing to change: give a role, a status, or both", 400);
  }

  const user = await User.findOne({ email });
  if (!user) throw httpError(`${email} has no account in this CRM — create one first`, 404);

  const changes: string[] = [];

  if (input.role) {
    const role = await findRole(input.role);
    if (String(user.role) !== String(role._id)) {
      user.role = role._id;
      changes.push(`role to ${role.roleName}`);
    }
  }

  if (input.status) {
    const status = input.status.trim().toLowerCase();
    if (status !== "active" && status !== "inactive") {
      throw httpError(`"${status}" is not a status here`, 400);
    }
    if (user.status !== status) {
      user.status = status;
      changes.push(`status to ${status}`);
    }
  }

  if (changes.length) await user.save();

  const finalRole = await Role.findById(user.role).select("roleName").lean();
  return {
    detail: changes.length
      ? `Changed ${email}'s ${changes.join(" and ")}`
      : `${email} already held that`,
    roleKey: finalRole?.roleName ?? "",
    membershipStatus: user.status ?? "active",
  };
}

/**
 * Create an account here, because a root admin asked.
 *
 * Signing in from the portal deliberately refuses an unknown person: this
 * server believes whatever the portal vouches for, so an account appearing
 * because a token arrived would turn a spoofed portal into an instant
 * account. That refusal stands. This is the other half — an administrator,
 * deciding on purpose, one person at a time.
 *
 * The password is random and nobody is told it, including whoever asked for
 * the account. They arrive through the portal and never type one here;
 * setting something guessable, or something an administrator could pass on,
 * would quietly create a second way in that nobody is watching.
 */
export async function provisionFromPortal(input: {
  email: string;
  name: string;
  role: string;
}): Promise<{ created: boolean; userId: string; detail: string }> {
  const email = input.email.toLowerCase().trim();
  if (!email) throw httpError("email is required", 400);

  const role = await findRole(input.role);

  const existing = await User.findOne({ email });
  if (existing) {
    // Idempotent: the portal retries, and an administrator clicking twice
    // should not be an error they have to interpret.
    return {
      created: false,
      userId: String(existing._id),
      detail: `${email} already has an account in this CRM`,
    };
  }

  const user = await User.create({
    name: input.name?.trim() || email.split("@")[0],
    email,
    password: crypto.randomBytes(24).toString("hex"),
    role: role._id,
    status: "active",
  });

  return {
    created: true,
    userId: String(user._id),
    detail: `Created ${email} as ${role.roleName}`,
  };
}

export interface PortalUserSummary {
  email: string;
  exists: boolean;
  inOrganization: boolean;
  name: string;
  status: string;
  roleKey: string | null;
  roleName: string | null;
}

/**
 * At most this many addresses in one question.
 *
 * The portal asks about a page of its user list, which is twenty-five. The
 * cap is far above that so it never has to think about the limit, and low
 * enough that this endpoint cannot be turned into a way to sweep the whole
 * CRM one large request at a time.
 */
const MAX_EMAILS = 500;

/**
 * The same question as describeUserForPortal, asked about many people at once.
 *
 * The portal shows a column saying which systems each person actually has an
 * account on, across a page of its user list. Asked one at a time that is
 * twenty-five requests to each system for a single screen, so it is asked
 * once instead.
 *
 * Permissions are deliberately left out. They are the heaviest part of the
 * answer and a column showing which systems somebody is on does not use
 * them; whoever wants them opens that one person, where /user gives the full
 * picture.
 *
 * Every address asked about comes back, including the ones with no account.
 * The portal has to tell "asked, and there is nobody" apart from "never
 * answered" — those mean opposite things on the screen, and a response that
 * simply omitted the misses would make them indistinguishable.
 */
export async function describeManyForPortal(emails: unknown): Promise<{ accounts: PortalUserSummary[] }> {
  if (!Array.isArray(emails)) throw httpError("emails must be a list of addresses", 400);

  // Normalised and de-duplicated the same way a single lookup is, so that
  // asking about "A@x.com" and "a@x.com " is one question, answered once.
  const wanted: string[] = [];
  const seen = new Set<string>();
  for (const raw of emails) {
    if (typeof raw !== "string") continue;
    const email = raw.toLowerCase().trim();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    wanted.push(email);
  }

  if (wanted.length === 0) return { accounts: [] };
  if (wanted.length > MAX_EMAILS) {
    throw httpError(`At most ${MAX_EMAILS} addresses at a time, and ${wanted.length} were asked for`, 400);
  }

  // One query however many were asked for; `email` is indexed.
  const users = await User.find({ email: { $in: wanted } }).populate("role").lean();
  const byEmail = new Map(users.map((u) => [String(u.email).toLowerCase(), u]));

  return {
    accounts: wanted.map((email) => {
      const user = byEmail.get(email);
      if (!user) {
        return {
          email, exists: false, inOrganization: false,
          name: "", status: "", roleKey: null, roleName: null,
        };
      }
      const role = user.role as unknown as { roleName?: string } | null;
      return {
        email,
        exists: true,
        // One organization per deployment here, so being present is being a member.
        inOrganization: true,
        name: user.name ?? "",
        status: user.status ?? "",
        roleKey: role?.roleName ?? null,
        roleName: role?.roleName ?? null,
      };
    }),
  };
}
