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
