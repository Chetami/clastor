import { useAuth } from "@/hooks/use-auth";
import Dashboard from "@/features/dashboard/Dashboard";
import AdminDashboard from "@/features/admin-dashboard/AdminDashboard";

export function DashboardRoute() {
  const { user } = useAuth();
  return user?.role === "system_admin" ? <AdminDashboard /> : <Dashboard />;
}
