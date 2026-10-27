import { z } from "zod";

const envSchema = z.object({
  PORT: z.string().default("5000"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  JWT_SECRET: z.string().min(1, "JWT_SECRET is required"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  JWT_REFRESH_SECRET: z.string().min(1, "JWT_REFRESH_SECRET is required"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("30d"),

  /* The shared secret the Root portal presents when it asks this CRM about
     its roles or its people. Unset means those endpoints are off, rather
     than open — a deployment that has not been told about the portal must
     not expose its whole user list by default. Must match the portal's
     BANGLORE_SSO_SECRET. */
  ROOT_ERP_SECRET: z.string().default(""),
  SUPER_ADMIN_NAME: z.string().default("Super Admin"),
  SUPER_ADMIN_EMAIL: z.string().email().default("superadmin@crm.com"),
  SUPER_ADMIN_PASSWORD: z.string().default("SuperAdmin@123"),
  CLIENT_URL: z.string().default("http://localhost:3000"),
  VAPID_PUBLIC_KEY: z.string().default(""),
  VAPID_PRIVATE_KEY: z.string().default(""),
  VAPID_SUBJECT: z.string().default("mailto:admin@DELTA BANGLOREcrm.com"),
  GEMINI_API_KEY: z.string().default(""),
  TELEGRAM_BOT_TOKEN: z.string().default(""),
  TELEGRAM_CHAT_ID: z.string().default(""),
  CALL_RECORDER_API_KEY: z.string().default(""),

  /**
   * Whether this process runs the timed jobs (reminders, the lead split, the
   * backup). A second process against the same database — a local copy pointed
   * at production — would do all of it a second time; set false there. The
   * finance handover worker is outside this: finance is idempotent on the
   * CRM's own id, so a second one cannot double-bill.
   */
  RUN_SCHEDULERS: z
    .string()
    .default("true")
    .transform((v) => v !== "false" && v !== "0"),

  /*
   * Delta Finance, where a closed lead becomes an invoice (Banglore's
   * organisation, which keeps its books in INR).
   *
   * All four empty means the handover is off: students are still created and
   * nothing is queued. It is on only when every field is set.
   */
  FINANCE_API_URL:            z.string().default(""),
  FINANCE_CLIENT_ID:          z.string().default(""),
  FINANCE_INTEGRATION_SECRET: z.string().default(""),
  /** Which organization in finance these enrolments belong to. */
  FINANCE_ORG_ID:             z.string().default(""),

  /**
   * The Delta LMS, read only for its public course list on the course mapping
   * screen. Unset, the public Delta LMS address is used.
   */
  LMS_API_URL: z.string().default(""),
  /**
   * The mentor calendar (2026-10-17): the LMS's service secret for the sales CRMs (its SALES_CRM_SECRET), and which
   * academy this CRM is — the Bangalore Academy unless told otherwise. Unset secret: the page says it is not set up.
   */
  LMS_SERVICE_SECRET: z.string().default(""),
  LMS_REMOTE_ORG_ID: z.string().default("6a674c5404d2749585961f29"),

  /**
   * Object storage for payment receipts — the same bucket finance uses, with
   * the same variable names, so finance attaches the very file the close
   * uploaded. Unset, a receipt cannot be taken and the close says so.
   */
  R2_ACCOUNT_ID:        z.string().default(""),
  R2_ACCESS_KEY_ID:     z.string().default(""),
  R2_SECRET_ACCESS_KEY: z.string().default(""),
  R2_BUCKET_NAME:       z.string().default(""),
  R2_PUBLIC_URL:        z.string().default(""),
  /*
   * WhatsApp, as in Tetra Commission and the Sales CRM (2026-10-27): each salesperson links their own WhatsApp by
   * scanning a QR — the server becomes one of their linked devices (Baileys, the WhatsApp Web protocol; no Meta
   * account). On by default in the process that runs the timed jobs (RUN_SCHEDULERS): a link lives in the process that
   * made it, so only one process may hold them. WHATSAPP=off keeps a server out of it altogether.
   *   WHATSAPP_SESSION_DIR  the linked devices' keys, one folder per person — keep it, or everyone links again
   *   WHATSAPP_MEDIA_DIR    photos and files sent and received
   */
  WHATSAPP:             z.string().default(""),
  WHATSAPP_SESSION_DIR: z.string().default("./whatsapp-sessions"),
  WHATSAPP_MEDIA_DIR:   z.string().default("./whatsapp-media"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
