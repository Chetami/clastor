import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "@/store/auth-store";

export function ProtectedRoute() {
  const isAuthenticated = useAuthStore((s) => !!s.user);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
