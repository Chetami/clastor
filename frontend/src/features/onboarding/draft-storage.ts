/**
 * Drafts for the two data-entry steps of onboarding (add-first-student and
 * schedule-first-lesson) are stashed in sessionStorage so navigating Back
 * within the wizard — which unmounts the step component and remounts it on
 * return — doesn't discard what the user typed. Cleared on wizard finish.
 */
const KEY = "onboardingDrafts";

export type StudentDraft = {
  name: string;
  email: string;
  subjectIds: string[];
  expectedAmount: number;
  rateType: "hourly" | "per_lesson";
};

export type LessonDraft = {
  studentId: string;
  subjectId: string;
  date: string;
  startTime: string;
  duration: number;
};

export type OnboardingDrafts = {
  student?: StudentDraft;
  lesson?: LessonDraft;
};

export function loadDrafts(): OnboardingDrafts {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return {};
    return JSON.parse(raw) as OnboardingDrafts;
  } catch {
    return {};
  }
}

export function saveDrafts(drafts: OnboardingDrafts): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(drafts));
  } catch {
    // ignore — private mode / storage disabled
  }
}

export function clearDrafts(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
