import { useEffect, useRef } from "react";
import { Check, ListTodo, Plus, Trash2 } from "lucide-react";
import type { UseMutationResult } from "@tanstack/react-query";
import type {
  LessonResponse,
  LessonTodo,
  UpdateLessonRequest,
} from "@examify-tms/interfaces";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLessonChecklist } from "./use-lesson-checklist";
import { AutoGrowTextarea, SaveStatus } from "./ui";

type UpdateLessonMutation = UseMutationResult<
  LessonResponse,
  Error,
  UpdateLessonRequest
>;

interface LessonChecklistProps {
  eventId: string | undefined;
  lesson: LessonResponse;
  updateLesson: UpdateLessonMutation;
}

/**
 * Per-lesson checklist with add / toggle / edit / delete and auto-save.
 * Keyboard-friendly: Enter inserts a new item below, Backspace on an empty
 * item removes it. Self-contained: owns its list state via
 * {@link useLessonChecklist}.
 */
export function LessonChecklist({
  eventId,
  lesson,
  updateLesson,
}: LessonChecklistProps) {
  const {
    todos,
    todosDone,
    todosTotal,
    todosSaving,
    todosDirty,
    focusId,
    clearFocus,
    newTodoText,
    setNewTodoText,
    handleToggleTodo,
    handleAddTodo,
    handleDeleteTodo,
    handleClearCompleted,
    handleTodoTextChange,
    handleTodoBlur,
    handleItemKeyDown,
  } = useLessonChecklist(eventId, lesson, updateLesson);

  const pct = todosTotal > 0 ? Math.round((todosDone / todosTotal) * 100) : 0;
  const allDone = todosTotal > 0 && todosDone === todosTotal;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2">
            <ListTodo className="h-4 w-4" />
            Checklist
            {todosTotal > 0 && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-normal tabular-nums text-muted-foreground">
                {todosDone}/{todosTotal}
              </span>
            )}
          </span>
          <span className="flex items-center gap-1">
            {todosDone > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground"
                onClick={handleClearCompleted}
                disabled={todosSaving}
              >
                Clear done
              </Button>
            )}
            <SaveStatus dirty={todosDirty} saving={todosSaving} />
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {todosTotal > 0 && (
          <div className="space-y-1.5">
            <Progress
              value={pct}
              className={cn(
                "h-1.5",
                allDone &&
                  "[&_[data-slot=progress-indicator]]:bg-emerald-500",
              )}
            />
            {allDone ? (
              <p className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <Check className="h-3 w-3" />
                All tasks complete
              </p>
            ) : (
              <p className="text-xs tabular-nums text-muted-foreground">
                {pct}% complete
              </p>
            )}
          </div>
        )}

        {todos.length > 0 ? (
          <ul className="space-y-0.5">
            {todos.map((todo) => (
              <ChecklistItem
                key={todo.id}
                todo={todo}
                requestFocus={focusId === todo.id}
                onFocused={clearFocus}
                onToggle={handleToggleTodo}
                onTextChange={handleTodoTextChange}
                onBlur={handleTodoBlur}
                onDelete={handleDeleteTodo}
                onKeyDown={handleItemKeyDown}
              />
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-6 text-center">
            <ListTodo className="mb-1.5 h-5 w-5 text-muted-foreground/50" />
            <p className="text-sm font-medium">No tasks yet</p>
            <p className="text-xs text-muted-foreground">
              Outline prep, topics, or follow-ups.
            </p>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAddTodo();
          }}
          className="flex items-center gap-2 rounded-md border border-input/60 px-2.5 py-1.5 transition-colors focus-within:border-primary focus-within:bg-muted/30"
        >
          <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            type="text"
            value={newTodoText}
            onChange={(e) => setNewTodoText(e.target.value)}
            placeholder="Add a task…"
            aria-label="Add a task"
            className="min-w-0 flex-1 border-none bg-transparent py-0.5 text-sm outline-none placeholder:text-muted-foreground/70"
          />
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 px-2 text-xs"
            disabled={!newTodoText.trim()}
          >
            Add
          </Button>
        </form>

        {todos.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Press{" "}
            <kbd className="rounded border px-1 py-0.5 text-[10px]">Enter</kbd>{" "}
            on a task to add another.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

interface ChecklistItemProps {
  todo: LessonTodo;
  requestFocus: boolean;
  onFocused: () => void;
  onToggle: (id: string) => void;
  onTextChange: (id: string, text: string) => void;
  onBlur: (id: string) => void;
  onDelete: (id: string) => void;
  onKeyDown: (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
    id: string,
  ) => void;
}

function ChecklistItem({
  todo,
  requestFocus,
  onFocused,
  onToggle,
  onTextChange,
  onBlur,
  onDelete,
  onKeyDown,
}: ChecklistItemProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!requestFocus) return;
    const el = ref.current;
    if (!el) return;
    el.focus();
    const len = el.value.length;
    el.setSelectionRange(len, len);
    onFocused();
  }, [requestFocus, onFocused]);

  return (
    <li className="group flex items-start gap-2.5 rounded-md px-1.5 py-1 transition-colors hover:bg-muted/40 focus-within:bg-muted/40">
      <button
        type="button"
        role="checkbox"
        aria-checked={todo.done}
        aria-label={todo.done ? "Mark incomplete" : "Mark complete"}
        onClick={() => onToggle(todo.id)}
        className={cn(
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          todo.done
            ? "border-primary bg-primary text-primary-foreground"
            : "border-input hover:border-primary/60",
        )}
      >
        <Check
          className={cn(
            "h-3 w-3 transition-transform duration-150",
            todo.done ? "scale-100" : "scale-0",
          )}
        />
      </button>
      <AutoGrowTextarea
        ref={ref}
        value={todo.text}
        placeholder="Task details…"
        onChange={(e) => onTextChange(todo.id, e.target.value)}
        onBlur={() => onBlur(todo.id)}
        onKeyDown={(e) => onKeyDown(e, todo.id)}
        className={cn(
          "min-h-0 min-w-0 resize-none overflow-hidden rounded-none border-none bg-transparent px-0 py-0 text-sm leading-6 shadow-none outline-none ring-0 placeholder:text-muted-foreground/60 focus-visible:border-none focus-visible:ring-0",
          todo.done ? "text-muted-foreground line-through" : "text-foreground",
        )}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => onDelete(todo.id)}
        aria-label="Delete task"
        className="mt-0.5 shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-focus-within:opacity-100 group-hover:opacity-100"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}
