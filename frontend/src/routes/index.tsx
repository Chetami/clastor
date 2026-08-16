import { createBrowserRouter } from "react-router-dom";
import { RootLayout } from "./__root";
import { ProtectedRoute } from "./protected";
import { IndexRedirect } from "./index-redirect";
import { DashboardRoute } from "./dashboard-route";
import { AdminRoute } from "./admin-route";
import { TutorRoute } from "./tutor-route";
import { NotFound } from "./not-found";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import LoginPage from "@/features/auth/login/LoginPage";
import ForgotPasswordPage from "@/features/auth/forgot-password/ForgotPasswordPage";
import AuthActionPage from "@/features/auth/auth-action/AuthActionPage";
import SignupSurveyPage from "@/features/auth/signup/SignupSurveyPage";
import SignUpPage from "@/features/auth/signup/SignUpPage";
import Students from "@/features/students/Students";
import StudentDetail from "@/features/students/StudentDetail";
import Schedule from "@/features/schedule/Schedule";
import EventDetail from "@/features/lessons/LessonDetail";
import Payments from "@/features/payments/Payments";
import CreateInvoice from "@/features/payments/CreateInvoice";
import EditInvoice from "@/features/payments/EditInvoice";
import InvoiceDetail from "@/features/payments/InvoiceDetail";
import Lessons from "@/features/lessons/Lessons";
import LessonSeriesDetail from "@/features/lessons/LessonSeriesDetail";
import Settings from "@/features/settings/Settings";
import Account from "@/features/account/Account";
import TutorProfileEditor from "@/features/tutor-profile/TutorProfileEditor";
import PublicTutorPage from "@/features/public-tutor/PublicTutorPage";
import StripePaymentsSettings from "@/features/stripe-payments/StripePaymentsSettings";
import OnboardingPage from "@/features/onboarding/OnboardingPage";
import AdminFeedback from "@/features/feedback/AdminFeedback";
import AdminTutors from "@/features/admin-tutors/AdminTutors";
import Templates from "@/features/templates/Templates";
import SentEmails from "@/features/emails/SentEmails";
import { PaymentResult } from "@/features/public-pay/PaymentResult";
import { isFeatureEnabled } from "@/config/features";

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { index: true, element: <IndexRedirect /> },
      {
        element: <ProtectedRoute />,
        children: [
          {
            element: <TutorRoute />,
            children: [
              {
                path: "onboarding",
                element: <OnboardingPage />,
              },
            ],
          },
            {
              element: <DashboardLayout />,
              children: [
                { path: "dashboard", element: <DashboardRoute /> },
                { path: "account", element: <Account /> },
                {
                  element: <AdminRoute />,
                  children: [
                    { path: "admin/feedback", element: <AdminFeedback /> },
                    { path: "admin/tutors", element: <AdminTutors /> },
                  ],
                },
                {
                  element: <TutorRoute />,
                  children: [
                    { path: "students", element: <Students /> },
                    { path: "students/:studentId", element: <StudentDetail /> },
                    { path: "payments", element: <Payments /> },
                    { path: "payments/new", element: <CreateInvoice /> },
                    { path: "payments/:invoiceId/edit", element: <EditInvoice /> },
                    { path: "payments/:invoiceId", element: <InvoiceDetail /> },
                    { path: "lessons", element: <Lessons /> },
                    { path: "lessons/series/:seriesId", element: <LessonSeriesDetail /> },
                    { path: "lessons/:eventId", element: <EventDetail /> },
                    { path: "schedule", element: <Schedule /> },
                    ...(isFeatureEnabled("templates")
                      ? [{ path: "templates" as const, element: <Templates /> }]
                      : []),
                    ...(isFeatureEnabled("sentEmails")
                      ? [{ path: "sent-emails" as const, element: <SentEmails /> }]
                      : []),
                    { path: "settings", element: <Settings /> },
                    {
                      path: "settings/payments",
                      element: <StripePaymentsSettings />,
                    },
                    ...(isFeatureEnabled("publicProfile")
                      ? [
                          {
                            path: "profile" as const,
                            element: <TutorProfileEditor />,
                          },
                        ]
                      : []),
                  ],
                },
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
        path: "forgot-password",
        element: <ForgotPasswordPage />,
      },
      {
        path: "auth/action",
        element: <AuthActionPage />,
      },
      {
        path: "signup",
        element: <SignupSurveyPage />,
      },
      {
        path: "signup/account",
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
