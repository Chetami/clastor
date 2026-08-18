/**
 * Onboarding wizard step definitions and pure step-resolution helpers.
 * Extracted from OnboardingPage so the (browser-dependent) resolution rules
 * can be unit-tested without mounting the wizard.
 */

export const STEPS = [
  { key: "welcome", label: "Welcome" },
  { key: "subjects", label: "Subjects" },
  { key: "student", label: "First student" },
  { key: "lesson", label: "First lesson" },
  { key: "google", label: "Calendar" },
  { key: "finish", label: "All set" },
] as const;

export type StepKey = (typeof STEPS)[number]["key"];
export const STEP_KEYS: readonly StepKey[] = STEPS.map((s) => s.key);

/**
 * Steps that represent real setup work. "welcome" and "finish" are
 * ceremonial, so the progress indicator counts only these — otherwise the
 * bar starts at "Step 1 of 6" before the tutor has done anything.
 */
export const WORKING_STEP_KEYS: readonly StepKey[] = [
  "subjects",
  "student",
  "lesson",
  "google",
];

export type StepProgress = {
  /** "Step k of n" counter; null on ceremonial steps. */
  label: string | null;
  /** Progress bar value, 0–100. */
  value: number;
};

/**
 * Resolve the "Step k of n" label and progress-bar value for the active
 * step, counting only working steps. Welcome reads as an untouched bar,
 * finish as a full one — regardless of whether the calendar step was
 * filtered out.
 */
export function resolveStepProgress(
  key: StepKey,
  steps: readonly StepKey[],
): StepProgress {
  const working = steps.filter((k) => WORKING_STEP_KEYS.includes(k));
  const i = working.indexOf(key);
  if (i === -1) {
    return key === "finish"
      ? { label: null, value: 100 }
      : { label: null, value: 0 };
  }
  return {
    label: `Step ${i + 1} of ${working.length}`,
    value: ((i + 1) / working.length) * 100,
  };
}

export const STEP_STORAGE_KEY = "onboardingStep";

export function readStoredStep(): StepKey {
  try {
    const raw = sessionStorage.getItem(STEP_STORAGE_KEY);
    if (raw == null) return "welcome";
    if ((STEP_KEYS as readonly string[]).includes(raw)) return raw as StepKey;
    // Legacy format: the step was persisted as a numeric index.
    const n = Number(raw);
    if (Number.isInteger(n) && n >= 0 && n < STEP_KEYS.length) {
      return STEP_KEYS[n];
    }
    return "welcome";
  } catch {
    return "welcome";
  }
}

/**
 * Resolve a (possibly removed) step key to an index in the visible step list.
 * When the current step was filtered out — e.g. the calendar step because the
 * tutor connected Google during signup — resume on the first surviving step
 * that came after it.
 */
export function resolveStepIndex(
  key: StepKey,
  steps: readonly StepKey[],
): number {
  const i = steps.indexOf(key);
  if (i !== -1) return i;
  const order = STEP_KEYS.indexOf(key);
  for (let j = order + 1; j < STEP_KEYS.length; j++) {
    const k = steps.indexOf(STEP_KEYS[j]);
    if (k !== -1) return k;
  }
  return steps.length - 1;
}

/**
 * Pick the step the wizard opens on. Returning from the Google consent flow
 * comes back with a `google` param — but only honor it when the user had
 * actually reached the calendar step, otherwise a brand-new Google signup
 * (redirected straight to /onboarding?google=connected with no progress)
 * would resolve past the filtered-out calendar step and land on "finish",
 * skipping the entire activation wizard.
 */
export function resolveInitialStep(
  params: URLSearchParams,
  stored: StepKey,
): StepKey {
  if (
    params.has("google") &&
    STEP_KEYS.indexOf(stored) >= STEP_KEYS.indexOf("google")
  ) {
    return "google";
  }
  return stored;
}
