import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuthStore } from "@/store/auth-store";
import { updateUserReminderLeadTimeRequest } from "@/features/settings/api/requests";
import type { ReminderLeadTime } from "@examify-tms/interfaces";
import {
  REMINDER_DISABLED,
  REMINDER_LEAD_TIME_OPTIONS,
} from "./reminder-options";

/**
 * Reminder lead-time selector bound to the authenticated user. Persists the
 * chosen preference immediately and pushes the updated UserInfo into the auth
 * store. The "Don't notify" option maps to a null lead time (reminders off).
 */
export function ReminderLeadTimeSelect({ className }: { className?: string }) {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const current = user?.reminderLeadTime ?? REMINDER_DISABLED;

  async function handleChange(value: string) {
    // Non-disabled values are always one of the supported lead-time literals.
    const leadTime = (value === REMINDER_DISABLED ? null : value) as ReminderLeadTime;
    try {
      const updated = await updateUserReminderLeadTimeRequest(leadTime);
      setUser(updated);
    } catch (err) {
      // The store keeps the previous value — tell the user it didn't save.
      toast.error(
        err instanceof Error && err.message
          ? err.message
          : "Couldn't save your reminder preference.",
      );
    }
  }

  return (
    <Select value={current} onValueChange={handleChange}>
      <SelectTrigger className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={REMINDER_DISABLED}>Don't notify</SelectItem>
        {REMINDER_LEAD_TIME_OPTIONS.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
