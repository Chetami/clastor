import { AppError, ServiceUnavailableError } from "../utils/AppError";

/**
 * Forwards website contact-form submissions to a Discord channel via an
 * incoming webhook.
 *
 * The webhook URL lives in DISCORD_CONTACT_WEBHOOK_URL so it never reaches the
 * browser bundle (a leaked webhook URL can be spammed or deleted by anyone).
 * Create one in Discord: channel Settings → Integrations → Webhooks.
 */

const WEBHOOK_TIMEOUT_MS = 10_000;

/** Brand-ish colour for the Clastor embed (little-endian int as Discord expects). */
const EMBED_COLOR = 0x7c3aed;

export interface ContactMessage {
  name: string;
  email: string;
  topic: string;
  message: string;
}

/** Truncates to Discord's embed field value limit (1024). */
function field(value: string): string {
  return value.length > 1024 ? `${value.slice(0, 1021)}...` : value;
}

/**
 * POST a contact submission to the Discord webhook.
 * Throws AppError (502/503) on misconfiguration or upstream failure so the
 * central error handler maps it and the visitor sees a retryable failure.
 */
export async function sendContactMessageToDiscord(
  message: ContactMessage,
): Promise<void> {
  const webhookUrl = process.env.DISCORD_CONTACT_WEBHOOK_URL;
  if (!webhookUrl) {
    throw new ServiceUnavailableError(
      "Contact forwarding is not configured. Please email us instead.",
    );
  }

  const payload = {
    username: "Clastor Website",
    embeds: [
      {
        title: "New contact form message",
        color: EMBED_COLOR,
        fields: [
          { name: "Name", value: field(message.name), inline: true },
          { name: "Topic", value: field(message.topic), inline: true },
          { name: "Email", value: field(message.email) },
        ],
        description: field(message.message),
        timestamp: new Date().toISOString(),
      },
    ],
  };

  let response: Response;
  try {
    response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
    });
  } catch (error) {
    // Never echo the webhook URL (it can appear in network error messages).
    console.error("Discord webhook request failed:", error);
    throw new AppError("Failed to deliver your message. Please try again shortly.", 502);
  }

  if (!response.ok) {
    // 429 in particular means we're hammering Discord's per-webhook limit.
    console.error(
      `Discord webhook responded with ${response.status} ${response.statusText}`,
    );
    throw new AppError("Failed to deliver your message. Please try again shortly.", 502);
  }
}
