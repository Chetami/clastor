import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";

/**
 * Layout guard for tutor-only routes (onboarding, schedule, settings, public
 * profile, Stripe Connect). Redirects system admins to the admin dashboard so
 * they never land on surfaces that mutate tutor-specific fields.
 */
export function TutorRoute() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "tutor") return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
