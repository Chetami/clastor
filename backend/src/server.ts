import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/authRoutes";
import docsRoutes from "./routes/docsRoutes";
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
app.use(express.json());

// Initialize Firebase
initializeFirebase();

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/docs", docsRoutes);

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
