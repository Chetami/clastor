import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { UserPlus } from "lucide-react";
import type { CreateStudentRequest, RateType } from "@examify-tms/interfaces";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/ui/number-input";
import { SubjectMultiSelect } from "@/components/subjects/SubjectMultiSelect";
import { ToggleOption } from "@/features/students/StudentForm";
import { useCreateStudent } from "@/features/students/api/use-create-student";
import { useUserCurrency, getCurrencySymbol } from "@/lib/use-currency";
import { track } from "@/lib/analytics";
import { loadDrafts, saveDrafts, type StudentDraft } from "../draft-storage";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const AUTO_ADVANCE_MS = 1200;

export type AddStudentStepHandle = {
  submit: () => Promise<void>;
};

type AddStudentPhase = "form" | "success";

type AddStudentStepState = {
  phase: AddStudentPhase;
  autoAdvance: boolean;
  canSubmit: boolean;
  isPending: boolean;
  error: string | null;
};

type AddStudentStepProps = {
  hasStudents: boolean;
  onAdvance: () => void;
  onStateChange: (state: AddStudentStepState) => void;
};

/**
 * Slim "add your first student" form. Captures just enough to be useful
 * (name required; email optional) and creates a real student record via the
 * imperative submit handle — the parent wizard owns the footer "Add student"
 * action and gates it on a name. The hourly rate is surfaced (rather than
 * silently defaulted) because it drives invoicing; leaving it blank is fine
 * and records $0, but the user has seen it. After a successful create it
 * plays a checkmark animation and auto-advances to the next step. If
 * revisited after a student already exists, it shows the confirmation
 * statically (no auto-advance) so the parent's Continue can move on.
 */
export const AddStudentStep = forwardRef<
  AddStudentStepHandle,
  AddStudentStepProps
>(function AddStudentStep({ hasStudents, onAdvance, onStateChange }, ref) {
  const createStudent = useCreateStudent();
  const currency = useUserCurrency();
  const currencySymbol = getCurrencySymbol(currency);

  const persisted = loadDrafts().student;

  // "success" is only reached via a real create in this session. Returning to
  // the step after a student already exists starts in a static (non-auto-
  // advancing) success view.
  const [created, setCreated] = useState(false);

  const [name, setName] = useState(persisted?.name ?? "");
  const [email, setEmail] = useState(persisted?.email ?? "");
  const [subjectIds, setSubjectIds] = useState<string[]>(
    persisted?.subjectIds ?? [],
  );
  const [expectedAmount, setExpectedAmount] = useState<number>(
    persisted?.expectedAmount ?? 50,
  );
  const [rateType, setRateType] = useState<RateType>(
    persisted?.rateType ?? "hourly",
  );
  const [emailError, setEmailError] = useState<string | undefined>();

  // Persist the draft whenever fields change so Back/forward doesn't lose it.
  useEffect(() => {
    const drafts = loadDrafts();
    const student: StudentDraft = {
      name,
      email,
      subjectIds,
      expectedAmount,
      rateType,
    };
    saveDrafts({ ...drafts, student });
  }, [name, email, subjectIds, expectedAmount, rateType]);

  const showSuccess = created || hasStudents;
  const autoAdvance = created;
  const phase: AddStudentPhase = showSuccess ? "success" : "form";

  useEffect(() => {
    onStateChange({
      phase,
      autoAdvance,
      canSubmit: name.trim().length > 0,
      isPending: createStudent.isPending,
      error: createStudent.error?.message ?? null,
    });
  }, [
    phase,
    autoAdvance,
    name,
    createStudent.isPending,
    createStudent.error,
    onStateChange,
  ]);

  // Auto-advance a beat after the success animation kicks in. The students
  // list refetch (triggered by the create) resolves well within this window,
  // so the next step mounts with fresh data.
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (phase === "success" && autoAdvance) {
      advanceTimer.current = setTimeout(onAdvance, AUTO_ADVANCE_MS);
    }
    return () => {
      if (advanceTimer.current) {
        clearTimeout(advanceTimer.current);
        advanceTimer.current = null;
      }
    };
  }, [phase, autoAdvance, onAdvance]);

  useImperativeHandle(
    ref,
    () => ({
      async submit() {
        if (email.trim() && !EMAIL_RE.test(email.trim())) {
          setEmailError("Enter a valid email");
          return;
        }
        setEmailError(undefined);
        const payload: CreateStudentRequest = {
          name: name.trim(),
          email: email.trim() || null,
          phone: null,
          parentEmail: null,
          billingEmail: null,
          subjectIds,
          expectedAmount,
          rateType,
          frequencyPerWeek: 0,
          status: "active",
          timezone: null,
          notes: null,
        };
        try {
          await createStudent.mutateAsync(payload);
          track("onboarding_student_created", { expectedAmount });
          setCreated(true);
        } catch {
          // surfaced via mutation state
        }
      },
    }),
    [name, email, subjectIds, expectedAmount, rateType, createStudent],
  );

  if (showSuccess) {
    return (
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <svg
          viewBox="0 0 52 52"
          className="size-14 overflow-visible text-emerald-500"
          aria-hidden="true"
        >
          <circle
            cx="26"
            cy="26"
            r="24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            className="ob-success-circle"
          />
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14 27 l8 8 l16 -16"
            className="ob-success-check"
          />
        </svg>
        <div className="ob-success-text flex flex-col gap-1">
          <h2 className="text-lg font-semibold tracking-tight">
            Student added
          </h2>
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">
            {autoAdvance
              ? "Taking you to the next step\u2026"
              : "Continue to schedule their first lesson."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <UserPlus className="size-4" />
          Add your first student
        </h2>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ob-student-name">Full name</Label>
          <Input
            id="ob-student-name"
            value={name}
            placeholder="e.g. Alex Chen"
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ob-student-email">
            Email{" "}
            <span className="text-xs font-normal text-muted-foreground">
              (optional)
            </span>
          </Label>
          <Input
            id="ob-student-email"
            type="email"
            value={email}
            placeholder="e.g. alex@example.com"
            onChange={(e) => setEmail(e.target.value)}
          />
          {emailError && (
            <span className="text-xs text-destructive">{emailError}</span>
          )}
          <p className="text-xs text-muted-foreground">
            Allows Clastor to send notifications on your behalf
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>
            Subjects{" "}
            <span className="text-xs font-normal text-muted-foreground">
              (optional)
            </span>
          </Label>
          <SubjectMultiSelect
            value={subjectIds}
            onChange={setSubjectIds}
            allowCreate={false}
            bordered={false}
          />
          <p className="text-xs text-muted-foreground">
            Tap a subject to select it. You can change this later.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>
            Rate{" "}
            <span className="text-xs font-normal text-muted-foreground">
              (optional)
            </span>
          </Label>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="grid grid-cols-2 gap-2 sm:w-auto">
              <ToggleOption
                checked={rateType === "hourly"}
                label="Per hour"
                onSelect={() => setRateType("hourly")}
              />
              <ToggleOption
                checked={rateType === "per_lesson"}
                label="Per lesson"
                onSelect={() => setRateType("per_lesson")}
              />
            </div>
            <NumberInput
              id="ob-student-rate"
              min={0}
              decimalScale={2}
              prefix={currencySymbol}
              placeholder={`${currencySymbol}0.00`}
              value={expectedAmount}
              onValueChange={(n) => setExpectedAmount(n || 0)}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Used as the default when invoicing this student. You can change it
            later.
          </p>
        </div>
      </div>
    </div>
  );
});
