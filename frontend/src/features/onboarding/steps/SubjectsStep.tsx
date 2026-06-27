import { useState } from "react";
import { Palette, Plus, X } from "lucide-react";
import type { Subject } from "@examify-tms/interfaces";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { generateSubjectId, useSubjects } from "@/lib/subjects";
import { useUpdateSubjects } from "@/features/subjects/api/use-update-subjects";

const SUGGESTIONS = [
  "Mathematics",
  "English",
  "Science",
  "Physics",
  "Chemistry",
  "Biology",
];

/**
 * Quick subject catalogue setup. Changes persist immediately (full
 * replacement via PATCH /api/users/me), so there's no separate "save" — just
 * add a few subjects and continue. Skippable.
 */
export function SubjectsStep() {
  const subjects = useSubjects();
  const updateSubjects = useUpdateSubjects();
  const [draft, setDraft] = useState("");

  const existingNames = new Set(subjects.map((s) => s.name.toLowerCase()));

  function commit(next: Subject[]) {
    updateSubjects.mutate(next);
  }

  function addSubject(raw: string) {
    const name = raw.trim();
    if (!name) return;
    if (existingNames.has(name.toLowerCase())) {
      setDraft("");
      return;
    }
    commit([...subjects, { id: generateSubjectId(), name, color: null }]);
    setDraft("");
  }

  function removeSubject(id: string) {
    commit(subjects.filter((s) => s.id !== id));
  }

  const remainingSuggestions = SUGGESTIONS.filter(
    (s) => !existingNames.has(s.toLowerCase()),
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <Palette className="size-4" />
          What do you teach?
        </h2>
        <p className="text-sm text-muted-foreground">
          Add the subjects you tutor. You'll tag students and lessons with
          these. You can always change them later in Settings.
        </p>
      </div>

      <div className="flex gap-2">
        <Input
          value={draft}
          placeholder="e.g. Mathematics"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addSubject(draft);
            }
          }}
          disabled={updateSubjects.isPending}
        />
        <Button
          type="button"
          onClick={() => addSubject(draft)}
          disabled={updateSubjects.isPending || !draft.trim()}
        >
          <Plus className="size-4" />
          Add
        </Button>
      </div>

      {subjects.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {subjects.map((subject) => (
            <span
              key={subject.id}
              className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 py-1 pl-3 pr-1.5 text-sm"
            >
              {subject.name}
              <button
                type="button"
                onClick={() => removeSubject(subject.id)}
                disabled={updateSubjects.isPending}
                className="inline-flex size-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label={`Remove ${subject.name}`}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
          No subjects yet — add at least one to tag your students.
        </p>
      )}

      {remainingSuggestions.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-xs text-muted-foreground">Quick add</span>
          <div className="flex flex-wrap gap-2">
            {remainingSuggestions.map((name) => (
              <Button
                key={name}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addSubject(name)}
                disabled={updateSubjects.isPending}
              >
                <Plus className="size-3" />
                {name}
              </Button>
            ))}
          </div>
        </div>
      )}

      {updateSubjects.isError && (
        <p className="text-xs text-destructive">{updateSubjects.error.message}</p>
      )}
    </div>
  );
}
