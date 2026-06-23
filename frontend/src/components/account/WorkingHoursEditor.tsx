import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/store/auth-store";
import { updateUserWorkingHoursRequest } from "@/features/settings/api/requests";
import type { WorkingHours } from "@examify-tms/interfaces";
import {
  WORKING_DAYS,
  WORKING_DAY_LABELS,
  DEFAULT_WORKING_HOURS,
  type WorkingDay,
} from "@/features/schedule/working-hours-utils";

interface DayForm {
  enabled: boolean;
  start: string;
  end: string;
}

type FormState = Record<WorkingDay, DayForm>;

const DEFAULT_DAY: DayForm = { enabled: false, start: "12:00", end: "20:00" };

function toFormState(wh: WorkingHours | null | undefined): FormState {
  const result = {} as FormState;
  for (const day of WORKING_DAYS) {
    const window = wh?.[day];
    result[day] = window
      ? { enabled: true, start: window.start, end: window.end }
      : { ...DEFAULT_DAY };
  }
  return result;
}

/** True when the form differs from the persisted working hours. */
function isDirty(form: FormState, wh: WorkingHours | null | undefined): boolean {
  for (const day of WORKING_DAYS) {
    const window = wh?.[day] ?? null;
    const formWindow = form[day].enabled
      ? { start: form[day].start, end: form[day].end }
      : null;
    if (window?.start !== formWindow?.start) return true;
    if (window?.end !== formWindow?.end) return true;
  }
  return false;
}

/**
 * Editable weekly working-hours preference. Reads the current value from the
 * auth store and persists on save, pushing the updated UserInfo back so every
 * surface (calendar bands, out-of-hours warnings) stays in sync. Used by both
 * Settings and the onboarding wizard — wrap in a Card on the calling side.
 */
export function WorkingHoursEditor() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const stored = user?.workingHours ?? null;

  const [form, setForm] = useState<FormState>(() => toFormState(stored));
  const [saving, setSaving] = useState(false);

  // Re-seed if the underlying user record changes (e.g. after another update).
  useEffect(() => {
    setForm(toFormState(stored));
  }, [stored]);

  const dirty = isDirty(form, stored);

  function updateDay(day: WorkingDay, patch: Partial<DayForm>) {
    setForm((prev) => ({ ...prev, [day]: { ...prev[day], ...patch } }));
  }

  async function handleSave() {
    // Build the WorkingHours object — disabled days become null.
    const next = {} as WorkingHours;
    let anyEnabled = false;
    for (const day of WORKING_DAYS) {
      const { enabled, start, end } = form[day];
      if (enabled && start && end) {
        next[day] = { start, end };
        anyEnabled = true;
      } else {
        next[day] = null;
      }
    }
    setSaving(true);
    try {
      const updated = await updateUserWorkingHoursRequest(
        anyEnabled ? next : null,
      );
      setUser(updated);
      toast.success("Working hours saved.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save working hours.",
      );
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setForm(toFormState(DEFAULT_WORKING_HOURS));
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {WORKING_DAYS.map((day) => {
          const row = form[day];
          return (
            <div
              key={day}
              className="flex items-center gap-3 rounded-md border p-2.5"
            >
              <div className="flex w-28 items-center gap-2">
                <Checkbox
                  id={`wh-${day}`}
                  checked={row.enabled}
                  onChange={(e) =>
                    updateDay(day, { enabled: e.target.checked })
                  }
                />
                <label
                  htmlFor={`wh-${day}`}
                  className="cursor-pointer text-sm font-medium"
                >
                  {WORKING_DAY_LABELS[day]}
                </label>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="time"
                  className="h-9 w-28"
                  value={row.start}
                  disabled={!row.enabled}
                  onChange={(e) => updateDay(day, { start: e.target.value })}
                  aria-label={`${WORKING_DAY_LABELS[day]} start`}
                />
                <span className="text-xs text-muted-foreground">to</span>
                <Input
                  type="time"
                  className="h-9 w-28"
                  value={row.end}
                  disabled={!row.enabled}
                  onChange={(e) => updateDay(day, { end: e.target.value })}
                  aria-label={`${WORKING_DAY_LABELS[day]} end`}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <Button onClick={handleSave} disabled={saving || !dirty}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : null}
          {saving ? "Saving…" : "Save working hours"}
        </Button>
        <Button
          variant="ghost"
          onClick={handleReset}
          disabled={saving}
          className="text-muted-foreground"
        >
          Reset to default
        </Button>
      </div>
    </div>
  );
}
