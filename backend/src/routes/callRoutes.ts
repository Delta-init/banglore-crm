import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { authenticateDeviceKey } from "../middleware/apiKeyAuth.js";
import {
  getLeadCalls,
  getRecentCalls,
  getQcQueue,
  updateQc,
  getCallById,
  logClickToCall,
  contactLookup,
  contactSearch,
  contactCreate,
  journalCall,
  webhookJournal,
  get3cxTemplate,
  uploadRecording,
  recordingUpload,
} from "../controllers/callController.js";

const router = Router();

// ── Public routes — called by 3CX (no auth token) ────────────────────────────
router.get("/contact-lookup",  contactLookup);
router.get("/contact-search",  contactSearch);
router.post("/contact-create", contactCreate);
router.post("/journal",        journalCall);
router.get("/webhook",         webhookJournal);
router.post("/webhook",        webhookJournal);
router.get("/3cx-template",    get3cxTemplate);

// ── Device API key route — called by CallRecorder Android app ────────────────
// MUST be before /:callId to avoid route collision
router.post(
  "/upload-recording",
  authenticateDeviceKey,
  recordingUpload,
  uploadRecording,
);

// ── Authenticated routes — static BEFORE parameterised /:callId ──────────────
router.post("/click",           authenticate, logClickToCall);
router.get("/recent",           authenticate, getRecentCalls);
router.get("/qc-queue",         authenticate, getQcQueue);
router.get("/lead/:leadId",     authenticate, getLeadCalls);

// ── Parameterised ────────────────────────────────────────────────────────────
router.get("/:callId",          authenticate, getCallById);
router.put("/:callId/qc",       authenticate, updateQc);

export default router;
