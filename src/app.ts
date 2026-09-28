import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.routes.js";
import mediaRoutes from "./routes/media.routes.js";
import { isDbConnected } from "./config/database.js";

const app = express();

app.use(cors());
// Increase JSON payload limit so admin can upload photos as base64 data URLs.
// 25MB is enough for most mobile photos; if you need video, consider a real
// object storage (S3/Cloudinary) instead of inline base64.
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ limit: "25mb", extended: true }));

app.get("/api/health", (_req, res) => {
  const dbConnected = isDbConnected();
  res.json({
    success: true,
    message: "API is running",
    database: dbConnected ? "connected" : "disconnected",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/media", mediaRoutes);

// Fallback 404 for any unhandled path starting with /api.
// NOTE: Express v5's path-to-regexp disallows bare '*' wildcards in path strings,
// so we call app.use() with NO path argument (default = match everything) and
// gate the handler using req.path instead.
app.use((req, res, next) => {
  if (req.path && req.path.startsWith("/api")) {
    res.status(404).json({
      success: false,
      message: "API endpoint not found.",
    });
    return;
  }
  next();
});

export default app;