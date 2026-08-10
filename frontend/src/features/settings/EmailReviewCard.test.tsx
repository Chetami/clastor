import { describe, it, expect, beforeEach, vi } from "vitest";
import { waitFor } from "@testing-library/react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { UserInfo } from "@examify-tms/interfaces";
import {
  renderWithProviders,
  fakeUser,
} from "@/test/test-utils";
import { server } from "@/test/server";
import { useAuthStore } from "@examify-tms/shared";
import { EmailReviewCard } from "./EmailReviewCard";

/** Build a PATCH /api/users/me handler that echoes the requested
 *  emailReviewSettings back on the user so the mutation's onSuccess can push
 *  the updated user into the store. Returns a capture of the request body. */
function patchUserHandler() {
  const capture: { body: Record<string, unknown> | undefined } = { body: undefined };
  const handler = http.patch("*/api/users/me", async ({ request }) => {
    const json = (await request.json()) as Record<string, unknown>;
    capture.body = json;
    const updated: UserInfo = {
      ...fakeUser,
      ...(json.emailReviewSettings !== undefined
        ? { emailReviewSettings: json.emailReviewSettings as UserInfo["emailReviewSettings"] }
        : {}),
    };
    return HttpResponse.json(updated);
  });
  return { capture, handler };
}

describe("EmailReviewCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows 'Review before sending' with switch ON when review is enabled (default)", () => {
    renderWithProviders(<EmailReviewCard />, {
      authenticated: true,
      user: { ...fakeUser, emailReviewSettings: null },
    });

    expect(screen.getByText("Review before sending")).toBeInTheDocument();
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
  });

  it("shows 'Send immediately' with switch OFF when review is disabled", () => {
    renderWithProviders(<EmailReviewCard />, {
      authenticated: true,
      user: {
        ...fakeUser,
        emailReviewSettings: { reviewEnabled: false },
      },
    });

    expect(screen.getByText("Send immediately")).toBeInTheDocument();
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
  });

  it("sends { reviewEnabled: false } when toggled OFF and updates the store", async () => {
    const { capture, handler } = patchUserHandler();
    server.use(handler);

    renderWithProviders(<EmailReviewCard />, {
      authenticated: true,
      user: { ...fakeUser, emailReviewSettings: null },
    });

    await userEvent.click(screen.getByRole("switch"));

    await waitFor(() => {
      expect(capture.body).toBeDefined();
    });
    expect(capture.body).toEqual({
      emailReviewSettings: { reviewEnabled: false },
    });

    // The mutation's onSuccess pushes the returned user into the store.
    await waitFor(() => {
      const user = useAuthStore.getState().user;
      expect(user?.emailReviewSettings).toEqual({ reviewEnabled: false });
    });

    // The label reflects the new state.
    await waitFor(() => {
      expect(screen.getByText("Send immediately")).toBeInTheDocument();
    });
  });

  it("sends null when toggled back ON (re-enables review)", async () => {
    const { capture, handler } = patchUserHandler();
    server.use(handler);

    renderWithProviders(<EmailReviewCard />, {
      authenticated: true,
      user: {
        ...fakeUser,
        emailReviewSettings: { reviewEnabled: false },
      },
    });

    await userEvent.click(screen.getByRole("switch"));

    await waitFor(() => {
      expect(capture.body).toBeDefined();
    });
    expect(capture.body).toEqual({ emailReviewSettings: null });

    await waitFor(() => {
      expect(screen.getByText("Review before sending")).toBeInTheDocument();
    });
  });
});
