import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuthStore } from "@/store/auth-store";
import { updateUserTimezoneRequest } from "@/features/settings/api/requests";
import { TIMEZONES } from "@/lib/timezones";

/**
 * Timezone selector bound to the authenticated user. Persists the chosen
 * IANA zone immediately and pushes the updated UserInfo into the auth store.
 * Drives the local-time rendering of lesson emails and calendar invites.
 */
export function TimezoneSelect({ className }: { className?: string }) {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const current = user?.timezone ?? "";

  async function handleChange(tz: string) {
    try {
      const updated = await updateUserTimezoneRequest(tz);
      setUser(updated);
    } catch {
      // best-effort: leave the store as-is on failure
    }
  }

  return (
    <Select value={current} onValueChange={handleChange}>
      <SelectTrigger className={className}>
        <SelectValue placeholder="Select your timezone" />
      </SelectTrigger>
      <SelectContent>
        {TIMEZONES.map((tz) => (
          <SelectItem key={tz} value={tz}>
            {tz}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
