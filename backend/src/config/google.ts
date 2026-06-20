import { google } from "googleapis";

const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar";

let jwtClient: InstanceType<typeof google.auth.JWT> | null = null;
let cachedEmail: string | null = null;

/**
 * Lazily build a Google service-account JWT client authorized for the
 * Calendar API, reading credentials straight from the service-account JSON
 * key file pointed to by GOOGLE_SERVICE_ACCOUNT_KEY_PATH.
 *
 * Mirrors the FIREBASE_SERVICE_ACCOUNT_KEY_PATH pattern so you never have to
 * copy/paste the private key into an env var.
 */
export function getGoogleCalendarClient() {
  if (jwtClient) {
    return jwtClient;
  }

  const keyPath =
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH ||
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH;
  if (!keyPath) {
    throw new Error(
      "Google Calendar integration is not configured. Set GOOGLE_SERVICE_ACCOUNT_KEY_PATH (or FIREBASE_SERVICE_ACCOUNT_KEY_PATH) in the backend environment.",
    );
  }

  // Resolve relative to the config module, same as config/firebase.ts.
  const credentials = require(keyPath) as {
    client_email: string;
    private_key: string;
  };

  if (!credentials.client_email || !credentials.private_key) {
    throw new Error(
      `Service account key at ${keyPath} is missing client_email or private_key.`,
    );
  }

  jwtClient = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: [CALENDAR_SCOPE],
  });

  cachedEmail = credentials.client_email;
  return jwtClient;
}

/** The service account's email (the calendar owner). */
export function getServiceAccountEmail(): string {
  if (!cachedEmail) {
    getGoogleCalendarClient();
  }
  return cachedEmail as string;
}

/** Google Calendar API client, authenticated as the service account. */
export function calendar() {
  return google.calendar({ version: "v3", auth: getGoogleCalendarClient() });
}
