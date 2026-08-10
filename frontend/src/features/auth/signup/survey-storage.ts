import type { SignupSurvey } from "@examify-tms/interfaces";

/**
 * The pre-signup qualifier survey answers are stashed in sessionStorage on the
 * landing flow and read back by the account-creation screen so they can be
 * forwarded to /api/auth/register and persisted on the user document.
 * sessionStorage survives the in-app navigation and is cleared once the
 * account is created (or abandoned on tab close).
 */
const KEY = "signupSurvey";

export function saveSurvey(survey: SignupSurvey): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(survey));
  } catch {
    // ignore — private mode / storage disabled
  }
}

export function loadSurvey(): SignupSurvey | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SignupSurvey;
  } catch {
    return null;
  }
}

export function clearSurvey(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
