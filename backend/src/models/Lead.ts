import mongoose, { Schema } from "mongoose";
import type { ILead, ILeadNote, IActivityLog, IReminder, IPayment } from "../types/index.js";

// ─── Note Sub-Schema ──────────────────────────────────────────────────────────
const leadNoteSchema = new Schema<ILeadNote & { createdAt: Date; updatedAt: Date }>(
  {
    content: {
      type: String,
      required: [true, "Note content is required"],
      trim: true,
      maxlength: [2000, "Note cannot exceed 2000 characters"],
    },
    author: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Note author is required"],
    },
  },
  {
    timestamps: true,
    _id: true,
  }
);

// ─── Activity Log Sub-Schema ──────────────────────────────────────────────────
const activityLogSchema = new Schema<IActivityLog>(
  {
    action: {
      type: String,
      required: true,
      enum: [
        "lead_created",
        "lead_updated",
        "status_changed",
        "lead_assigned",
        "team_assigned",
        "note_added",
        "note_updated",
        "note_deleted",
      ],
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    performedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    changes: {
      type: Schema.Types.Mixed,
      default: undefined,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true, timestamps: false }
);

// ─── Reminder Sub-Schema ──────────────────────────────────────────────────────
const reminderSchema = new Schema<IReminder>(
  {
    title: {
      type: String,
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    note: {
      type: String,
      trim: true,
      maxlength: [1000, "Note cannot exceed 1000 characters"],
    },
    remindAt: {
      type: Date,
      required: [true, "Reminder date/time is required"],
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isDone: {
      type: Boolean,
      default: false,
    },
    // Stamped by the server scheduler once the on-time push is sent
    notifiedAt: {
      type: Date,
      default: null,
    },
    // Stamped by the server scheduler once the 30-min warning push is sent
    warnedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: true, timestamps: true }
);

// ─── Payment Sub-Schema ───────────────────────────────────────────────────────
const paymentSchema = new Schema<IPayment>(
  {
    amount: {
      type: Number,
      required: [true, "Payment amount is required"],
      min: [0, "Amount cannot be negative"],
    },
    note: {
      type: String,
      trim: true,
      maxlength: [500, "Note cannot exceed 500 characters"],
    },
    paidAt: {
      type: Date,
      required: [true, "Payment date is required"],
      default: Date.now,
    },
    addedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { _id: true, timestamps: true }
);

// ─── Lead Schema ──────────────────────────────────────────────────────────────
const leadSchema = new Schema<ILead>(
  {
    name: {
      type: String,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email"],
    },
    phone: {
      type: String,
      required: [true, "Phone is required"],
      trim: true,
    },
    hasWhatsapp: {
      type: Boolean,
      default: true,
    },
    source: {
      type: String,
      trim: true,
      maxlength: [100, "Source cannot exceed 100 characters"],
    },
    course: {
      type: Schema.Types.ObjectId,
      ref: "Course",
      default: null,
    },
    status: {
      type: String,
      enum: ["new", "assigned", "pending_response", "followup", "closed", "lost", "not_connected", "mia", "repeated", "callback", "cnc"],
      default: "new",
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    assignedAt: {
      type: Date,
      default: null,
    },
    team: {
      type: Schema.Types.ObjectId,
      ref: "Team",
      default: null,
    },
    reporter: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Reporter is required"],
    },
    notes: {
      type: [leadNoteSchema],
      default: [],
    },
    reminders: {
      type: [reminderSchema],
      default: [],
    },
    payments: {
      type: [paymentSchema],
      default: [],
    },
    activityLogs: {
      type: [activityLogSchema],
      default: [],
    },
    platform: {
      type: String,
      trim: true,
      maxlength: [50, "Platform cannot exceed 50 characters"],
    },
    campaign: {
      type: String,
      trim: true,
      maxlength: [200, "Campaign cannot exceed 200 characters"],
    },
    callNotConnected: {
      type: Number,
      default: 0,
      min: [0, "Call not connected count cannot be negative"],
    },
    callCount: {
      type: Number,
      default: 0,
      min: [0, "Call count cannot be negative"],
    },
    firstContactTime: {
      type: Date,
      default: null,
    },
    initialLeadResponse: {
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
    sellingAmount: {
      type: Number,
      default: null,
      min: [0, "Selling amount cannot be negative"],
    },
    // ─── Legacy import fields ──────────────────────────────────────────────────
    leadReceivedTime: {
      type: String,
      trim: true,
      maxlength: [50, "Lead received time cannot exceed 50 characters"],
      default: null,
    },
    exactConcern: {
      type: String,
      trim: true,
      maxlength: [1000, "Exact concern cannot exceed 1000 characters"],
      default: null,
    },
    demoScheduled: {
      type: Boolean,
      default: null,
    },
    demoAttended: {
      type: Boolean,
      default: null,
    },
    lastFollowupDate: {
      type: Date,
      default: null,
    },
    comments: {
      type: String,
      trim: true,
      maxlength: [2000, "Comments cannot exceed 2000 characters"],
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

leadSchema.index({ course: 1 });

// Sparse unique index on email (allows multiple nulls)
leadSchema.index({ email: 1 });
leadSchema.index({ status: 1 });
leadSchema.index({ assignedTo: 1 });
leadSchema.index({ team: 1 });
leadSchema.index({ reporter: 1 });
leadSchema.index({ createdAt: -1 });

export const Lead = mongoose.model<ILead>("Lead", leadSchema);
