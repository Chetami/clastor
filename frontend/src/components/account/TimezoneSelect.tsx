import { useEffect, useState } from "react";
import { Check, ChevronDown, Loader2, LocateFixed } from "lucide-react";
import { toast } from "sonner";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import { updateUserTimezoneRequest } from "@/features/settings/api/requests";
import {
  TIMEZONE_INFOS,
  currentTimeInZone,
  detectBrowserTimezone,
  getTimezoneInfo,
  groupTimezonesByRegion,
} from "@/lib/timezones";

/**
 * Timezone selector bound to the authenticated user. A searchable combobox
 * over the ~400 IANA zones, grouped by region, each row showing the current
 * UTC offset and live local time. A pinned "detected" row at the top offers
 * a one-click way back to the browser's zone. Persists the chosen IANA id
 * immediately and pushes the updated UserInfo into the auth store.
 */
export function TimezoneSelect({ className }: { className?: string }) {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const current = user?.timezone ?? "";

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  // Live clock: ticks once a minute while the popover is open so the
  // per-row "current time" preview stays fresh. Stops on close.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, [open]);

  async function handleChange(tz: string) {
    if (!tz || tz === current) {
      setOpen(false);
      return;
    }
    setSaving(true);
    try {
      const updated = await updateUserTimezoneRequest(tz);
      setUser(updated);
      toast.success(`Timezone set to ${getTimezoneInfo(tz).city}.`);
      setOpen(false);
    } catch {
      toast.error("Couldn't save timezone — please try again.");
    } finally {
      setSaving(false);
    }
  }

  const detected = detectBrowserTimezone();
  const showDetected =
    detected &&
    detected !== current &&
    TIMEZONE_INFOS.some((t) => t.id === detected);

  const visibleInfos = showDetected
    ? TIMEZONE_INFOS.filter((t) => t.id !== detected)
    : TIMEZONE_INFOS;
  const groups = groupTimezonesByRegion(visibleInfos);
  const currentInfo = current ? getTimezoneInfo(current) : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={saving}
          aria-label="Change timezone"
          className={cn(
            "flex h-9 w-full items-center justify-between gap-2 whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-left text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
        >
          <span className="flex items-center gap-2 truncate">
            {saving && <Loader2 className="size-4 animate-spin shrink-0" />}
            {currentInfo ? (
              <span className="flex items-baseline gap-1.5 truncate">
                <span className="truncate font-medium">{currentInfo.city}</span>
                <span className="text-muted-foreground shrink-0">
                  {currentInfo.offsetLabel && `${currentInfo.offsetLabel} · `}
                  {currentTimeInZone(current, now)}
                </span>
              </span>
            ) : (
              <span className="text-muted-foreground">
                Select your timezone
              </span>
            )}
          </span>
          <ChevronDown className="size-4 opacity-50 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-80 p-0"
      >
        <Command
          filter={(value, search) => {
            const info = getTimezoneInfo(value);
            return info.search.includes(search.toLowerCase().trim()) ? 1 : 0;
          }}
        >
          <CommandInput placeholder="Search city, region or offset…" />
          <CommandList>
            <CommandEmpty>No timezone found.</CommandEmpty>

            {showDetected && (
              <CommandGroup heading="Detected">
                <CommandItem
                  value={detected}
                  onSelect={(v) => handleChange(v)}
                  className="gap-2"
                >
                  <LocateFixed className="size-4 text-primary shrink-0" />
                  <TimezoneRow info={getTimezoneInfo(detected)} now={now} />
                </CommandItem>
              </CommandGroup>
            )}

            {groups.map((group) => (
              <CommandGroup key={group.region} heading={group.region}>
                {group.items.map((info) => (
                  <CommandItem
                    key={info.id}
                    value={info.id}
                    onSelect={(v) => handleChange(v)}
                    className="gap-2"
                  >
                    <Check
                      className={cn(
                        "size-4 shrink-0",
                        info.id === current ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <TimezoneRow info={info} now={now} />
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** A single timezone row: "City · Region" on the left, "GMT+10 · 14:32" on
 *  the right. Used by both the detected pin and the grouped list. */
function TimezoneRow({
  info,
  now,
}: {
  info: ReturnType<typeof getTimezoneInfo>;
  now: Date;
}) {
  return (
    <div className="flex flex-1 items-center justify-between gap-3">
      <span className="flex items-baseline gap-1.5 truncate">
        <span className="truncate font-medium">{info.city}</span>
        <span className="truncate text-xs text-muted-foreground">
          {info.region}
        </span>
      </span>
      <span className="flex shrink-0 items-baseline gap-1.5 text-xs text-muted-foreground tabular-nums">
        {info.offsetLabel && <span>{info.offsetLabel}</span>}
        {info.offsetLabel && <span aria-hidden>·</span>}
        <span>{currentTimeInZone(info.id, now)}</span>
      </span>
    </div>
  );
}
