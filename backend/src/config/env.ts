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
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
