import "./env";
import express from "express";
import cors from "cors";
import authRoutes from "./routes/authRoutes";
import googleAuthRoutes from "./routes/googleAuthRoutes";
import studentRoutes from "./routes/studentRoutes";
import lessonRoutes from "./routes/lessonRoutes";
import paymentRoutes from "./routes/paymentRoutes";
import meetingRoutes from "./routes/meetingRoutes";
import userRoutes from "./routes/userRoutes";
import tutorProfileRoutes from "./routes/tutorProfileRoutes";
import dashboardRoutes from "./routes/dashboardRoutes";
import calendarRoutes from "./routes/calendarRoutes";
import feedbackRoutes from "./routes/feedbackRoutes";
import adminRoutes from "./routes/adminRoutes";
import templateRoutes from "./routes/templateRoutes";
import sentEmailRoutes from "./routes/sentEmailRoutes";
import { authenticateJWT, requireSystemAdmin } from "./middleware/auth";
import { initializeFirebase } from "./config/firebase";
import { ApiError } from "@examify-tms/interfaces";
import { ZodError } from "zod";
import { AppError } from "./utils/AppError";
import { formatZodError } from "./middleware/validateRequest";

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: (process.env.CORS_ORIGIN || "http://localhost:5173")
    .split(",")
    .map((o) => o.trim()),
  credentials: true,
}));

// Stripe webhook must receive the RAW request body to verify its signature.
// Register express.raw() for that single path BEFORE the global express.json()
// parser, which would otherwise re-stringify the body and break signing.
// express.json() safely skips the path since express.raw marks it parsed.
import stripeRoutes from "./routes/stripeRoutes";
app.use("/api/stripe/webhook", express.raw({ type: "application/json" }));

app.use(express.json());

// Initialize Firebase
initializeFirebase();

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/auth/google", googleAuthRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/lessons", lessonRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/meetings", meetingRoutes);
app.use("/api/users", userRoutes);
app.use("/api/tutor-profiles", tutorProfileRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/calendar", calendarRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/templates", templateRoutes);
app.use("/api/sent-emails", sentEmailRoutes);
// Admin-only API surface. Both gates are applied here so every route under
// /api/admin is authenticated and restricted to system_admin by default.
app.use("/api/admin", authenticateJWT, requireSystemAdmin, adminRoutes);
// Stripe Connect routes (everything except /webhook, which is mounted above).
app.use("/api/stripe", stripeRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" } as ApiError);
});

// Error handler — the last middleware, so every thrown/rejected error lands
// here. Typed AppErrors map to their declared status; ZodErrors from the
// request-validation middleware become structured 400s; anything else is a
// genuine server fault and surfaces as an opaque 500.
app.use((err: Error, req: express.Request, res: express.Response<ApiError>, next: express.NextFunction) => {
  // AppError carries an explicit HTTP status (e.g. BadRequestError → 400).
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ message: err.message });
    return;
  }

  // ZodError from validateRequest() that escaped (or was re-thrown).
  if (err instanceof ZodError) {
    res
      .status(400)
      .json({ message: "Validation failed", errors: formatZodError(err) } as unknown as ApiError);
    return;
  }

  console.error("Unhandled error:", err);
  res.status(500).json({ message: "Internal server error" });
});

// Start server
app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
