import { useEffect, type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";
import { useVerifyToken } from "@/features/auth/api";
import { useAuthStore } from "@/store/auth-store";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

function FullScreenLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-lg">Loading...</div>
    </div>
  );
}

function AuthBoot({ children }: { children: ReactNode }) {
  const { isLoading, isError } = useVerifyToken();
  const clearAuth = useAuthStore((s) => s.clearAuth);

  useEffect(() => {
    if (isError) {
      queryClient.clear();
      clearAuth();
    }
  }, [isError, clearAuth]);

  if (isLoading) {
    return <FullScreenLoader />;
  }

  return children;
}

export function AppProvider({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthBoot>{children}</AuthBoot>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
