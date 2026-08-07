import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ListTodo, Plus, Trash2 } from "lucide-react";
import type { UseMutationResult } from "@tanstack/react-query";
import type { LessonResponse, UpdateLessonRequest } from "@examify-tms/interfaces";
import { cn } from "@/lib/utils";
import { useLessonChecklist } from "./use-lesson-checklist";
import { AutoGrowTextarea } from "./ui";

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
 * Self-contained: owns its list state via {@link useLessonChecklist}.
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
    newTodoText,
    setNewTodoText,
    handleToggleTodo,
    handleAddTodo,
    handleDeleteTodo,
    handleTodoTextChange,
    handleTodoBlur,
  } = useLessonChecklist(eventId, lesson, updateLesson);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <ListTodo className="h-4 w-4" />
            Checklist
          </span>
          {todosTotal > 0 && (
            <span className="text-xs font-normal text-muted-foreground">
              {todosDone} of {todosTotal} done
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {todosTotal > 0 && (
          <Progress value={(todosDone / todosTotal) * 100} className="h-1.5" />
        )}
        {todos.length > 0 && (
          <ul className="space-y-1">
            {todos.map((todo) => (
              <li key={todo.id} className="group flex items-start gap-2.5">
                <button
                  type="button"
                  className="mt-0.5 shrink-0 text-muted-foreground transition-colors hover:text-foreground"
                  onClick={() => handleToggleTodo(todo.id)}
                  aria-label={todo.done ? "Mark incomplete" : "Mark complete"}
                >
                  {todo.done ? (
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  ) : (
                    <span className="block h-4 w-4 rounded-full border border-current" />
                  )}
                </button>
                <AutoGrowTextarea
                  value={todo.text}
                  onChange={(e) => handleTodoTextChange(todo.id, e.target.value)}
                  onBlur={() => handleTodoBlur(todo.id)}
                  className={cn(
                    "min-w-0 flex-1 resize-none overflow-hidden border-none bg-transparent p-0 text-sm outline-none transition-colors",
                    todo.done
                      ? "text-muted-foreground line-through"
                      : "text-foreground",
                  )}
                />
                <button
                  type="button"
                  className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 focus:opacity-100"
                  onClick={() => handleDeleteTodo(todo.id)}
                  aria-label="Delete task"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newTodoText}
            onChange={(e) => setNewTodoText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddTodo();
            }}
            placeholder="Add a task…"
            className="min-w-0 flex-1 border-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 shrink-0 p-0"
            disabled={!newTodoText.trim()}
            onClick={handleAddTodo}
            aria-label="Add task"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
