/**
 * Timezone data and formatting helpers for selectors (Settings, student
 * forms, anywhere we let a user pick an IANA zone).
 *
 * The raw list comes from `Intl.supportedValuesOf("timeZone")` (≈400 zones
 * on modern browsers), with a curated fallback list so the picker is never
 * empty. Each zone is enriched with a friendly city label, a region
 * grouping, and the *current* UTC offset (computed at module load — good
 * enough for a settings screen; the stored value is the IANA id, not the
 * offset, so DST transitions are handled correctly when rendering times
 * elsewhere).
 */

/** Format of an enriched timezone entry used by the picker. */
export interface TimezoneInfo {
  /** Raw IANA identifier, e.g. "Australia/Sydney". Stored on the user. */
  id: string;
  /** Human-friendly primary label, e.g. "Sydney". */
  city: string;
  /** Region group label, e.g. "Australia". Used for grouping rows. */
  region: string;
  /** Short offset label, e.g. "GMT+10" or "GMT+5:30". May be "" if the
   *  browser can't compute an offset for the zone. */
  offsetLabel: string;
  /** Offset in minutes from UTC (signed). 0 when unknown. Used for sort. */
  offsetMinutes: number;
  /** Lowercase haystack used for filtering — includes city, region, id and
   *  normalized offset tokens. */
  search: string;
}

const FALLBACK_TIMEZONES = [
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

/** Returns the runtime's supported IANA zones, or a curated fallback. */
function listTimezones(): string[] {
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
  return FALLBACK_TIMEZONES;
}

export const TIMEZONES = listTimezones();

/**
 * Map IANA "area" prefix (the segment before the first `/`) to a display
 * region. Collapses legacy prefixes like `US/` and `Etc/` into sensible
 * buckets. Anything unmapped is prettified (e.g. "Indian" stays "Indian").
 */
function regionFor(id: string, city: string): string {
  if (id === "UTC") return "UTC";
  const area = id.includes("/") ? id.slice(0, id.indexOf("/")) : id;
  switch (area) {
    case "America":
    case "US":
    case "Brazil":
    case "Argentina":
    case "Canada":
    case "Mexico":
    case "Chile":
    case "Cuba":
    case "Jamaica":
    case "Bahamas":
    case "Navajo":
      return "America";
    case "Europe":
    case "GB":
    case "Eire":
    case "Portugal":
    case "Iceland":
    case "Poland":
    case "Turkey":
    case "W-SU":
    case "Malta":
    case "Cyprus":
      return "Europe";
    case "Asia":
    case "Japan":
    case "Singapore":
    case "Hongkong":
    case "Korea":
    case "Taiwan":
    case "Israel":
    case "Iran":
    case "Lebanon":
    case "Syria":
    case "Jordan":
    case "Thailand":
    case "Indonesia":
    case "Philippines":
    case "Malaysia":
    case "Brunei":
    case "Macao":
    case "Mongolia":
    case "Kwajalein":
      return "Asia";
    case "Africa":
    case "Egypt":
    case "Libya":
    case "Morocco":
    case "Tunisia":
    case "Algeria":
    case "Eritrea":
      return "Africa";
    case "Pacific":
    case "NZ":
    case "Chatham":
    case "Fiji":
    case "Samoa":
    case "Tonga":
    case "Guam":
    case "Palau":
    case "Johnston":
    case "Kiritimati":
    case "Midway":
    case "Niue":
    case "Pohnpei":
    case "Rarotonga":
    case "Tahiti":
    case "Funafuti":
    case "Wallis":
    case "Majuro":
    case "Efate":
    case "Gambier":
    case "Galapagos":
    case "Easter":
      return "Pacific";
    case "Australia":
    case "ACT":
    case "NSW":
    case "Victoria":
    case "Tasmania":
    case "Queensland":
    case "South":
    case "West":
    case "North":
    case "LHI":
    case "Lord_Howe":
      return "Australia";
    case "Atlantic":
    case "Bermuda":
    case "Azores":
    case "Madeira":
    case "Canary":
    case "Faeroe":
    case "Stanley":
    case "Jan_Mayen":
    case "Reykjavik":
      return "Atlantic";
    case "Indian":
    case "Antarctica":
    case "Arctic":
      return area;
    case "Etc":
      // Etc/UTC and friends collapse into UTC; anything else (Etc/GMT+10)
      // gets a generic "UTC offsets" region.
      return city === "UTC" || id === "Etc/UTC" ? "UTC" : "UTC offsets";
    default:
      return area;
  }
}

/** Prettify the final segment of an IANA id into a city label. */
function cityFor(id: string): string {
  if (id === "UTC") return "UTC";
  const last = id.includes("/") ? id.slice(id.lastIndexOf("/") + 1) : id;
  return last.replace(/_/g, " ");
}

/**
 * Compute the current UTC offset for a zone using `Intl.DateTimeFormat`
 * with `timeZoneName: "shortOffset"` (e.g. "GMT+10", "GMT-5"). Falls back
 * to `longOffset` ("GMT+10:00") on older engines, then to "GMT" if all
 * else fails. Returns the label and signed minutes-from-UTC.
 */
function offsetFor(tz: string): { label: string; minutes: number } {
  const now = new Date();
  for (const style of ["shortOffset", "longOffset"] as const) {
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        timeZoneName: style,
      }).formatToParts(now);
      const tzPart = parts.find((p) => p.type === "timeZoneName");
      if (!tzPart) continue;
      const label = tzPart.value;
      const match = label.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
      if (match) {
        const sign = match[1] === "-" ? -1 : 1;
        const hours = Number(match[2]);
        const mins = match[3] ? Number(match[3]) : 0;
        return { label: compactOffset(label), minutes: sign * (hours * 60 + mins) };
      }
      // label present but unparseable (rare) — still show something.
      return { label, minutes: 0 };
    } catch {
      // try next style
    }
  }
  return { label: "", minutes: 0 };
}

/** Normalise any engine offset string to "GMT±H" or "GMT±H:MM".
 *  Handles "GMT+10", "GMT+10:00", "GMT+05:30", "GMT-5", etc. */
function compactOffset(label: string): string {
  const m = label.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!m) return label;
  const sign = m[1];
  const hours = Number(m[2]);
  const mins = m[3] ? Number(m[3]) : 0;
  return mins === 0 ? `GMT${sign}${hours}` : `GMT${sign}${hours}:${m[3]}`;
}

/** Build a search haystack that lets "+10", "GMT10", "sydney", "Australia"
 *  all hit the right rows. */
function buildSearch(info: Pick<TimezoneInfo, "id" | "city" | "region" | "offsetLabel">): string {
  const parts = [
    info.id.toLowerCase().replace(/_/g, " "),
    info.city.toLowerCase(),
    info.region.toLowerCase(),
  ];
  // "GMT+10" → also index "10", "+10", "gmt10", "gmt+10"
  const offsetDigits = info.offsetLabel.match(/GMT([+-]\d{1,2}(?::\d{2})?)/);
  if (offsetDigits) {
    parts.push(info.offsetLabel.toLowerCase());
    parts.push(offsetDigits[1].toLowerCase()); // "+10"
    parts.push(offsetDigits[1].replace("+", "").toLowerCase()); // "10"
  }
  return parts.join(" ");
}

const INFO_CACHE = new Map<string, TimezoneInfo>();

/** Enrich a single IANA id into a `TimezoneInfo`. Memoised per id. */
export function getTimezoneInfo(tz: string): TimezoneInfo {
  const cached = INFO_CACHE.get(tz);
  if (cached) return cached;
  const city = cityFor(tz);
  const region = regionFor(tz, city);
  const { label, minutes } = offsetFor(tz);
  const info: TimezoneInfo = {
    id: tz,
    city,
    region,
    offsetLabel: label,
    offsetMinutes: minutes,
    search: buildSearch({ id: tz, city, region, offsetLabel: label }),
  };
  INFO_CACHE.set(tz, info);
  return info;
}

/** Enriched list, sorted by UTC offset then region/city — so the most
 *  relevant zones for an offset group sit together. */
export const TIMEZONE_INFOS: TimezoneInfo[] = TIMEZONES.map(getTimezoneInfo).sort(
  (a, b) =>
    a.offsetMinutes - b.offsetMinutes ||
    a.region.localeCompare(b.region) ||
    a.city.localeCompare(b.city),
);

const REGION_ORDER = [
  "UTC",
  "Australia",
  "Pacific",
  "Asia",
  "Europe",
  "Africa",
  "Indian",
  "America",
  "Atlantic",
  "Antarctic",
  "Arctic",
  "UTC offsets",
];

/** Group enriched zones by `region`, returning groups in a sensible display
 *  order (UTC first, then by region). Each group is sorted by offset then
 *  city. */
export function groupTimezonesByRegion(
  infos: TimezoneInfo[],
): { region: string; items: TimezoneInfo[] }[] {
  const map = new Map<string, TimezoneInfo[]>();
  for (const info of infos) {
    const list = map.get(info.region) ?? [];
    list.push(info);
    map.set(info.region, list);
  }
  return [...map.entries()]
    .map(([region, items]) => ({
      region,
      items: items.slice().sort(
        (a, b) =>
          a.offsetMinutes - b.offsetMinutes || a.city.localeCompare(b.city),
      ),
    }))
    .sort((a, b) => {
      const ai = REGION_ORDER.indexOf(a.region);
      const bi = REGION_ORDER.indexOf(b.region);
      return (
        (ai === -1 ? Number.MAX_SAFE_INTEGER : ai) -
        (bi === -1 ? Number.MAX_SAFE_INTEGER : bi)
      );
    });
}

/** Format the current wall-clock time in a zone, e.g. "14:32". Used for the
 *  live preview shown next to each row and on the trigger. */
export function currentTimeInZone(tz: string, now: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(now);
  } catch {
    return "--:--";
  }
}

/** The browser's own IANA zone, if detectable. Empty string if not. */
export function detectBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
  } catch {
    return "";
  }
}
