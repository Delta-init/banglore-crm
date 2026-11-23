import mongoose, { Schema } from "mongoose";
import { ENROLMENT_LANGUAGES, ENROLMENT_PAYMENT_METHODS } from "../types/index.js";
import type { IStudent } from "../types/index.js";

const studentSchema = new Schema<IStudent>(
  {
    enrollmentNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    name: {
      type: String,
      required: [true, "Student name is required"],
      trim: true,
    },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    course: { type: Schema.Types.ObjectId, ref: "Course", default: null },
    team:   { type: Schema.Types.ObjectId, ref: "Team",   default: null },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User", default: null },
    leadId: { type: Schema.Types.ObjectId, ref: "Lead", required: true, unique: true },

    // Lead insight fields (copied from lead at enrollment time)
    initialLeadResponse:  {
      type: String,
      enum: ["very_interested", "not_interested", "let_me_think", null],
      default: null,
    },
    primaryConcern: {
      type: String,
      enum: ["risk", "price", "time", "trust", "exact_concern", null],
      default: null,
    },
    followupStrategyType: {
      type: String,
      enum: ["risk_based", "price_based", "time_based", "trust_based", null],
      default: null,
    },
    demoScheduled:    { type: Boolean, default: false },
    demoAttended:     { type: Boolean, default: false },
    firstContactTime: { type: Date,    default: null },
    lastFollowupDate: { type: Date,    default: null },

    // Enrollment & fee
    enrollmentDate: { type: Date, default: Date.now },
    feeStatus: {
      type: String,
      enum: ["paid", "partial", "pending"],
      default: "pending",
    },
    totalFee:     { type: Number, default: 0, min: 0 },
    paidAmount:   { type: Number, default: 0, min: 0 },
    pendingAmount:{ type: Number, default: 0, min: 0 },

    status: {
      type: String,
      enum: ["active", "inactive", "graduated", "dropped"],
      default: "active",
    },
    /**
     * Taken at the close, and required there.
     *
     * Optional in the schema because enrolments predating these fields exist
     * and must still load. The requirement lives where the close happens, so
     * old records are readable and new ones cannot be made without them.
     */
    language: { type: String, enum: ENROLMENT_LANGUAGES },
    paymentMethod: { type: String, enum: ENROLMENT_PAYMENT_METHODS },
    paymentReceipt: {
      name: { type: String },
      url: { type: String },
      // The object key, which is what finance is given: both applications
      // address the same bucket, so a receipt is one file, not two copies.
      key: { type: String },
      size: { type: Number },
      mimeType: { type: String },
      uploadedAt: { type: Date },
    },
    /**
     * Each payment taken at the close — a client may pay part in cash and part
     * by card, each with its own receipt (the user, 2026-10-05). They add up to
     * paidAmount; the first is also paymentMethod / paymentReceipt above.
     * Absent on enrolments from before.
     */
    payments: {
      type: [
        new Schema(
          {
            method: { type: String, enum: ENROLMENT_PAYMENT_METHODS, required: true },
            amount: { type: Number, required: true, min: 0.01 },
            receipt: {
              name: { type: String },
              url: { type: String },
              key: { type: String },
              size: { type: Number },
              mimeType: { type: String },
              uploadedAt: { type: Date },
            },
            paidAt: { type: Date, required: true },
            collectedBefore: { type: Boolean },
            /** Handed over in AED: how much, and at what rate (INR for 1 AED). `amount` is the INR. */
            original: {
              type: new Schema(
                {
                  currency: { type: String, enum: ["AED"], required: true },
                  amount: { type: Number, required: true, min: 0.01 },
                  rate: { type: Number, required: true, min: 0 },
                },
                { _id: false },
              ),
              default: undefined,
            },
          },
          { _id: false },
        ),
      ],
      default: undefined,
    },
    notes: { type: String, trim: true, maxlength: 2000 },
    /**
     * Whether the client was given a bonus with this enrolment, and how much.
     *
     * Asked at the close, and required there — yes or no, with the amount when
     * yes. Information beside the money, never in it: the bonus is not part of
     * the fee, of what was paid, or of the balance (fee − paid). Unset on
     * enrolments from before it was asked, which is different from "no".
     */
    hasBonus: { type: Boolean },
    /** In US dollars, like the course bonus (2026-10-09); sent to finance as USD. */
    bonusAmount: { type: Number, min: 0, default: 0 },

    /*
     * Where this enrolment ended up in Delta Finance.
     *
     * Written by the handover worker once the invoice exists. Kept so somebody
     * looking at a student can see which invoice it became without opening the
     * other system — and so a student with no invoice is visibly a student with
     * no invoice, rather than one nobody thought to check.
     */
    financeInvoiceId: { type: String },
    financeInvoiceNumber: { type: String },
    financeSyncedAt: { type: Date },

    /*
     * Course changes asked of finance once it approved the enrolment (the user, 2026-11-23: a closed lead was reopened,
     * put on a cheaper course and closed again — finance never heard, and the invoice kept the old course and price).
     * The course and fee of an enrolment in finance change only through one of these: asked here, decided in finance's
     * Approvals, and applied here once approved (courseChangeService.ts). Oldest first; one pending at a time.
     */
    courseChanges: {
      type: [
        new Schema(
          {
            /** This CRM's id for the request, which finance keeps it under — a retry is the same request. */
            externalId: { type: String, required: true },
            /** Null for one taken from finance whose course isn't a course here (its record here was lost). */
            courseId: { type: Schema.Types.ObjectId, ref: "Course", default: null },
            courseName: { type: String, required: true },
            /** The new fee, in INR like every fee here. */
            fee: { type: Number, required: true, min: 0.01 },
            reason: { type: String, required: true },
            status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
            requestedBy: {
              id: { type: Schema.Types.ObjectId, ref: "User" },
              name: { type: String },
            },
            requestedAt: { type: Date, required: true },
            /** Who decided in finance, and when — as finance says. */
            decidedBy: { type: String },
            decidedAt: { type: Date },
            /** The approver's note, if any. */
            note: { type: String },
            rejectReason: { type: String },
            /** When the approved change was made here — the student and the lead. Once. */
            appliedAt: { type: Date },
          },
          { _id: false },
        ),
      ],
      default: undefined,
    },
    /*
     * When a course change was last sent to finance from here — set before it goes, so a request finance kept while
     * this CRM never heard back (a timeout) is still looked for and taken from finance's answer. Cleared once nothing
     * is open (courseChangeService.syncCourseChanges).
     */
    courseChangeAskedAt: { type: Date },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

studentSchema.index({ leadId: 1 }, { unique: true });
studentSchema.index({ enrollmentNumber: 1 }, { unique: true });
studentSchema.index({ course: 1 });
studentSchema.index({ team: 1 });
studentSchema.index({ assignedTo: 1 });
studentSchema.index({ status: 1 });
studentSchema.index({ feeStatus: 1 });
studentSchema.index({ createdAt: -1 });

export const Student = mongoose.model<IStudent>("Student", studentSchema);
