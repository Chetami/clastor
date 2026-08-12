import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EmailComposeDialog } from "@/components/email-compose-dialog";
import type { EmailPreviewResponse } from "@examify-tms/interfaces";

const previewWithRecipient: EmailPreviewResponse = {
  to: ["student@example.com"],
  subject: "Your invoice",
  text: "body",
  html: "<p>body</p>",
  defaultSubject: "Your invoice",
  defaultMessage: "Hi there",
};

const previewWithoutRecipient: EmailPreviewResponse = {
  ...previewWithRecipient,
  to: [],
};

function renderDialog(preview: EmailPreviewResponse) {
  const onSend = vi.fn();
  const fetchPreview = vi.fn().mockResolvedValue(preview);
  render(
    <EmailComposeDialog
      open
      onOpenChange={vi.fn()}
      title="Send invoice"
      fetchPreview={fetchPreview}
      onSend={onSend}
    />,
  );
  return { onSend };
}

describe("EmailComposeDialog — no-recipient guard", () => {
  it("enables Send once a preview with a recipient loads", async () => {
    const { onSend } = renderDialog(previewWithRecipient);
    const send = await screen.findByRole("button", { name: "Send email" });
    await waitFor(() => expect(send).not.toBeDisabled());
    await userEvent.click(send);
    await waitFor(() => expect(onSend).toHaveBeenCalled());
  });

  it("keeps Send disabled when the preview has no recipients", async () => {
    const { onSend } = renderDialog(previewWithoutRecipient);
    const send = await screen.findByRole("button", { name: "Send email" });
    await waitFor(() => expect(send).toBeDisabled());
    await userEvent.click(send);
    expect(onSend).not.toHaveBeenCalled();
  });
});
