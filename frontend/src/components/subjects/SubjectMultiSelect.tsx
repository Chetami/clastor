import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useSubjects, generateSubjectId } from "@/lib/subjects";
import { useUpdateSubjects } from "@/features/subjects/api/use-update-subjects";

interface SubjectMultiSelectProps {
  value: string[];
  onChange: (ids: string[]) => void;
  invalid?: boolean;
}

/**
 * Tag picker for a student's subjects. Shows the tutor's catalogue as
 * toggleable chips and allows inline quick-create of a new subject (which is
 * added to the catalogue and selected in one step).
 */
export function SubjectMultiSelect({
  value,
  onChange,
  invalid,
}: SubjectMultiSelectProps) {
  const subjects = useSubjects();
  const updateSubjects = useUpdateSubjects();
  const [newName, setNewName] = useState("");

  function toggle(id: string) {
    onChange(
      value.includes(id) ? value.filter((v) => v !== id) : [...value, id],
    );
  }

  async function addNew() {
    const name = newName.trim();
    if (!name || updateSubjects.isPending) return;
    const id = generateSubjectId();
    await updateSubjects.mutateAsync([
      ...subjects,
      { id, name, color: null },
    ]);
    onChange([...value, id]);
    setNewName("");
  }

  return (
    <div className="space-y-2">
      {subjects.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          You don't have any subjects yet. Add one below — it'll be saved to
          your catalogue.
        </p>
      ) : (
        <div
          className={cn(
            "flex flex-wrap gap-2 rounded-md border p-2",
            invalid && "border-destructive",
          )}
        >
          {subjects.map((s) => {
            const selected = value.includes(s.id);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => toggle(s.id)}
                aria-pressed={selected}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors",
                  selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-background hover:bg-accent",
                )}
              >
                {s.color && (
                  <span
                    className="size-2 rounded-full"
                    style={{
                      backgroundColor: s.color,
                      // Keep the dot visible on a filled (selected) chip.
                      boxShadow: "0 0 0 1px rgba(255,255,255,0.4)",
                    }}
                  />
                )}
                {s.name}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void addNew();
            }
          }}
          placeholder="Add a new subject..."
          className="flex-1"
          disabled={updateSubjects.isPending}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void addNew()}
          disabled={!newName.trim() || updateSubjects.isPending}
        >
          <Plus className="size-4" />
          Add
        </Button>
      </div>
      {invalid && <p className="text-xs text-destructive">Select at least one subject</p>}
    </div>
  );
}
