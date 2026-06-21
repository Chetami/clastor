import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/authRoutes";
import googleAuthRoutes from "./routes/googleAuthRoutes";
import studentRoutes from "./routes/studentRoutes";
import lessonRoutes from "./routes/lessonRoutes";
import paymentRoutes from "./routes/paymentRoutes";
import meetingRoutes from "./routes/meetingRoutes";
import userRoutes from "./routes/userRoutes";
import tutorProfileRoutes from "./routes/tutorProfileRoutes";
import { initializeFirebase } from "./config/firebase";
import { ApiError } from "@examify-tms/interfaces";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:5173",
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
// Stripe Connect routes (everything except /webhook, which is mounted above).
app.use("/api/stripe", stripeRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" } as ApiError);
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response<ApiError>, next: express.NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ message: "Internal server error" });
});

// Start server
app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`API Docs: http://localhost:${PORT}/api/docs`);
});
