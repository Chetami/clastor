import { createBrowserRouter, Navigate } from "react-router-dom";
import { RootLayout } from "./__root";
import { ProtectedRoute } from "./protected";
import { NotFound } from "./not-found";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import LoginPage from "@/features/auth/login/LoginPage";
import SignUpPage from "@/features/auth/signup/SignUpPage";
import Dashboard from "@/features/dashboard/Dashboard";
import Students from "@/features/students/Students";
import Exams from "@/features/exams/Exams";
import Schedule from "@/features/schedule/Schedule";
import Settings from "@/features/settings/Settings";

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      {
        element: <ProtectedRoute />,
        children: [
          {
            element: <DashboardLayout />,
            children: [
              { index: true, element: <Navigate to="/dashboard" replace /> },
              { path: "dashboard", element: <Dashboard /> },
              { path: "students", element: <Students /> },
              { path: "exams", element: <Exams /> },
              { path: "schedule", element: <Schedule /> },
              { path: "settings", element: <Settings /> },
            ],
          },
        ],
      },
      {
        path: "login",
        element: <LoginPage />,
      },
      {
        path: "signup",
        element: <SignUpPage />,
      },
      {
        path: "*",
        element: <NotFound />,
      },
    ],
  },
]);
