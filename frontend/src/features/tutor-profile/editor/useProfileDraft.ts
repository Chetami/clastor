import { useEffect, useMemo, useRef, useState } from "react";
import {
  EMPTY_TUTOR_PROFILE_FORM,
  type TutorProfileFormData,
} from "../tutor-profile-schema";

const serialize = (v: TutorProfileFormData): string => JSON.stringify(v);

function draftKey(uid: string | undefined): string | null {
  return uid ? `examify-tms:profile-draft:${uid}` : null;
}

function loadDraft(key: string | null): TutorProfileFormData | null {
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    // Merge over the empty form so unknown/missing keys fall back to defaults
    // and a stale draft from an older schema can't break the editor.
    return { ...EMPTY_TUTOR_PROFILE_FORM, ...parsed };
  } catch {
    return null;
  }
}

function writeDraft(key: string | null, values: TutorProfileFormData) {
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(values));
  } catch {
    // Quota or private-mode errors are non-fatal — just skip persisting.
  }
}

function clearDraft(key: string | null) {
  if (!key) return;
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/**
 * Owns the tutor-profile form draft + its localStorage persistence.
 *
 * A stored draft is restored on first load (taking priority over the saved
 * profile so resumed edits come back); after that one-time hydration the form
 * is never overwritten by background refetches. Unsaved changes are persisted
 * while dirty, and the draft is cleared automatically once the form is back in
 * sync with the server (i.e. after a save/publish).
 *
 * @param uid        the tutor's user id (scopes the draft key)
 * @param baseline   the server-side form values (recomputed when the profile loads)
 * @param isLoading  whether the profile is still loading (delays hydration)
 */
export function useProfileDraft(
  uid: string | undefined,
  baseline: TutorProfileFormData,
  isLoading: boolean,
): {
  values: TutorProfileFormData;
  setValues: React.Dispatch<React.SetStateAction<TutorProfileFormData>>;
  isDirty: boolean;
} {
  const storageKey = draftKey(uid);
  const [values, setValues] = useState<TutorProfileFormData>(
    EMPTY_TUTOR_PROFILE_FORM,
  );

  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current || isLoading) return;
    hydratedRef.current = true;
    setValues(loadDraft(storageKey) ?? baseline);
    // baseline is intentionally excluded — it's only needed for the one-time
    // seed, and re-running when it changes would clobber in-flight edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, storageKey]);

  const isDirty = useMemo(
    () => serialize(values) !== serialize(baseline),
    [values, baseline],
  );

  // Persist while there are unsaved changes; clear once we're back in sync.
  useEffect(() => {
    if (!hydratedRef.current) return;
    if (isDirty) writeDraft(storageKey, values);
    else clearDraft(storageKey);
  }, [values, isDirty, storageKey]);

  return { values, setValues, isDirty };
}
