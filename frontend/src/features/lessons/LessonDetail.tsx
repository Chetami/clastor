import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { STUDENT_NOTIFY_COOLDOWN_MS } from "@examify-tms/shared";
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  User,
  CalendarClock,
  CheckCircle2,
  Loader2,
  Repeat,
  Ban,
  Mail,
  Video,
  ExternalLink,
  RefreshCw,
  CloudOff,
  Plus,
  Trash2,
  MoreHorizontal,
  Check,
  ListTodo,
  StickyNote,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  useGetLesson,
  useRecordAttendance,
  useCancelLesson,
  useNotifyStudent,
  useUpdateLesson,
  useResyncLesson,
  previewNotifyStudentRequest,
} from "../schedule/api";
import { EmailComposeDialog } from "@/components/email-compose-dialog";
import {
  generateMeetLinkRequest,
  getGoogleConnectionStatus,
  getGoogleAuthUrl,
} from "../schedule/api/requests";
import { useListStudents } from "@/features/students/api";
import { useSubjects } from "@/lib/subjects";
import {
  ACCEPTANCE_LABELS,
  ATTENDANCE_LABELS,
  ATTENDANCE_OPTIONS,
  isLessonFinished,
  lessonEndDate,
  formatMsRemaining,
} from "../schedule/lesson-utils";
import { lessonBadge } from "@/features/lessons/lesson-display";
import type {
  AttendanceStatus,
  LessonTodo,
} from "@examify-tms/interfaces";
import { RescheduleDialog } from "@/features/schedule/RescheduleDialog";
import { CancelLessonDialog } from "@/features/schedule/CancelLessonDialog";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function EventDetail() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { data: lesson, isLoading } = useGetLesson(eventId);
  const { data: students = [] } = useListStudents();
  const subjects = useSubjects();
  const recordAttendance = useRecordAttendance(eventId!);
  const cancelLesson = useCancelLesson(eventId!);
  const notifyStudent = useNotifyStudent(eventId!);
  const updateLesson = useUpdateLesson(eventId!);
  const resyncLesson = useResyncLesson(eventId!);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [subjectError, setSubjectError] = useState<string | null>(null);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [meetLoading, setMeetLoading] = useState(false);
  const [meetError, setMeetError] = useState<string | null>(null);
  const [googleConnected, setGoogleConnected] = useState<boolean | null>(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [todos, setTodos] = useState<LessonTodo[]>([]);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [newTodoText, setNewTodoText] = useState("");

  // Ref mirrors so blur handlers always save the freshest values (avoids
  // stale-closure saves), and an id guard so navigating between lessons
  // (same route, different param — component stays mounted) re-syncs drafts.
  const notesRef = useRef("");
  const todosRef = useRef<LessonTodo[]>([]);
  const lastSyncedId = useRef<string | null>(null);

  useEffect(() => {
    getGoogleConnectionStatus()
      .then((s) => setGoogleConnected(s.connected))
      .catch(() => setGoogleConnected(false));
  }, []);

  useEffect(() => {
    if (!lesson) return;
    if (lastSyncedId.current === lesson.id) return;
    lastSyncedId.current = lesson.id;
    setNotesDraft(lesson.notes ?? "");
    setTodos(lesson.todos ?? []);
  }, [lesson]);

  useEffect(() => {
    notesRef.current = notesDraft;
  }, [notesDraft]);
  useEffect(() => {
    todosRef.current = todos;
  }, [todos]);

  const saveNotes = useCallback(
    async (notes: string) => {
      if (!eventId) return;
      const server = lesson?.notes ?? "";
      if (notes === server) return;
      try {
        await updateLesson.mutateAsync({ notes: notes || null });
      } catch {
        toast.error("Failed to save notes");
      }
    },
    [eventId, lesson?.notes, updateLesson],
  );

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading lesson…
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <CalendarClock className="h-10 w-10 text-muted-foreground" />
        <div className="space-y-1">
          <p className="font-medium">Lesson not found</p>
          <p className="text-sm text-muted-foreground">
            This lesson may have been removed or is no longer on the schedule.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/lessons">
            <ArrowLeft className="h-4 w-4" />
            Back to Lessons
          </Link>
        </Button>
      </div>
    );
  }

  const end = lessonEndDate(lesson);
  const existingMeet = lesson.meetLink;
  const student = students.find((s) => s.id === lesson.studentId);
  const studentName = student?.name ?? "Unknown student";
  const studentSubjects = student
    ? subjects.filter((s) => student.subjectIds?.includes(s.id))
    : [];
  const lessonFinished = isLessonFinished(lesson);
  const subject = lesson.subject;
  const subjectOptions =
    subject && !studentSubjects.some((s) => s.name === subject)
      ? [{ id: "__current__", name: subject, color: null }, ...studentSubjects]
      : studentSubjects;
  const badge = lessonBadge(lesson);

  const notifiedAt = lesson.lastStudentNotifiedAt
    ? new Date(lesson.lastStudentNotifiedAt)
    : null;
  const nextAllowedAt = notifiedAt
    ? new Date(notifiedAt.getTime() + STUDENT_NOTIFY_COOLDOWN_MS)
    : null;
  const cooldownActive = nextAllowedAt
    ? Date.now() < nextAllowedAt.getTime()
    : false;
  const cooldownRemaining = cooldownActive
    ? formatMsRemaining(nextAllowedAt!.getTime() - Date.now())
    : "";

  const canManage = !lesson.isCancelled && !lessonFinished;

  const serverNotes = lesson.notes ?? "";
  const notesDirty = notesDraft !== serverNotes;
  const notesSaving = notesDirty && updateLesson.isPending;

  const todosDone = todos.filter((t) => t.done).length;
  const todosTotal = todos.length;

  function openNotifyDialog() {
    setPickerError(null);
    setNotifyOpen(true);
  }

  async function handleGenerateMeet() {
    if (!eventId || !lesson) return;
    setMeetLoading(true);
    setMeetError(null);
    try {
      if (!googleConnected) {
        const { authUrl } = await getGoogleAuthUrl();
        window.location.href = authUrl;
        return;
      }
      const { meetingLink } = await generateMeetLinkRequest({
        lessonId: lesson.id,
        startDateTime: lesson.startDateTime,
        durationMinutes: lesson.durationMinutes,
      });
      await updateLesson.mutateAsync({
        location: "Google Meet",
        meetLink: meetingLink,
      });
    } catch (err) {
      setMeetError(
        err instanceof Error ? err.message : "Failed to generate Meet link",
      );
    } finally {
      setMeetLoading(false);
    }
  }

  async function handleNotify(message: string) {
    try {
      await notifyStudent.mutateAsync({ message: message || undefined });
      toast.success("Reminder sent");
      setNotifyOpen(false);
    } catch {
      setPickerError(
        notifyStudent.error?.message ?? "Failed to notify student",
      );
      setNotifyOpen(false);
    }
  }

  async function handleAttendanceChange(value: AttendanceStatus) {
    if (!eventId) return;
    setPickerError(null);
    try {
      await recordAttendance.mutateAsync(value);
    } catch {
      setPickerError(
        recordAttendance.error?.message ?? "Failed to record attendance",
      );
    }
  }

  async function handleSubjectChange(value: string) {
    if (!eventId) return;
    setSubjectError(null);
    try {
      await updateLesson.mutateAsync({ subject: value || null });
    } catch (err) {
      setSubjectError(
        err instanceof Error ? err.message : "Failed to update subject",
      );
    }
  }

  async function handleCancel() {
    if (!eventId || !lesson) return;
    if (lesson.acceptanceStatus === "accepted" || lesson.seriesId) {
      setCancelOpen(true);
      return;
    }
    try {
      await cancelLesson.mutateAsync();
    } catch (err) {
      setPickerError(err instanceof Error ? err.message : "Failed to cancel lesson");
    }
  }

  async function handleResync() {
    if (!eventId) return;
    try {
      const { action } = await resyncLesson.mutateAsync();
      toast.success(
        action === "created"
          ? "Added to Google Calendar."
          : action === "recreated"
            ? "Recovered on Google Calendar."
            : "Already up to date on Google Calendar.",
      );
    } catch {
      toast.error(
        resyncLesson.error?.message ?? "Failed to sync to Google Calendar",
      );
    }
  }

  function handleNotesBlur() {
    if (notesDirty && !updateLesson.isPending) saveNotes(notesRef.current);
  }

  function handleNotesKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      (e.target as HTMLTextAreaElement).blur();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setNotesDraft(serverNotes);
      (e.target as HTMLTextAreaElement).blur();
    }
  }

  function handleToggleTodo(id: string) {
    const next = todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
    setTodos(next);
    saveTodos(next);
  }

  function handleAddTodo() {
    const text = newTodoText.trim();
    if (!text) return;
    const next: LessonTodo[] = [
      ...todos,
      { id: `todo_${crypto.randomUUID()}`, text, done: false },
    ];
    setTodos(next);
    setNewTodoText("");
    saveTodos(next);
  }

  function handleDeleteTodo(id: string) {
    const next = todos.filter((t) => t.id !== id);
    setTodos(next);
    saveTodos(next);
  }

  function handleTodoTextChange(id: string, text: string) {
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, text } : t)));
  }

  function handleTodoBlur(id: string) {
    const current = todosRef.current.find((t) => t.id === id);
    // Empty todos add noise — drop them on blur.
    if (current && current.text.trim() === "") {
      handleDeleteTodo(id);
      return;
    }
    saveTodos(todosRef.current);
  }

  const showOverflow =
    (canManage || (!lesson.isCancelled && googleConnected));

  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 text-muted-foreground"
        onClick={() => navigate("/lessons")}
      >
        <ArrowLeft className="h-4 w-4" />
        Lessons
      </Button>

      {/* Header */}
      <Card className="overflow-hidden">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-semibold tracking-tight">
                    {subject ? `${subject} — ${studentName}` : studentName}
                  </h1>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium",
                      badge.tone,
                    )}
                  >
                    {badge.label}
                  </span>
                  {lesson.seriesId && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                      <Repeat className="h-3 w-3" />
                      Recurring
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    {formatDateTime(lesson.startDateTime)}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    {formatTime(lesson.startDateTime)}–{formatTime(end.toISOString())}
                    {" "}
                    ({lesson.durationMinutes} min)
                  </span>
                  {existingMeet ? (
                    <a
                      href={existingMeet}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                    >
                      <Video className="h-3.5 w-3.5" />
                      Google Meet
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : lesson.location ? (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" />
                      {lesson.location}
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-0.5 text-xs text-muted-foreground">
                  <span>
                    Student response:{" "}
                    <span
                      className={cn(
                        "font-medium",
                        lesson.acceptanceStatus === "accepted"
                          ? "text-emerald-600 dark:text-emerald-400"
                          : lesson.acceptanceStatus === "declined"
                            ? "text-rose-600 dark:text-rose-400"
                            : "text-amber-600 dark:text-amber-400",
                      )}
                    >
                      {ACCEPTANCE_LABELS[lesson.acceptanceStatus]}
                    </span>
                  </span>
                  {notifiedAt && (
                    <>
                      <span aria-hidden>·</span>
                      <span>
                        Last reminded{" "}
                        {notifiedAt.toLocaleString("en-US", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </span>
                    </>
                  )}
                </div>
              </div>

            {/* Contextual actions */}
            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              {existingMeet && (
                <Button asChild variant="secondary" size="sm">
                  <a href={existingMeet} target="_blank" rel="noopener noreferrer">
                    <Video className="h-4 w-4" />
                    Join Meet
                  </a>
                </Button>
              )}
              {canManage && (
                <>
                  <Button
                    size="sm"
                    onClick={openNotifyDialog}
                    disabled={cooldownActive}
                    title={
                      cooldownActive && nextAllowedAt
                        ? `Already notified — resend in ${cooldownRemaining}`
                        : "Send a reminder email to the student"
                    }
                  >
                    {notifyStudent.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Mail className="h-4 w-4" />
                    )}
                    {notifiedAt ? "Notify again" : "Notify student"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setRescheduleOpen(true)}
                    title="Move this lesson to a new time"
                  >
                    <CalendarClock className="h-4 w-4" />
                    Reschedule
                  </Button>
                </>
              )}
              {showOverflow && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" className="h-9 w-9">
                      <MoreHorizontal className="h-4 w-4" />
                      <span className="sr-only">More actions</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {canManage && (
                      <DropdownMenuItem
                        onClick={handleCancel}
                        disabled={cancelLesson.isPending}
                        className="text-destructive focus:text-destructive"
                      >
                        <Ban className="mr-2 h-4 w-4" />
                        Cancel lesson
                      </DropdownMenuItem>
                    )}
                    {googleConnected && !lesson.isCancelled && (
                      <DropdownMenuItem
                        onClick={handleResync}
                        disabled={resyncLesson.isPending}
                      >
                        {resyncLesson.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="mr-2 h-4 w-4" />
                        )}
                        {lesson.googleCalendarEventId
                          ? "Resync to Google Calendar"
                          : "Add to Google Calendar"}
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              <DetailRow
                icon={<Calendar className="h-4 w-4" />}
                label="When"
                value={formatDateTime(lesson.startDateTime)}
              />
              <DetailRow
                icon={<Clock className="h-4 w-4" />}
                label="Duration"
                value={`${formatTime(lesson.startDateTime)} – ${formatTime(
                  end.toISOString(),
                )} (${lesson.durationMinutes} min)`}
              />
              <div className="flex items-start gap-3">
                <div className="mt-0.5 text-muted-foreground">
                  <User className="h-4 w-4" />
                </div>
                <div className="min-w-0 space-y-0.5">
                  <p className="text-xs text-muted-foreground">Student</p>
                  <Link
                    to={`/students/${lesson.studentId}`}
                    className="text-sm font-medium hover:underline"
                  >
                    {studentName}
                  </Link>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 text-muted-foreground">
                  <StickyNote className="h-4 w-4" />
                </div>
                <div className="min-w-0 space-y-1">
                  <p className="text-xs text-muted-foreground">Subject</p>
                  <Select
                    value={subject ?? ""}
                    onValueChange={handleSubjectChange}
                    disabled={updateLesson.isPending}
                  >
                    <SelectTrigger className="h-8 w-full max-w-[220px]">
                      <SelectValue
                        placeholder={
                          studentSubjects.length > 0
                            ? "Select a subject"
                            : "No subjects assigned"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No subject</SelectItem>
                      {subjectOptions.map((s) => (
                        <SelectItem key={s.id} value={s.name}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {subjectError && (
                    <p className="text-xs text-destructive">{subjectError}</p>
                  )}
                </div>
              </div>
              <div className="flex items-start gap-3 sm:col-span-2">
                <div className="mt-0.5 text-muted-foreground">
                  {existingMeet ? (
                    <Video className="h-4 w-4" />
                  ) : (
                    <MapPin className="h-4 w-4" />
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <p className="text-xs text-muted-foreground">
                    {existingMeet ? "Video call" : "Location"}
                  </p>
                  {existingMeet ? (
                    <a
                      href={existingMeet}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 break-all text-sm font-medium text-primary hover:underline"
                    >
                      {existingMeet}
                      <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                    </a>
                  ) : (
                    <p
                      className={
                        lesson.location
                          ? "break-words text-sm font-medium"
                          : "text-sm text-muted-foreground"
                      }
                    >
                      {lesson.location ?? "Not specified"}
                    </p>
                  )}
                  {!existingMeet && (
                    <div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8"
                        disabled={
                          meetLoading ||
                          googleConnected === null ||
                          updateLesson.isPending
                        }
                        onClick={handleGenerateMeet}
                        title={
                          googleConnected
                            ? "Generate a Google Meet link and save it to this lesson"
                            : "Connect your Google account to generate Meet links"
                        }
                      >
                        {meetLoading || updateLesson.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Video className="h-4 w-4" />
                        )}
                        <span className="ml-1.5">
                          {meetLoading || updateLesson.isPending
                            ? "Generating…"
                            : googleConnected
                              ? "Generate Meet link"
                              : "Connect Google"}
                        </span>
                      </Button>
                      {meetError && (
                        <p className="mt-1 text-xs text-destructive">
                          {meetError}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notes — auto-save on blur */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                <span className="flex items-center gap-2">
                  <StickyNote className="h-4 w-4" />
                  Notes
                </span>
                <NotesStatus dirty={notesDirty} saving={notesSaving} />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                onBlur={handleNotesBlur}
                onKeyDown={handleNotesKeyDown}
                rows={6}
                placeholder="Prep notes, topics to cover, follow-ups…"
                className="resize-none"
              />
              {!notesDraft && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Saved automatically as you type.{" "}
                  <span className="hidden sm:inline">
                    Press <kbd className="rounded border px-1">⌘</kbd>+
                    <kbd className="rounded border px-1">Enter</kbd> to save,{" "}
                    <kbd className="rounded border px-1">Esc</kbd> to revert.
                  </span>
                </p>
              )}
            </CardContent>
          </Card>

          {/* Todos / checklist */}
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
                    <li
                      key={todo.id}
                      className="group flex items-start gap-2.5"
                    >
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
                        onChange={(e) =>
                          handleTodoTextChange(todo.id, e.target.value)
                        }
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
        </div>

        {/* Sidebar */}
        <div className="space-y-6 lg:col-span-1">
          <Card className="lg:sticky lg:top-6">
            <CardHeader>
              <CardTitle className="text-base">Outcome</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {lesson.isCancelled && (
                <p className="rounded-md bg-rose-500/10 px-3 py-2 text-sm text-rose-600 dark:text-rose-400">
                  This occurrence has been cancelled.
                </p>
              )}
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">
                  Attendance / outcome
                </p>
                <Select
                  value={lesson.attendanceStatus}
                  onValueChange={(v) =>
                    handleAttendanceChange(v as AttendanceStatus)
                  }
                  disabled={recordAttendance.isPending}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ATTENDANCE_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {ATTENDANCE_LABELS[opt]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {pickerError && (
                  <p className="text-xs text-destructive">{pickerError}</p>
                )}
              </div>

              {cooldownActive && nextAllowedAt && (
                <p className="text-xs text-muted-foreground">
                  Next reminder available in {cooldownRemaining} (
                  {nextAllowedAt.toLocaleString("en-US", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                  ).
                </p>
              )}

              {googleConnected !== null && !lesson.isCancelled && (
                <button
                  type="button"
                  onClick={handleResync}
                  disabled={resyncLesson.isPending}
                  className="flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-xs transition-colors hover:bg-muted/60 disabled:opacity-60"
                  title={
                    lesson.googleCalendarEventId
                      ? "Update or recover the Google Calendar event"
                      : "Add this lesson to your Google Calendar"
                  }
                >
                  <span className="flex items-center gap-2 text-muted-foreground">
                    {lesson.googleCalendarEventId ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <CloudOff className="h-3.5 w-3.5 text-amber-500" />
                    )}
                    {lesson.googleCalendarEventId
                      ? "Synced to Google Calendar"
                      : "Not on Google Calendar"}
                  </span>
                  {resyncLesson.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                  ) : (
                    <RefreshCw className="h-3 w-3 text-muted-foreground" />
                  )}
                </button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <EmailComposeDialog
        open={notifyOpen}
        onOpenChange={setNotifyOpen}
        title={`Notify ${studentName}`}
        description="Send a reminder email to the student. You can resend once every 24 hours."
        fetchPreview={(message) =>
          previewNotifyStudentRequest(lesson.id, message)
        }
        onSend={handleNotify}
      />

      <RescheduleDialog
        lesson={lesson}
        open={rescheduleOpen}
        onOpenChange={setRescheduleOpen}
      />

      <CancelLessonDialog
        lesson={lesson}
        open={cancelOpen}
        onOpenChange={setCancelOpen}
      />
    </div>
  );
}

function NotesStatus({ dirty, saving }: { dirty: boolean; saving: boolean }) {
  if (saving)
    return (
      <span className="flex items-center gap-1 text-xs font-normal text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Saving…
      </span>
    );
  if (dirty)
    return (
      <span className="text-xs font-normal text-muted-foreground">Edited</span>
    );
  return (
    <span className="flex items-center gap-1 text-xs font-normal text-muted-foreground">
      <Check className="h-3 w-3 text-emerald-500" />
      Saved
    </span>
  );
}

interface DetailRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function DetailRow({ icon, label, value }: DetailRowProps) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 text-muted-foreground">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

interface AutoGrowTextareaProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onBlur: () => void;
  className?: string;
}

function AutoGrowTextarea({
  value,
  onChange,
  onBlur,
  className,
}: AutoGrowTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      rows={1}
      className={className}
    />
  );
}
