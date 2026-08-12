import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { EmailGuard, NO_EMAIL_TOOLTIP } from "./email-guard";

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
