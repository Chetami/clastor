import { useRef, useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import type { UseMutationResult } from "@tanstack/react-query";
import type { LessonResponse, LessonTodo, UpdateLessonRequest } from "@examify-tms/interfaces";

type UpdateLessonMutation = UseMutationResult<
  LessonResponse,
  Error,
  UpdateLessonRequest
>;

/**
 * Owns the per-lesson checklist (todos): add / toggle / edit / delete with
 * auto-save. A ref mirror keeps blur handlers saving the freshest list, and the
 * list re-syncs from the server whenever the active lesson id changes.
 *
 * Empty todos are dropped on blur (they only add noise), mirroring the original
 * inline behaviour.
 */
export function useLessonChecklist(
  eventId: string | undefined,
  lesson: LessonResponse | undefined,
  updateLesson: UpdateLessonMutation,
) {
  const [todos, setTodos] = useState<LessonTodo[]>([]);
  const [newTodoText, setNewTodoText] = useState("");
  const todosRef = useRef<LessonTodo[]>([]);
  const lastSyncedId = useRef<string | null>(null);

  useEffect(() => {
    if (!lesson) return;
    if (lastSyncedId.current === lesson.id) return;
    lastSyncedId.current = lesson.id;
    setTodos(lesson.todos ?? []);
  }, [lesson]);

  useEffect(() => {
    todosRef.current = todos;
  }, [todos]);

  const saveTodos = useCallback(
    async (nextTodos: LessonTodo[]) => {
      if (!eventId) return;
      try {
        await updateLesson.mutateAsync({ todos: nextTodos });
      } catch {
        toast.error("Failed to save todos");
      }
    },
    [eventId, updateLesson],
  );

  const handleToggleTodo = useCallback(
    (id: string) => {
      const next = todosRef.current.map((t) =>
        t.id === id ? { ...t, done: !t.done } : t,
      );
      setTodos(next);
      saveTodos(next);
    },
    [saveTodos],
  );

  const handleAddTodo = useCallback(() => {
    const text = newTodoText.trim();
    if (!text) return;
    const next: LessonTodo[] = [
      ...todosRef.current,
      { id: `todo_${crypto.randomUUID()}`, text, done: false },
    ];
    setTodos(next);
    setNewTodoText("");
    saveTodos(next);
  }, [newTodoText, saveTodos]);

  const handleDeleteTodo = useCallback(
    (id: string) => {
      const next = todosRef.current.filter((t) => t.id !== id);
      setTodos(next);
      saveTodos(next);
    },
    [saveTodos],
  );

  const handleTodoTextChange = useCallback((id: string, text: string) => {
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, text } : t)));
  }, []);

  const handleTodoBlur = useCallback(
    (id: string) => {
      const current = todosRef.current.find((t) => t.id === id);
      // Empty todos add noise — drop them on blur.
      if (current && current.text.trim() === "") {
        handleDeleteTodo(id);
        return;
      }
      saveTodos(todosRef.current);
    },
    [handleDeleteTodo, saveTodos],
  );

  const todosDone = todos.filter((t) => t.done).length;

  return {
    todos,
    todosDone,
    todosTotal: todos.length,
    newTodoText,
    setNewTodoText,
    handleToggleTodo,
    handleAddTodo,
    handleDeleteTodo,
    handleTodoTextChange,
    handleTodoBlur,
  };
}
