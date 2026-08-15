import { useEffect, type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ApiRequestError } from "@examify-tms/shared";
import { queryClient } from "@/lib/query-client";
import { useVerifyToken } from "@/features/auth/api";
import { useAuthStore } from "@/store/auth-store";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/hooks/use-theme";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";

function FullScreenLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-lg">Loading...</div>
    </div>
  );
}

/**
 * Shown when the boot /verify call fails for a transient reason (offline,
 * DNS, 5xx). The persisted session is kept — wiping it would force a valid
 * user to log back in over a blip.
 */
function BootErrorScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="font-medium">Couldn't reach the server</p>
      <p className="text-sm text-muted-foreground">
        Check your connection and try again.
      </p>
      <Button variant="outline" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

function AuthBoot({ children }: { children: ReactNode }) {
  const { isLoading, isError, error, refetch } = useVerifyToken();
  const clearAuth = useAuthStore((s) => s.clearAuth);

  // Only destroy the persisted session for definitive auth failures
  // (401/403 the refresh path couldn't recover from — the interceptor has
  // usually already cleared the store). A network error or backend 5xx at
  // boot must NOT log the user out.
  const sessionInvalid =
    isError && (error instanceof ApiRequestError)
      ? error.status === 401 || error.status === 403
      : false;

  useEffect(() => {
    if (sessionInvalid) {
      queryClient.clear();
      clearAuth();
    }
  }, [sessionInvalid, clearAuth]);

  if (isLoading) {
    return <FullScreenLoader />;
  }

  if (isError && !sessionInvalid) {
    return <BootErrorScreen onRetry={() => refetch()} />;
  }

  return children;
}

export function AppProvider({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <AuthBoot>{children}</AuthBoot>
        </TooltipProvider>
        <Toaster richColors closeButton position="top-right" />
      </ThemeProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
