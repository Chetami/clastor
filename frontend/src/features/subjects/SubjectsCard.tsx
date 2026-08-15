import { useEffect, useState } from "react";
import { Eraser, Loader2, Palette, Plus, Trash2 } from "lucide-react";
import type { Subject } from "@examify-tms/interfaces";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useSubjects, generateSubjectId } from "@/lib/subjects";
import { useUpdateSubjects } from "./api/use-update-subjects";

function isHexColor(value: string | null | undefined): value is string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

/** Default swatch shown by the native color input when no color is set. */
const DEFAULT_PICKER_COLOR = "#6366f1";

/**
 * Settings card for managing the tutor's subject catalogue. Edits are kept in
 * a local draft and committed with "Save changes". Removing a subject also
 * removes it from any students tagged with it (handled server-side).
 */
export function SubjectsCard() {
  const saved = useSubjects();
  const updateSubjects = useUpdateSubjects();

  const [draft, setDraft] = useState<Subject[]>(saved);

  // Re-sync the working copy whenever the saved catalogue changes (e.g. after
  // a successful save, or an inline quick-create from the student form).
  useEffect(() => {
    setDraft(saved);
  }, [saved]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  function addSubject() {
    setDraft((prev) => [
      ...prev,
      { id: generateSubjectId(), name: "", color: null },
    ]);
  }

  function updateSubject(id: string, patch: Partial<Subject>) {
    setDraft((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    );
  }

  function removeSubject(id: string) {
    setDraft((prev) => prev.filter((s) => s.id !== id));
  }

  async function handleSave() {
    // Drop blank names before persisting (the backend does the same, but
    // cleaning here keeps the dirty flag honest).
    const cleaned = draft
      .map((s) => ({ ...s, name: s.name.trim() }))
      .filter((s) => s.name.length > 0);
    try {
      await updateSubjects.mutateAsync(cleaned);
    } catch {
      // surfaced via updateSubjects.isError below — swallow the rejection
      // so it doesn't become an unhandled promise error.
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="size-4" />
          Subjects
        </CardTitle>
        <CardDescription>
          The subjects you teach. Tag students with these from their profile.
          Removing a subject also removes it from any students tagged with it.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {draft.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No subjects yet. Add your first subject to start tagging students.
          </p>
        ) : (
          draft.map((subject) => {
            const swatchColor = isHexColor(subject.color)
              ? subject.color
              : null;
            return (
              <div key={subject.id} className="flex items-center gap-3">
                <label className="relative size-9 shrink-0 cursor-pointer overflow-hidden rounded-md border">
                  <span
                    className="absolute inset-0"
                    style={{
                      backgroundColor: swatchColor ?? "var(--muted)",
                    }}
                  />
                  <input
                    type="color"
                    value={
                      isHexColor(subject.color)
                        ? subject.color
                        : DEFAULT_PICKER_COLOR
                    }
                    onChange={(e) =>
                      updateSubject(subject.id, { color: e.target.value })
                    }
                    disabled={updateSubjects.isPending}
                    className="absolute inset-0 cursor-pointer opacity-0"
                    aria-label={`Colour for ${
                      subject.name || "new subject"
                    }`}
                  />
                </label>
                <Input
                  value={subject.name}
                  placeholder="e.g. Mathematics"
                  onChange={(e) =>
                    updateSubject(subject.id, { name: e.target.value })
                  }
                  disabled={updateSubjects.isPending}
                  className="flex-1"
                />
                {swatchColor && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      updateSubject(subject.id, { color: null })
                    }
                    disabled={updateSubjects.isPending}
                    aria-label="Clear colour"
                    title="Clear colour"
                  >
                    <Eraser className="size-4 text-muted-foreground" />
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeSubject(subject.id)}
                  disabled={updateSubjects.isPending}
                  aria-label="Remove subject"
                >
                  <Trash2 className="size-4 text-muted-foreground" />
                </Button>
              </div>
            );
          })
        )}

        <div className="flex items-center justify-between pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addSubject}
            disabled={updateSubjects.isPending}
          >
            <Plus className="size-4" />
            Add subject
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!dirty || updateSubjects.isPending}
          >
            {updateSubjects.isPending && (
              <Loader2 className="size-4 animate-spin" />
            )}
            Save changes
          </Button>
        </div>

        {updateSubjects.isError && (
          <p className="text-xs text-destructive">
            {updateSubjects.error.message}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
