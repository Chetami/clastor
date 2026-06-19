import { useState } from "react";
import { ChevronDown, DollarSign } from "lucide-react";
import type { RateType, StudentStatus } from "@examify-tms/interfaces";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import {
  EMPTY_STUDENT_FORM,
  studentFormSchema,
  type StudentFormData,
} from "./student-schema";
import { TIMEZONES } from "./timezones";

interface StudentFormProps {
  defaultValues?: Partial<StudentFormData>;
  submitLabel: string;
  onCancel: () => void;
  onSubmit: (values: StudentFormData) => void;
}

function toFormData(
  defaultValues?: Partial<StudentFormData>,
): StudentFormData {
  return { ...EMPTY_STUDENT_FORM, ...defaultValues };
}

type FieldErrors = Partial<Record<keyof StudentFormData, string>>;

export function StudentForm({
  defaultValues,
  submitLabel,
  onCancel,
  onSubmit,
}: StudentFormProps) {
  const [values, setValues] = useState<StudentFormData>(
    toFormData(defaultValues),
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [additionalOpen, setAdditionalOpen] = useState(false);

  function update<K extends keyof StudentFormData>(
    key: K,
    value: StudentFormData[K],
  ) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = studentFormSchema.safeParse(values);
    if (!result.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof StudentFormData;
        if (!fieldErrors[key]) {
          fieldErrors[key] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return;
    }
    onSubmit(result.data);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          placeholder="Jane Doe"
          aria-invalid={!!errors.name}
          value={values.name}
          onChange={(e) => update("name", e.target.value)}
        />
        {errors.name && (
          <p className="text-xs text-destructive">{errors.name}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="jane.doe@example.com"
          aria-invalid={!!errors.email}
          value={values.email}
          onChange={(e) => update("email", e.target.value)}
        />
        {errors.email && (
          <p className="text-xs text-destructive">{errors.email}</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="phone">
            Phone{" "}
            <span className="text-xs font-normal text-muted-foreground">
              (optional)
            </span>
          </Label>
          <PhoneInput
            id="phone"
            invalid={!!errors.phone}
            value={values.phone}
            onChange={(v) => update("phone", v)}
          />
          {errors.phone && (
            <p className="text-xs text-destructive">{errors.phone}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="parentEmail">
            Parent Email{" "}
            <span className="text-xs font-normal text-muted-foreground">
              (optional)
            </span>
          </Label>
          <Input
            id="parentEmail"
            type="email"
            placeholder="parent@example.com"
            aria-invalid={!!errors.parentEmail}
            value={values.parentEmail}
            onChange={(e) => update("parentEmail", e.target.value)}
          />
          {errors.parentEmail && (
            <p className="text-xs text-destructive">{errors.parentEmail}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="subject">Subject</Label>
        <Input
          id="subject"
          placeholder="Mathematics"
          aria-invalid={!!errors.subject}
          value={values.subject}
          onChange={(e) => update("subject", e.target.value)}
        />
        {errors.subject && (
          <p className="text-xs text-destructive">{errors.subject}</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="expectedAmount">Expected Amount</Label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="expectedAmount"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              className="pl-9"
              aria-invalid={!!errors.expectedAmount}
              value={values.expectedAmount}
              onChange={(e) =>
                update("expectedAmount", e.target.valueAsNumber || 0)
              }
            />
          </div>
          {errors.expectedAmount && (
            <p className="text-xs text-destructive">
              {errors.expectedAmount}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="frequencyPerWeek">
            {values.rateType === "hourly"
              ? "Expected Hours Per Week"
              : "Expected Lessons Per Week"}
          </Label>
          <Input
            id="frequencyPerWeek"
            type="number"
            min="0"
            step="1"
            placeholder={values.rateType === "hourly" ? "e.g. 4" : "e.g. 2"}
            aria-invalid={!!errors.frequencyPerWeek}
            value={values.frequencyPerWeek}
            onChange={(e) =>
              update("frequencyPerWeek", e.target.valueAsNumber || 0)
            }
          />
          {errors.frequencyPerWeek && (
            <p className="text-xs text-destructive">
              {errors.frequencyPerWeek}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Rate Type</Label>
        <div className="grid grid-cols-2 gap-2">
          <ToggleOption
            checked={values.rateType === "hourly"}
            label="Hourly"
            onSelect={() => update("rateType", "hourly" as RateType)}
          />
          <ToggleOption
            checked={values.rateType === "per_lesson"}
            label="Per Lesson"
            onSelect={() => update("rateType", "per_lesson" as RateType)}
          />
        </div>
      </div>

      <Collapsible
        open={additionalOpen}
        onOpenChange={setAdditionalOpen}
        className="rounded-lg border"
      >
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-lg px-4 py-3 text-sm font-medium transition-colors hover:bg-accent"
          >
            <span>Additional details</span>
            <ChevronDown
              className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
                additionalOpen ? "rotate-180" : ""
              }`}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 p-4 pt-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-1">
          <div className="space-y-2 pt-4">
            <Label>Status</Label>
            <div className="grid grid-cols-2 gap-2">
              <ToggleOption
                checked={values.status === "active"}
                label="Active"
                onSelect={() => update("status", "active" as StudentStatus)}
              />
              <ToggleOption
                checked={values.status === "past"}
                label="Past"
                onSelect={() => update("status", "past" as StudentStatus)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="timezoneEnabled"
                checked={values.timezoneEnabled}
                onChange={(e) => update("timezoneEnabled", e.target.checked)}
              />
              <Label htmlFor="timezoneEnabled" className="cursor-pointer">
                Specify a timezone
              </Label>
            </div>
            {values.timezoneEnabled && (
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <select
                  id="timezone"
                  aria-invalid={!!errors.timezone}
                  value={values.timezone}
                  onChange={(e) => update("timezone", e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="" disabled>
                    Select a timezone
                  </option>
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {errors.timezone && (
              <p className="text-xs text-destructive">{errors.timezone}</p>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      <div className="space-y-2">
        <Label htmlFor="notes">
          Notes{" "}
          <span className="text-xs font-normal text-muted-foreground">
            (optional)
          </span>
        </Label>
        <textarea
          id="notes"
          rows={3}
          placeholder="Any extra details about this student..."
          aria-invalid={!!errors.notes}
          value={values.notes}
          onChange={(e) => update("notes", e.target.value)}
          className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  );
}

interface ToggleOptionProps {
  checked: boolean;
  label: string;
  onSelect: () => void;
}

function ToggleOption({ checked, label, onSelect }: ToggleOptionProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={checked}
      className={
        checked
          ? "inline-flex h-9 items-center justify-center rounded-md border border-primary bg-primary/10 px-3 text-sm font-medium text-primary transition-colors"
          : "inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
      }
    >
      {label}
    </button>
  );
}

export { ToggleOption };
