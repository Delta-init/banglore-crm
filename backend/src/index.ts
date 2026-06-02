import "dotenv/config";
import { createServer } from "http";
import path from "path";
import { mkdirSync } from "fs";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { connectDB } from "./config/database.js";
import { env } from "./config/env.js";
import routes from "./routes/index.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import { initSocket } from "./socket.js";
import { startReminderScheduler } from "./services/reminderScheduler.js";
import { startSplitScheduler } from "./services/splitScheduler.js";
import { startBackupScheduler } from "./services/backupService.js";

// ─── Ensure upload directories exist ─────────────────────────────────────────
mkdirSync(path.join(process.cwd(), "uploads", "recordings"), { recursive: true });

const app = express();

// ─── Security & Parsing Middleware ────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }, // allow audio files to be fetched cross-origin
}));
app.use(
  cors({
    origin: [env.CLIENT_URL, "http://localhost:3001", "http://localhost:19006"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

if (env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// ─── Static: serve call recordings ───────────────────────────────────────────
// Recordings uploaded by the Android app are served at /recordings/<filename>
app.use("/recordings", express.static(path.join(process.cwd(), "uploads", "recordings")));

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use("/api/v1", routes);

// ─── 404 & Error Handlers ─────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ─── Start Server ─────────────────────────────────────────────────────────────
const start = async () => {
  await connectDB();
  const httpServer = createServer(app);
  initSocket(httpServer);
  httpServer.listen(env.PORT, () => {
    console.log(`🚀 Server running on http://localhost:${env.PORT} [${env.NODE_ENV}]`);
    console.log(`📋 API Base: http://localhost:${env.PORT}/api/v1`);
    // Start after server is listening so Socket.IO is ready for emitToUser
    startReminderScheduler();
    startSplitScheduler();
    startBackupScheduler();
  });
};

start();

export default app;
