import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";

/**
 * Layout guard for /admin/* routes. Redirects non-admins (and the
 * unauthenticated) away from admin pages instead of relying solely on the
 * nav filter + backend 403s.
 */
export function AdminRoute() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "system_admin") return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
