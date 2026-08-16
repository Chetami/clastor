import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuthStore } from "@/store/auth-store";
import type { UserInfo } from "@examify-tms/interfaces";
import {
  EmailGuard,
  NO_EMAIL_TOOLTIP,
  EMAIL_UNVERIFIED_TOOLTIP,
} from "./email-guard";

function setup(hasEmail: boolean, tooltip?: string) {
  const onClick = vi.fn();
  render(
    <TooltipProvider>
      <EmailGuard hasEmail={hasEmail} tooltip={tooltip}>
        <Button onClick={onClick}>Send</Button>
      </EmailGuard>
    </TooltipProvider>,
  );
  return { onClick };
}

function signInAs(emailVerified: boolean | undefined) {
  useAuthStore.setState({
    user: {
      uid: "user_1",
      name: "Test Tutor",
      email: "tutor@example.com",
      role: "tutor",
      ...(emailVerified !== undefined ? { emailVerified } : {}),
    } as UserInfo,
  });
}

beforeEach(() => {
  useAuthStore.setState({ user: null });
});

describe("EmailGuard", () => {
  it("renders the child enabled when a recipient email exists", async () => {
    const { onClick } = setup(true);
    const button = screen.getByRole("button", { name: "Send" });
    expect(button).not.toBeDisabled();
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("disables the child and blocks the click when there is no email", async () => {
    const { onClick } = setup(false);
    const button = screen.getByRole("button", { name: "Send" });
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("renders the default tooltip explanation when disabled", async () => {
    setup(false);
    const trigger = document.querySelector(
      "[data-slot='tooltip-trigger']",
    ) as HTMLElement;
    await userEvent.hover(trigger);
    expect(await screen.findByText(NO_EMAIL_TOOLTIP)).toBeInTheDocument();
  });

  it("renders a custom tooltip when one is supplied", async () => {
    setup(false, "Add an email to send invoices.");
    const trigger = document.querySelector(
      "[data-slot='tooltip-trigger']",
    ) as HTMLElement;
    await userEvent.hover(trigger);
    expect(
      await screen.findByText("Add an email to send invoices."),
    ).toBeInTheDocument();
  });

  it("does not render a tooltip wrapper when an email is present", () => {
    setup(true);
    expect(
      document.querySelector("[data-slot='tooltip-trigger']"),
    ).toBeNull();
  });
});

describe("EmailGuard (unverified sender)", () => {
  it("disables the child even when the recipient has an email", async () => {
    signInAs(false);
    const { onClick } = setup(true);
    const button = screen.getByRole("button", { name: "Send" });
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("shows the verify-email tooltip when the sender is unverified", async () => {
    signInAs(false);
    setup(true);
    const trigger = document.querySelector(
      "[data-slot='tooltip-trigger']",
    ) as HTMLElement;
    await userEvent.hover(trigger);
    expect(await screen.findByText(EMAIL_UNVERIFIED_TOOLTIP)).toBeInTheDocument();
  });

  it("keeps the child enabled when the sender is verified", () => {
    signInAs(true);
    setup(true);
    expect(screen.getByRole("button", { name: "Send" })).toBeEnabled();
  });

  it("keeps the child enabled when the sender's status is unknown (legacy session)", () => {
    signInAs(undefined);
    setup(true);
    expect(screen.getByRole("button", { name: "Send" })).toBeEnabled();
  });
});
