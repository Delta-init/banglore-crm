import { env } from "../config/env.js";

/**
 * The Delta LMS's public course list, for mapping a course onto the one(s) it
 * opens (the Courses page's "Map"). No secret needed: it is what anybody
 * browsing the LMS sees.
 */

const TIMEOUT_MS = 15_000;

/** Where finance enrols students, when this server has no LMS address of its own. */
const PUBLIC_LMS_URL = "https://api-lms.deltainstitutions.com";

export interface LmsCourse {
  slug: string;
  title: string;
}

/**
 * The LMS's published courses. This server's LMS address when it has one,
 * else the Delta LMS's — the one finance opens courses in. Throws when the LMS
 * cannot be read, so the Map screen says so rather than offering nothing.
 */
export async function listLmsCourses(): Promise<LmsCourse[]> {
  const base = (env.LMS_API_URL || PUBLIC_LMS_URL).replace(/\/+$/, "").replace(/\/api\/v1$/, "");
  let res: Response;
  try {
    res = await fetch(`${base}/api/v1/courses?per_page=100`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    throw Object.assign(new Error("The LMS could not be reached"), { statusCode: 502 });
  }
  if (!res.ok) throw Object.assign(new Error(`The LMS answered ${res.status} for its course list`), { statusCode: 502 });
  const body = (await res.json().catch(() => ({}))) as { data?: unknown };
  const data = body.data;
  const list = (Array.isArray(data)
    ? data
    : Array.isArray((data as { courses?: unknown[] } | undefined)?.courses)
      ? (data as { courses: unknown[] }).courses
      : []) as { slug?: unknown; title?: unknown; name?: unknown }[];
  return list
    .map((c) => ({ slug: String(c.slug ?? ""), title: String(c.title ?? c.name ?? "") }))
    .filter((c) => c.slug)
    .sort((a, b) => a.title.localeCompare(b.title));
}
