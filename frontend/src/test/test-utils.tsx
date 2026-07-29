/* eslint-disable react-refresh/only-export-components */
import { type ReactNode, type ReactElement } from "react";
import { render, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, type MemoryRouterProps } from "react-router-dom";
import { useAuthStore } from "@examify-tms/shared";
import type { UserInfo } from "@examify-tms/interfaces";

/**
 * Test-only provider stack that mirrors `AppProvider` but with isolation
 * guarantees:
 *  - a FRESH QueryClient per render (no cache leakage between tests, retries
 *    turned off so assertions don't race against silent refetches)
 *  - MemoryRouter so tests can seed a route without touching the browser URL
 *  - a hook to pre-seed the auth store when an authenticated surface is needed
 *
 * Components rendered through this helper behave exactly as they do in the
 * running app: TanStack Query hooks talk to the REAL shared axios client,
 * which MSW intercepts at the network layer.
 */

// A minimal but valid tutor user. Tests spread/override as needed.
export const fakeUser: UserInfo = {
  uid: "user_1",
  email: "tutor@example.com",
  name: "Test Tutor",
  role: "tutor",
  avatarUrl: null,
  onboardingComplete: true,
} as unknown as UserInfo;

export interface RenderOptions {
  /** Seed the auth store with a logged-in session before rendering. */
  authenticated?: boolean;
  /** Override the user placed into the store (defaults to {@link fakeUser}). */
  user?: UserInfo;
  /** Initial MemoryRouter entries; defaults to ["/"]. */
  initialEntries?: MemoryRouterProps["initialEntries"];
}

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // No silent refetches: assertions run against exactly one fetch.
        retry: false,
        gcTime: 0,
        staleTime: 0,
        refetchOnWindowFocus: false,
        networkMode: "online",
      },
      mutations: { retry: false, networkMode: "online" },
    },
  });
}

function seedAuth(authenticated: boolean, user: UserInfo) {
  // Always start from a clean slate so one test's session can't leak into
  // the next via the Zustand singleton.
  useAuthStore.getState().clearAuth();
  if (authenticated) {
    useAuthStore.getState().setAuth(user, "test-jwt", "test-refresh");
  }
}

function Providers({
  queryClient,
  initialEntries,
  children,
}: {
  queryClient: QueryClient;
  initialEntries?: MemoryRouterProps["initialEntries"];
  children: ReactNode;
}) {
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter
        initialEntries={initialEntries ?? ["/"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        {children}
      </MemoryRouter>
    </QueryClientProvider>
  );
}

/**
 * Render a component wrapped in the full provider stack. Returns the standard
 * Testing Library queries plus the `queryClient` for cache assertions.
 */
export function renderWithProviders(
  ui: ReactElement,
  options: RenderOptions = {},
) {
  const { authenticated = false, user = fakeUser, initialEntries } = options;
  seedAuth(authenticated, user);

  const queryClient = createTestQueryClient();
  const view = render(
    <Providers queryClient={queryClient} initialEntries={initialEntries}>
      {ui}
    </Providers>,
  );
  return { ...view, queryClient };
}

/**
 * `renderHook` wrapper that gives the hook access to the QueryClient + Router
 * context. Mirrors the pattern used by TanStack's own docs.
 */
export function renderHookWithProviders<TResult>(
  hook: () => TResult,
  options: RenderOptions = {},
) {
  const { authenticated = false, user = fakeUser, initialEntries } = options;
  seedAuth(authenticated, user);

  const queryClient = createTestQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <Providers queryClient={queryClient} initialEntries={initialEntries}>
      {children}
    </Providers>
  );

  // Use a local counter to satisfy react-hooks calling-convention rules: we
  // re-render the host element to re-invoke the hook across the same context.
  const host: { current: { value?: TResult } } = { current: {} };
  function Probe() {
    host.current.value = hook();
    return null;
  }
  const view = render(<Probe />, { wrapper });

  return {
    result: host as { current: { value: TResult } },
    rerender: () => view.rerender(<Probe />),
    unmount: () => {
      view.unmount();
      cleanup();
    },
    queryClient,
  };
}
