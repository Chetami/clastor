import { useState } from "react";
import { Mail } from "lucide-react";
import { MorphChevron } from "@/components/ui/morph-chevron";
import type { RateType, StudentStatus } from "@examify-tms/interfaces";
import { useUserCurrency, getCurrencySymbol } from "@/lib/use-currency";
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
import { SubjectMultiSelect } from "@/components/subjects/SubjectMultiSelect";
import { NumberInput } from "@/components/ui/number-input";
import {
  resolveBillingEmail,
  resolveBillingEmailSource,
} from "./student-utils";

interface StudentFormProps {
  defaultValues?: Partial<StudentFormData>;
  submitLabel: string;
  onCancel: () => void;
  onSubmit: (values: StudentFormData) => void;
  disabled?: boolean;
}

function toFormData(defaultValues?: Partial<StudentFormData>): StudentFormData {
  return { ...EMPTY_STUDENT_FORM, ...defaultValues };
}

type FieldErrors = Partial<Record<keyof StudentFormData, string>>;

export function StudentForm({
  defaultValues,
  submitLabel,
  onCancel,
  onSubmit,
  disabled = false,
}: StudentFormProps) {
  const [values, setValues] = useState<StudentFormData>(
    toFormData(defaultValues),
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [additionalOpen, setAdditionalOpen] = useState(false);
  const [billingOpen, setBillingOpen] = useState(false);
  const currencySymbol = getCurrencySymbol(useUserCurrency());

  const billingAutoSource = resolveBillingEmailSource(null, values.parentEmail);
  const billingAutoEmail = resolveBillingEmail(
    null,
    values.parentEmail,
    values.email,
  );
  const billingAutoSourceLabel =
    billingAutoSource === "parent" ? "parent email" : "student email";

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

      <Collapsible
        open={billingOpen}
        onOpenChange={setBillingOpen}
        className="rounded-lg border"
      >
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-lg px-4 py-3 text-sm font-medium transition-colors hover:bg-accent"
          >
            <span>Billing</span>
            <MorphChevron open={billingOpen} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 p-4 pt-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-1">
          <div className="space-y-2 pt-4">
            <Label>Billing Email</Label>
            <div className="grid grid-cols-2 gap-2">
              <ToggleOption
                checked={values.billingEmailMode === "auto"}
                label="Auto"
                onSelect={() => update("billingEmailMode", "auto" as const)}
              />
              <ToggleOption
                checked={values.billingEmailMode === "custom"}
                label="Custom"
                onSelect={() => update("billingEmailMode", "custom" as const)}
              />
            </div>
            {values.billingEmailMode === "auto" ? (
              <div className="flex items-start gap-2 rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-sm">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <p className="text-muted-foreground">
                  Invoices will be sent to{" "}
                  <span className="font-medium text-foreground">
                    {billingAutoEmail}
                  </span>{" "}
                  ({billingAutoSourceLabel})
                </p>
              </div>
            ) : (
              <div className="space-y-2 pt-2">
                <Input
                  id="billingEmail"
                  type="email"
                  placeholder="billing@example.com"
                  aria-invalid={!!errors.billingEmail}
                  value={values.billingEmail}
                  onChange={(e) => update("billingEmail", e.target.value)}
                />
                {errors.billingEmail && (
                  <p className="text-xs text-destructive">
                    {errors.billingEmail}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Auto would use {billingAutoEmail} ({billingAutoSourceLabel}).
                  Use a custom address if invoices should go elsewhere.
                </p>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      <div className="space-y-2">
        <Label htmlFor="subject">Subjects</Label>
        <SubjectMultiSelect
          value={values.subjectIds}
          onChange={(ids) => update("subjectIds", ids)}
          invalid={!!errors.subjectIds}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="expectedAmount">Expected Amount</Label>
          <div className="relative">
            <NumberInput
              id="expectedAmount"
              min={0}
              placeholder={`${currencySymbol}0.00`}
              value={values.expectedAmount}
              prefix={currencySymbol}
              aria-invalid={!!errors.expectedAmount}
              decimalScale={2}
              onValueChange={(number) => update("expectedAmount", number || 0)}
            />
          </div>
          {errors.expectedAmount && (
            <p className="text-xs text-destructive">{errors.expectedAmount}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="frequencyPerWeek">
            {values.rateType === "hourly"
              ? "Expected Hours Per Week"
              : "Expected Lessons Per Week"}
          </Label>
          <NumberInput
            id="frequencyPerWeek"
            min={0}
            placeholder={values.rateType === "hourly" ? "e.g. 4" : "e.g. 2"}
            aria-invalid={!!errors.frequencyPerWeek}
            value={values.frequencyPerWeek}
            onValueChange={(number) => update("frequencyPerWeek", number || 0)}
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
            <MorphChevron open={additionalOpen} />
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
                onCheckedChange={(checked) => update("timezoneEnabled", checked === true)}
                disabled
              />
              <Label
                htmlFor="timezoneEnabled"
                className="text-muted-foreground/60"
              >
                Specify a timezone
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">
              We're working on supporting custom timezones in the future.
            </p>
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
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={disabled}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={disabled}>
          {submitLabel}
        </Button>
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
