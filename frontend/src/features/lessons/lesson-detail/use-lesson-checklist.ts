import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import type { UseMutationResult } from "@tanstack/react-query";
import type {
  LessonResponse,
  LessonTodo,
  UpdateLessonRequest,
} from "@examify-tms/interfaces";

type UpdateLessonMutation = UseMutationResult<
  LessonResponse,
  Error,
  UpdateLessonRequest
>;

/**
 * Owns the per-lesson checklist (todos): add / toggle / edit / delete with
 * auto-save, plus keyboard-driven item navigation.
 *
 *  - Enter (no modifier) on an item inserts a fresh item below it and moves
 *    focus down.
 *  - Backspace on an empty item removes it and moves focus up.
 *  - ⌘/Ctrl+Enter saves the current item (blur).
 *
 * A layout-effect ref mirror keeps the ref fresh before the next event fires,
 * so blur / keyboard handlers always read the latest list. The list re-syncs
 * from the server whenever the active lesson id changes. Empty todos are
 * dropped on blur (they only add noise).
 */
export function useLessonChecklist(
  eventId: string | undefined,
  lesson: LessonResponse | undefined,
  updateLesson: UpdateLessonMutation,
) {
  const [todos, setTodos] = useState<LessonTodo[]>([]);
  const [newTodoText, setNewTodoText] = useState("");
  const [saving, setSaving] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);
  const todosRef = useRef<LessonTodo[]>([]);
  const lastSyncedId = useRef<string | null>(null);

  useEffect(() => {
    if (!lesson) return;
    if (lastSyncedId.current === lesson.id) return;
    lastSyncedId.current = lesson.id;
    setTodos(lesson.todos ?? []);
  }, [lesson]);

  // Mirror todos into a ref synchronously (before paint / next event) so
  // keyboard + blur handlers always read the freshest list.
  useLayoutEffect(() => {
    todosRef.current = todos;
  }, [todos]);

  const saveTodos = useCallback(
    async (nextTodos: LessonTodo[]) => {
      if (!eventId) return;
      const previous = todosRef.current;
      setSaving(true);
      try {
        await updateLesson.mutateAsync({ todos: nextTodos });
      } catch {
        // Roll back the optimistic update so the UI matches the server.
        setTodos(previous);
        todosRef.current = previous;
        toast.error("Failed to save todos");
      } finally {
        setSaving(false);
      }
    },
    [eventId, updateLesson],
  );

  const commit = useCallback(
    (next: LessonTodo[]) => {
      setTodos(next);
      saveTodos(next);
    },
    [saveTodos],
  );

  const handleToggleTodo = useCallback(
    (id: string) => {
      commit(
        todosRef.current.map((t) =>
          t.id === id ? { ...t, done: !t.done } : t,
        ),
      );
    },
    [commit],
  );

  const handleAddTodo = useCallback(() => {
    const text = newTodoText.trim();
    if (!text) return;
    const id = `todo_${crypto.randomUUID()}`;
    commit([...todosRef.current, { id, text, done: false }]);
    setNewTodoText("");
    setFocusId(id);
  }, [commit, newTodoText]);

  const handleInsertAfter = useCallback(
    (id: string) => {
      const list = todosRef.current;
      const idx = list.findIndex((t) => t.id === id);
      if (idx === -1) return;
      const newId = `todo_${crypto.randomUUID()}`;
      commit([
        ...list.slice(0, idx + 1),
        { id: newId, text: "", done: false },
        ...list.slice(idx + 1),
      ]);
      setFocusId(newId);
    },
    [commit],
  );

  const handleDeleteTodo = useCallback(
    (id: string) => {
      commit(todosRef.current.filter((t) => t.id !== id));
    },
    [commit],
  );

  const handleClearCompleted = useCallback(() => {
    commit(todosRef.current.filter((t) => !t.done));
  }, [commit]);

  const handleTodoTextChange = useCallback((id: string, text: string) => {
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, text } : t)));
  }, []);

  const handleTodoBlur = useCallback(
    (id: string) => {
      const current = todosRef.current.find((t) => t.id === id);
      // Empty todos add noise — drop them on blur.
      if (current && current.text.trim() === "") {
        commit(todosRef.current.filter((t) => t.id !== id));
        return;
      }
      saveTodos(todosRef.current);
    },
    [commit, saveTodos],
  );

  const handleItemKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>, id: string) => {
      if (e.key === "Enter" && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        handleInsertAfter(id);
      } else if (
        e.key === "Backspace" &&
        e.currentTarget.value === "" &&
        e.currentTarget.selectionStart === 0
      ) {
        e.preventDefault();
        const list = todosRef.current;
        const idx = list.findIndex((t) => t.id === id);
        commit(list.filter((t) => t.id !== id));
        if (idx > 0) setFocusId(list[idx - 1]!.id);
      } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        e.currentTarget.blur();
      }
    },
    [commit, handleInsertAfter],
  );

  const clearFocus = useCallback(() => setFocusId(null), []);

  const todosDone = todos.filter((t) => t.done).length;

  return {
    todos,
    todosDone,
    todosTotal: todos.length,
    todosSaving: saving,
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
  };
}
