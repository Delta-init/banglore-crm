import type { Request, Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../types/index.js";
import { StudentService } from "../services/studentService.js";
import { sendSuccess, sendError } from "../utils/response.js";

const svc = new StudentService();

export const createStudent = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const student = await svc.createStudent(req.body, req.user?.userId);
    sendSuccess(res, "Student created", student, 201);
  } catch (err) { next(err); }
};

/**
 * Whether an email can be this client's, or another client here holds it (the
 * user, 2026-10-10: one email, one client — finance files an enrolment under
 * whoever has its email). Asked by the close dialog and the correction dialog
 * before they save; the close and the correction refuse it regardless.
 *
 * GET /api/v1/students/email-check?email=&leadId= | &studentId=[&name=&phone=]
 *   → { ok, takenBy?: { kind, name, code? }, message? }
 */
export const checkEmail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = req.query as Record<string, unknown>;
    const result = await svc.checkEmail({ email: q.email, leadId: q.leadId, studentId: q.studentId, name: q.name, phone: q.phone });
    sendSuccess(res, result.ok ? "Nobody else has this email" : result.message ?? "This email is someone else's", result);
  } catch (err) { next(err); }
};

export const getStudents = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await svc.getStudents(req.query as Record<string, string>);
    res.json({ success: true, data: result.students, pagination: result.pagination });
  } catch (err) { next(err); }
};

export const getStudentById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const student = await svc.getStudentById(req.params.id);
    sendSuccess(res, "Student fetched", student);
  } catch (err) { next(err); }
};

export const getStudentByLeadId = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const student = await svc.getStudentByLeadId(req.params.leadId);
    sendSuccess(res, "Student fetched", student ?? null);
  } catch (err) { next(err); }
};

export const updateStudent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const student = await svc.updateStudent(req.params.id, req.body);
    sendSuccess(res, "Student updated", student);
  } catch (err) { next(err); }
};

export const deleteStudent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await svc.deleteStudent(req.params.id);
    sendSuccess(res, "Student deleted", { deleted: result });
  } catch (err) { next(err); }
};

/**
 * The caller's own enrolments, each carrying what finance made of it.
 *
 * Scoped to the caller unless they ask otherwise: the screen this serves is
 * called "My Enrolments", and a counsellor opening it wants their own sales,
 * not the whole book.
 */
export const getMyEnrolments = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return sendError(res, "Not authenticated", 401);
    const result = await svc.listEnrolments({
      ...(req.query as Record<string, string>),
      userId,
    });
    res.json({
      success: true,
      data: result.rows,
      counts: result.counts,
      pagination: result.pagination,
    });
  } catch (err) { next(err); }
};

/**
 * One enrolment, for its own page: its steps (finance, LMS) with who did each
 * and when.
 *
 * GET /api/v1/students/enrolments/:id
 */
export const getEnrolment = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return sendError(res, "Not authenticated", 401);
    const enrolment = await svc.getEnrolment(req.params.id, { userId, role: req.user?.role as never });
    sendSuccess(res, "Enrolment fetched", enrolment);
  } catch (err) { next(err); }
};

/**
 * Take the payment receipt, before the enrolment that will carry it exists.
 *
 * Uploaded on its own rather than as part of the close, because the close
 * creates a student and hands it to finance in one go, and a multipart body
 * carrying both a file and the enrolment would have to be unpicked before
 * either could be validated. This returns a stored file; the close is then the
 * same JSON it always was, with the receipt named in it.
 *
 * Keyed under the lead, since that is what exists at the time.
 */
export const uploadPaymentReceipt = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const file = req.file;
    if (!file) return sendError(res, "No file was uploaded", 400);

    const { storageConfigured, uploadFile } = await import("../lib/storage.js");
    if (!storageConfigured()) {
      return sendError(res, "File storage is not configured, so a receipt cannot be taken", 503);
    }

    // The uploader's filename never becomes the key. It is theirs to choose,
    // and a key built from it could otherwise reach outside this prefix.
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
    const leadId = String(req.params.leadId ?? "unfiled");
    const uploaded = await uploadFile({
      key: `enrolment-receipts/${leadId}/${Date.now()}-${safe}`,
      buffer: file.buffer,
      mimeType: file.mimetype,
      originalName: file.originalname,
    });

    sendSuccess(res, "Receipt uploaded", {
      name: file.originalname.slice(0, 200),
      url: uploaded.url,
      key: uploaded.key,
      size: uploaded.size,
      mimeType: uploaded.mimeType,
    });
  } catch (err) { next(err); }
};

/** Send an enrolment to finance, or send it again after a failure. */
export const requestInvoice = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await svc.requestInvoice(req.params.id);
    if (!result.queued) return sendError(res, result.message, 409);
    sendSuccess(res, result.message, { queued: true });
  } catch (err) { next(err); }
};

/**
 * What the correction form starts from: the enrolment, whether finance has it
 * sent back and why, the money the lead holds of its own, and — for whoever
 * may move a sale — the counsellors and teams.
 *
 * GET /api/v1/students/:id/correction
 */
export const getCorrection = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return sendError(res, "Not authenticated", 401);
    const data = await svc.getCorrection(req.params.id, { userId, role: req.user?.role });
    sendSuccess(res, "Correction fetched", data);
  } catch (err) { next(err); }
};

/**
 * Correct an enrolment finance sent back — everything the close took — and
 * send it to finance again, in one step.
 *
 * PUT /api/v1/students/:id/correction
 */
export const correctEnrolment = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return sendError(res, "Not authenticated", 401);
    const result = await svc.correctEnrolment(req.params.id, req.body ?? {}, { userId, role: req.user?.role });
    sendSuccess(res, result.message, result.student);
  } catch (err) { next(err); }
};
