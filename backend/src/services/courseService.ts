import { Course } from "../models/Course.js";
import { buildPagination } from "../utils/response.js";
import type { ICourse } from "../types/index.js";

export interface CourseFilters {
  search?: string;
  status?: string;
  page?: string;
  limit?: string;
}

/** Where a course maps: finance's product, and the LMS course(s) it opens. */
export interface CourseMapping {
  /** The finance catalogue item's id; "" or null unmaps it; undefined leaves it. */
  financeItemId?: string | null;
  /** Every LMS course it opens, in order; [] unmaps it; undefined leaves it. */
  lmsCourseSlugs?: string[];
}

/**
 * The fields to store for a mapping: nothing for a side the caller did not
 * mention, and the LMS list (trimmed, no repeats) with its first as
 * `lmsCourseSlug` — what everything reading a single course reads.
 */
function mappingFields(mapping: CourseMapping): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  // "" is how a form says "no item"; stored as null rather than an empty id
  if (mapping.financeItemId !== undefined) fields.financeItemId = mapping.financeItemId || null;
  if (mapping.lmsCourseSlugs !== undefined) {
    const slugs = [...new Set(mapping.lmsCourseSlugs.map((s) => s.trim()).filter(Boolean))];
    fields.lmsCourseSlugs = slugs;
    fields.lmsCourseSlug = slugs[0] ?? "";
  }
  return fields;
}

export class CourseService {
  // ── Create ──────────────────────────────────────────────────────────────────
  async createCourse(data: { name: string; description?: string; amount: number; bonusAmount?: number; status?: string } & CourseMapping) {
    const { financeItemId, lmsCourseSlugs, ...rest } = data;
    const course = await Course.create({ ...rest, ...mappingFields({ financeItemId, lmsCourseSlugs }) });
    return course;
  }

  // ── List ─────────────────────────────────────────────────────────────────────
  async getCourses(filters: CourseFilters) {
    const page = Math.max(1, parseInt(filters.page ?? "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(filters.limit ?? "20", 10)));
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {};

    if (filters.status) query.status = filters.status;

    if (filters.search) {
      const regex = new RegExp(filters.search, "i");
      query.$or = [{ name: regex }, { description: regex }];
    }

    const [courses, total] = await Promise.all([
      Course.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Course.countDocuments(query),
    ]);

    return { courses, pagination: buildPagination(total, page, limit) };
  }

  // ── Get All (for dropdowns) ──────────────────────────────────────────────────
  async getAllCourses() {
    return Course.find({ status: "active" }).sort({ name: 1 }).lean();
  }

  // ── Get by ID ────────────────────────────────────────────────────────────────
  async getCourseById(id: string) {
    const course = await Course.findById(id);
    if (!course)
      throw Object.assign(new Error("Course not found"), { statusCode: 404 });
    return course;
  }

  // ── Update ───────────────────────────────────────────────────────────────────
  async updateCourse(
    id: string,
    data: Partial<{
      name: string;
      description: string;
      amount: number;
      bonusAmount: number;
      status: string;
    }> & CourseMapping,
  ) {
    const course = await Course.findById(id);
    if (!course)
      throw Object.assign(new Error("Course not found"), { statusCode: 404 });

    const { financeItemId, lmsCourseSlugs, ...rest } = data;
    Object.assign(course, rest, mappingFields({ financeItemId, lmsCourseSlugs }));
    await course.save();
    return course;
  }

  // ── Delete ───────────────────────────────────────────────────────────────────
  async deleteCourse(id: string) {
    const course = await Course.findById(id);
    if (!course)
      throw Object.assign(new Error("Course not found"), { statusCode: 404 });
    await Course.findByIdAndDelete(id);
    return { message: "Course deleted successfully" };
  }
}
