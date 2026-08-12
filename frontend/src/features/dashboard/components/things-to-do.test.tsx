import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  OverdueItem,
  type OverdueRow,
} from "@/features/dashboard/components/things-to-do";

const baseRow: OverdueRow = {
  key: "inv_1:lesson_1",
  invoiceId: "inv_1",
  customerName: "Ada Lovelace",
  billingEmail: "ada@example.com",
  description: "Mathematics — 1hr",
  amount: 60,
  currency: "AUD",
  dueDate: "2025-01-01T00:00:00.000Z",
  sentAt: null,
};

function renderRow(overrides: Partial<OverdueRow> = {}) {
  const onRemind = vi.fn();
  render(
    <TooltipProvider>
      <OverdueItem
        row={{ ...baseRow, ...overrides }}
        now={Date.now()}
        onRowClick={vi.fn()}
        onRemind={onRemind}
      />
    </TooltipProvider>,
  );
  return { onRemind };
}

describe("OverdueItem — email guard on Remind", () => {
  it("enables the Remind button when the invoice has a billing email", async () => {
    const { onRemind } = renderRow({ billingEmail: "ada@example.com" });
    const button = screen.getByRole("button", { name: /remind/i });
    expect(button).not.toBeDisabled();
    await userEvent.click(button);
    expect(onRemind).toHaveBeenCalledOnce();
  });

  it("disables the Remind button when billingEmail is null", async () => {
    const { onRemind } = renderRow({ billingEmail: null });
    const button = screen.getByRole("button", { name: /remind/i });
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(onRemind).not.toHaveBeenCalled();
  });

  it("disables the Remind button when billingEmail is an empty string", () => {
    const { onRemind } = renderRow({ billingEmail: "" });
    const button = screen.getByRole("button", { name: /remind/i });
    expect(button).toBeDisabled();
    expect(onRemind).not.toHaveBeenCalled();
  });
});
