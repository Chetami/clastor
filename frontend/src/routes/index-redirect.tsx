import { Navigate } from "react-router-dom";
import { useAuthStore } from "@/store/auth-store";

/**
 * Root entry point. Authenticated users land on their dashboard; everyone
 * else is sent to the pre-signup qualifier survey, which is Clastor's
 * default landing experience. Existing users reach the sign-in page via the
 * "Sign in" button in the survey header.
 */
export function IndexRedirect() {
  const isAuthenticated = useAuthStore((s) => !!s.user);
  return (
    <Navigate to={isAuthenticated ? "/dashboard" : "/signup"} replace />
  );
}
