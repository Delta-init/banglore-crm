export interface Course {
  /** The Delta Finance catalogue item this course is, once mapped. */
  financeItemId?: string | null;
  /** The first of `lmsCourseSlugs` — what a single-course reader sees. */
  lmsCourseSlug?: string;
  /** Every LMS course it opens, in order — two for a bundle. */
  lmsCourseSlugs?: string[];
  _id: string;
  name: string;
  description?: string;
  amount: number;
  /** The bonus a client gets with it, in INR like the amount; 0 (or missing, on one from before) for none. */
  bonusAmount?: number;
  /** The SAC code this course is billed under, for GST invoices. */
  hsnSac?: string;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
}

export interface CourseFilters {
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
}

/** A published course in the LMS, as the Map screen offers it. */
export interface LmsCourse {
  slug: string;
  title: string;
}

/** Every LMS course a course opens; a single mapping from before reads the same. */
export const lmsCoursesOf = (course: Pick<Course, "lmsCourseSlug" | "lmsCourseSlugs">): string[] =>
  course.lmsCourseSlugs?.length ? course.lmsCourseSlugs : course.lmsCourseSlug ? [course.lmsCourseSlug] : [];
