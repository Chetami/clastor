import { Plus, X } from "lucide-react";
import type { DayOfWeek } from "@examify-tms/interfaces";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { DAYS, DAY_FULL_LABELS, type EventFormData } from "../event-schema";
import { DurationPicker } from "./DurationPicker";

type RecurringValues = Pick<
  EventFormData,
  "repeat" | "slots" | "durationMinutes" | "endsMode" | "endDate" | "occurrenceCount"
>;
type RecurringErrors = Partial<
  Record<"slots" | "durationMinutes" | "endDate" | "occurrenceCount", string>
>;

interface RecurringSlotsEditorProps {
  values: RecurringValues;
  errors: RecurringErrors;
  onRepeatChange: (repeat: EventFormData["repeat"]) => void;
  onUpdate: <K extends keyof EventFormData>(key: K, value: EventFormData[K]) => void;
  onAddSlot: () => void;
  onUpdateSlot: (
    index: number,
    patch: Partial<{ dayOfWeek: DayOfWeek; timeOfDay: string }>,
  ) => void;
  onRemoveSlot: (index: number) => void;
}

/**
 * Recurring-series configuration: frequency, weekly slots, duration, and the
 * "ends on date / after N lessons" bounds. Purely presentational — all state
 * mutation flows back through the callbacks.
 */
export function RecurringSlotsEditor({
  values,
  errors,
  onRepeatChange,
  onUpdate,
  onAddSlot,
  onUpdateSlot,
  onRemoveSlot,
}: RecurringSlotsEditorProps) {
  return (
    <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
      <div className="space-y-2">
        <Label>How often?</Label>
        <ToggleGroup
          type="single"
          variant="outline"
          value={values.repeat}
          onValueChange={(v) =>
            v && onRepeatChange(v as EventFormData["repeat"])
          }
          className="flex flex-wrap justify-start gap-2"
        >
          <ToggleGroupItem value="weekly">Weekly</ToggleGroupItem>
          <ToggleGroupItem value="biweekly">Every 2 weeks</ToggleGroupItem>
          <ToggleGroupItem value="monthly">Every 4 weeks</ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="space-y-2">
        <Label>Weekly lesson times</Label>
        <div className="space-y-2">
          {values.slots.map((slot, index) => (
            <div key={index} className="flex items-center gap-2">
              <Select
                value={slot.dayOfWeek}
                onValueChange={(d) =>
                  onUpdateSlot(index, { dayOfWeek: d as DayOfWeek })
                }
              >
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAYS.map((day) => (
                    <SelectItem key={day} value={day}>
                      {DAY_FULL_LABELS[day]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="time"
                className="h-9 flex-1"
                value={slot.timeOfDay}
                onChange={(e) => onUpdateSlot(index, { timeOfDay: e.target.value })}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 text-muted-foreground"
                onClick={() => onRemoveSlot(index)}
                disabled={values.slots.length <= 1}
                aria-label="Remove this lesson time"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
        {values.slots.length < 7 && (
          <Button type="button" variant="outline" size="sm" onClick={onAddSlot}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add a lesson time
          </Button>
        )}
        {errors.slots && (
          <p className="text-xs text-destructive">{errors.slots}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Lesson duration</Label>
        <DurationPicker
          value={values.durationMinutes}
          onChange={(n) => onUpdate("durationMinutes", n)}
        />
        {errors.durationMinutes && (
          <p className="text-xs text-destructive">{errors.durationMinutes}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Ends</Label>
        <div
          className={
            "flex items-center gap-3 rounded-md border p-2 transition-colors " +
            (values.endsMode === "until"
              ? "border-primary bg-primary/5"
              : "border-input")
          }
          onClick={() => onUpdate("endsMode", "until")}
        >
          <span
            className={
              "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border " +
              (values.endsMode === "until"
                ? "border-primary"
                : "border-muted-foreground/40")
            }
          >
            {values.endsMode === "until" && (
              <span className="h-2 w-2 rounded-full bg-primary" />
            )}
          </span>
          <span className="text-sm font-medium">On</span>
          <Input
            type="date"
            className="h-8"
            value={values.endDate}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              onUpdate("endsMode", "until");
              onUpdate("endDate", e.target.value);
            }}
          />
        </div>
        <div
          className={
            "flex items-center gap-3 rounded-md border p-2 transition-colors " +
            (values.endsMode === "count"
              ? "border-primary bg-primary/5"
              : "border-input")
          }
          onClick={() => onUpdate("endsMode", "count")}
        >
          <span
            className={
              "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border " +
              (values.endsMode === "count"
                ? "border-primary"
                : "border-muted-foreground/40")
            }
          >
            {values.endsMode === "count" && (
              <span className="h-2 w-2 rounded-full bg-primary" />
            )}
          </span>
          <span className="text-sm font-medium">After</span>
          <Input
            type="number"
            min={1}
            className="h-8 w-20"
            placeholder="12"
            value={values.occurrenceCount ?? ""}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              onUpdate("endsMode", "count");
              onUpdate(
                "occurrenceCount",
                e.target.valueAsNumber || undefined,
              );
            }}
          />
          <span className="text-sm text-muted-foreground">lessons</span>
        </div>
        {errors.endDate && (
          <p className="text-xs text-destructive">{errors.endDate}</p>
        )}
        {errors.occurrenceCount && (
          <p className="text-xs text-destructive">{errors.occurrenceCount}</p>
        )}
      </div>
    </div>
  );
}
