import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { http, HttpResponse } from "msw";
import type { LoginResponse } from "@examify-tms/interfaces";
import { server } from "@/test/server";
import { useAuthStore, TOKEN_KEY, REFRESH_TOKEN_KEY } from "@examify-tms/shared";
import GoogleLoginCallbackPage from "@/features/auth/google-callback/GoogleLoginCallbackPage";

/**
 * The callback page is the back-channel half of the merged Google login: it
 * must swap the one-time code for the token pair, establish the session, and
 * route onward — or surface a friendly error when the code is dead.
 */

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      {
        path: "/auth/google/callback",
        element: <GoogleLoginCallbackPage />,
      },
      { path: "/dashboard", element: <div data-testid="dashboard" /> },
      { path: "/onboarding", element: <div data-testid="onboarding" /> },
      { path: "/login", element: <div data-testid="login" /> },
    ],
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

function loginResponse(overrides: Partial<LoginResponse> = {}): LoginResponse {
  return {
    jwtToken: "jwt-1",
    refreshToken: "refresh-1",
    user: {
      uid: "user_1",
      name: "Test Tutor",
      email: "tutor@example.com",
      role: "tutor",
      avatarUrl: null,
      onboardingComplete: true,
    } as LoginResponse["user"],
    ...overrides,
  };
}

function exchangeHandler(overrides: Partial<LoginResponse> = {}) {
  return http.post("*/api/auth/google/exchange", async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { code?: string };
    if (!body.code) {
      return HttpResponse.json({ message: "code required" }, { status: 401 });
    }
    return HttpResponse.json(loginResponse(overrides));
  });
}

beforeEach(() => {
  server.resetHandlers();
  useAuthStore.getState().clearAuth();
  localStorage.clear();
  sessionStorage.clear();
});

describe("GoogleLoginCallbackPage", () => {
  it("exchanges the code, establishes the session, and honors returnTo", async () => {
    server.use(exchangeHandler());

    renderAt("/auth/google/callback?code=otc-1&returnTo=/dashboard");

    // Navigated to the requested post-login destination.
    await screen.findByTestId("dashboard");

    // Session established: in-memory store + persisted tokens.
    const state = useAuthStore.getState();
    expect(state.user?.uid).toBe("user_1");
    expect(localStorage.getItem(TOKEN_KEY)).toBe("jwt-1");
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBe("refresh-1");
  });

  it("routes brand-new users (no returnTo, onboarding incomplete) to /onboarding", async () => {
    server.use(
      exchangeHandler({
        isNewUser: true,
        user: {
          ...loginResponse().user,
          onboardingComplete: false,
        } as LoginResponse["user"],
      }),
    );

    renderAt("/auth/google/callback?code=otc-1");

    await screen.findByTestId("onboarding");
    expect(useAuthStore.getState().user?.uid).toBe("user_1");
  });

  it("falls back to /dashboard for returning users with no returnTo", async () => {
    server.use(exchangeHandler());

    renderAt("/auth/google/callback?code=otc-1");

    await screen.findByTestId("dashboard");
  });

  it("rejects an open-redirect returnTo and lands on /dashboard instead", async () => {
    server.use(exchangeHandler());

    renderAt("/auth/google/callback?code=otc-1&returnTo=//evil.example.com");

    await screen.findByTestId("dashboard");
  });

  it("shows a friendly error + way back when the code is rejected", async () => {
    server.use(
      http.post("*/api/auth/google/exchange", () =>
        HttpResponse.json({ message: "Invalid or expired" }, { status: 401 }),
      ),
    );

    renderAt("/auth/google/callback?code=burned");

    expect(
      await screen.findByText(/expired or was already used/i),
    ).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: /back to sign in/i })).toHaveAttribute(
      "href",
      "/login",
    );
    // No session was established.
    expect(useAuthStore.getState().user).toBeNull();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it("explains when the user denied consent at Google (?error=denied)", async () => {
    renderAt("/auth/google/callback?error=denied");

    expect(await screen.findByText(/cancelled/i)).toBeInTheDocument();
    // No exchange was attempted.
    expect(useAuthStore.getState().user).toBeNull();
  });

  it("stays on the spinner while the exchange is in flight", async () => {
    server.use(
      http.post("*/api/auth/google/exchange", async () => {
        await new Promise((r) => setTimeout(r, 5_000));
        return HttpResponse.json(loginResponse());
      }),
    );

    renderAt("/auth/google/callback?code=otc-1");

    expect(
      await screen.findByText(/Finishing up your Google sign-in/i),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("dashboard")).not.toBeInTheDocument();

    await waitFor(() => {
      expect(useAuthStore.getState().user).toBeNull();
    });
  });
});
