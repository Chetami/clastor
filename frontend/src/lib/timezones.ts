/**
 * The set of IANA timezone identifiers offered in selectors (Settings,
 * student forms). Prefers the runtime's full supported list via
 * `Intl.supportedValuesOf("timeZone")`, falling back to a curated list of
 * common zones so the picker is never empty on older browsers.
 */
function getTimezones(): string[] {
  try {
    const supported = (
      Intl as unknown as {
        supportedValuesOf?: (key: string) => string[];
      }
    ).supportedValuesOf?.("timeZone");
    if (supported && supported.length > 0) {
      return supported;
    }
  } catch {
    // fallthrough to defaults
  }
  return [
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "America/Toronto",
    "Europe/London",
    "Europe/Paris",
    "Asia/Kolkata",
    "Asia/Dubai",
    "Asia/Singapore",
    "Australia/Sydney",
    "UTC",
  ];
}

export const TIMEZONES = getTimezones();
