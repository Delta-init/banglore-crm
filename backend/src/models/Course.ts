import mongoose, { Schema } from "mongoose";
import type { ICourse } from "../types/index.js";

const courseSchema = new Schema<ICourse>(
  {
    name: {
      type: String,
      required: [true, "Course name is required"],
      trim: true,
      maxlength: [150, "Course name cannot exceed 150 characters"],
      unique: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, "Description cannot exceed 1000 characters"],
    },
    amount: {
      type: Number,
      required: [true, "Course amount is required"],
      min: [0, "Amount cannot be negative"],
    },
    /**
     * The bonus a client gets with this course, in INR, like the
     * amount; 0 when it comes with none. A new close starts from it — the
     * seller still answers, and can change it for a sale that differs.
     */
    bonusAmount: { type: Number, min: [0, "Bonus cannot be negative"], default: 0 },

    /*
     * The catalogue item this course is in Delta Finance.
     *
     * Set once, on the mapping screen, rather than matched by name — "Digital
     * Marketing" and "Digital Marketing (Evening)" are one course to a name
     * match and two to anybody reading them.
     *
     * A course without one still enrols: the invoice carries a plain line with
     * the name and price. Refusing until somebody finishes the mapping would
     * stop a sale for a piece of housekeeping.
     */
    financeItemId: { type: String, default: null },
    /**
     * Which course this is in the LMS.
     *
     * Kept here as well as on the finance item, because the two answer to
     * different people: whoever sells the course knows which one it is, and
     * whoever keeps the books maps the item. Finance prefers its own mapping
     * and falls back to this one, so setting either is enough and setting both
     * is not a conflict.
     */
    lmsCourseSlug: { type: String, default: "", trim: true },
    /**
     * Every LMS course it opens, in order — two for a bundle like "MBT + DWT",
     * which is one course to sell and two to study. `lmsCourseSlug` is the
     * first of these, for anything that reads a single course. Set on the
     * Courses page ("Map") and sent with every enrolment, so finance opens
     * them all when the product it bills against has no LMS courses of its own.
     */
    lmsCourseSlugs: { type: [String], default: [] },

    /**
     * The SAC code this course is sold under.
     *
     * Per course, because it is a property of what is being sold: two courses
     * on one GST invoice can sit under different codes. Set here rather than in
     * finance because the person who knows which code a course belongs to is
     * the one who set the course up. Finance falls back to the mapped item's
     * code, then to the organization's default, so leaving it blank still
     * produces a valid invoice.
     */
    hsnSac: { type: String, default: "", trim: true },

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// `name` already declares unique on the field itself, which builds this same
// index. Declaring it twice changes nothing and warns on every boot, which
// trains people to read past warnings.
courseSchema.index({ status: 1 });

export const Course = mongoose.model<ICourse>("Course", courseSchema);
