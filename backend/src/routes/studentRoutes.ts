import { Router } from "express";
import multer from "multer";
import { authenticate } from "../middleware/auth.js";
import { checkAnyPermission, checkPermission } from "../middleware/permissions.js";
import {
  createStudent, getStudents, getStudentById,
  getStudentByLeadId, updateStudent, deleteStudent,
  getMyEnrolments,
  getEnrolment, requestInvoice, getCorrection, correctEnrolment, uploadPaymentReceipt, checkEmail,
} from "../controllers/studentController.js";

const router = Router();

/**
 * A receipt is a photograph or a PDF of one, so the list is short and the
 * limit is what a phone camera produces rather than what a scanner can.
 */
const receiptUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    cb(new Error("A receipt must be a JPG, PNG, WebP, HEIC or PDF"));
  },
});

// Static before parameterized
router.get("/by-lead/:leadId", authenticate, checkPermission("students", "view"), getStudentByLeadId);

// Whether an email is another client's (one email, one client — 2026-10-10): asked
// by the close dialog and the correction dialog, so for whoever may do either.
// Before "/:id", or Express reads "email-check" as a student id.
router.get("/email-check", authenticate, checkAnyPermission(["students", "create"], ["enrolments", "edit"]), checkEmail);

// The enrolments screen: a counsellor's own sales, with the state of each
// invoice beside them, so the question does not have to be taken to finance.
// Its own module, not "students" — seeing your own sales is not the same
// grant as seeing the whole student list.
router.get("/enrolments/mine", authenticate, checkPermission("enrolments", "view"), getMyEnrolments);
// One enrolment, for its own page — before "/:id", which would take "enrolments" for a student id.
router.get("/enrolments/:id", authenticate, checkPermission("enrolments", "view"), getEnrolment);
// Before "/:id", or Express reads "receipts" as a student id. Taken at a close,
// and at the correction of one finance sent back.
router.post(
  "/receipts/:leadId",
  authenticate,
  checkAnyPermission(["students", "create"], ["enrolments", "edit"]),
  receiptUpload.single("file"),
  uploadPaymentReceipt,
);

// Generate the invoice — the same handover that runs when a lead closes,
// asked for by hand when it never ran or did not get through. Reached only
// from the enrolments screen, so it is gated the same way that screen is.
router.post("/:id/invoice", authenticate, checkPermission("enrolments", "edit"), requestInvoice);
// Correct an enrolment finance sent back, and send it again — from the same screen.
router.get("/:id/correction", authenticate, checkPermission("enrolments", "edit"), getCorrection);
router.put("/:id/correction", authenticate, checkPermission("enrolments", "edit"), correctEnrolment);

router.get("/",    authenticate, checkPermission("students", "view"),   getStudents);
router.post("/",   authenticate, checkPermission("students", "create"), createStudent);
router.get("/:id", authenticate, checkPermission("students", "view"),   getStudentById);
router.put("/:id", authenticate, checkPermission("students", "edit"),   updateStudent);
router.delete("/:id", authenticate, checkPermission("students", "delete"), deleteStudent);

export default router;
