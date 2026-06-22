import { createBrowserRouter, Navigate } from "react-router-dom";
import { RootLayout } from "./__root";
import { ProtectedRoute } from "./protected";
import { NotFound } from "./not-found";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import LoginPage from "@/features/auth/login/LoginPage";
import SignUpPage from "@/features/auth/signup/SignUpPage";
import Dashboard from "@/features/dashboard/Dashboard";
import Students from "@/features/students/Students";
import StudentDetail from "@/features/students/StudentDetail";
import Schedule from "@/features/schedule/Schedule";
import EventDetail from "@/features/lessons/EventDetail";
import Payments from "@/features/payments/Payments";
import CreateInvoice from "@/features/payments/CreateInvoice";
import EditInvoice from "@/features/payments/EditInvoice";
import InvoiceDetail from "@/features/payments/InvoiceDetail";
import Lessons from "@/features/lessons/Lessons";
import Settings from "@/features/settings/Settings";
import Account from "@/features/account/Account";
import TutorProfileEditor from "@/features/tutor-profile/TutorProfileEditor";
import PublicTutorPage from "@/features/public-tutor/PublicTutorPage";
import StripePaymentsSettings from "@/features/stripe-payments/StripePaymentsSettings";
import OnboardingPage from "@/features/onboarding/OnboardingPage";
import { PaymentResult } from "@/features/public-pay/PaymentResult";
import { isFeatureEnabled } from "@/config/features";

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      {
        element: <ProtectedRoute />,
        children: [
          {
            path: "onboarding",
            element: <OnboardingPage />,
          },
          {
            element: <DashboardLayout />,
            children: [
              { index: true, element: <Navigate to="/dashboard" replace /> },
              { path: "dashboard", element: <Dashboard /> },
              { path: "students", element: <Students /> },
              { path: "students/:studentId", element: <StudentDetail /> },
              { path: "schedule", element: <Schedule /> },
              { path: "payments", element: <Payments /> },
              { path: "payments/new", element: <CreateInvoice /> },
              { path: "payments/:invoiceId/edit", element: <EditInvoice /> },
              { path: "payments/:invoiceId", element: <InvoiceDetail /> },
              { path: "lessons", element: <Lessons /> },
              { path: "lessons/:eventId", element: <EventDetail /> },
              { path: "settings", element: <Settings /> },
              { path: "account", element: <Account /> },
              { path: "settings/payments", element: <StripePaymentsSettings /> },
              ...(isFeatureEnabled("publicProfile")
                ? [{ path: "profile" as const, element: <TutorProfileEditor /> }]
                : []),
            ],
          },
        ],
      },
      ...(isFeatureEnabled("publicProfile")
        ? [
            {
              path: "t/:slug",
              element: <PublicTutorPage />,
            },
          ]
        : []),
      {
        path: "login",
        element: <LoginPage />,
      },
      {
        path: "signup",
        element: <SignUpPage />,
      },
      {
        path: "pay/success",
        element: <PaymentResult variant="success" />,
      },
      {
        path: "pay/cancel",
        element: <PaymentResult variant="cancel" />,
      },
      {
        path: "*",
        element: <NotFound />,
      },
    ],
  },
]);
