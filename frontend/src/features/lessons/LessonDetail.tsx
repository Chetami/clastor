import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  StickyNote,
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
  Square,
  CheckSquare,
  Plus,
  Trash2,
  Pencil,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useGetLesson,
  useRecordAttendance,
  useCancelLesson,
  useNotifyStudent,
  useUpdateLesson,
  useResyncLesson,
} from "../schedule/api";
import {
  generateMeetLinkRequest,
  getGoogleConnectionStatus,
  getGoogleAuthUrl,
} from "../schedule/api/requests";
import { useListStudents } from "@/features/students/api";
import {
  ACCEPTANCE_LABELS,
  ATTENDANCE_LABELS,
  ATTENDANCE_OPTIONS,
  deriveLessonStatus,
  isLessonFinished,
  lessonEndDate,
} from "../schedule/lesson-utils";
import type { AttendanceStatus, LessonTodo } from "@examify-tms/interfaces";
import { meetUrl } from "@/features/lessons/lesson-display";
import { RescheduleDialog } from "@/features/schedule/RescheduleDialog";

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

const STATUS_TONE: Record<string, string> = {
  scheduled: "bg-muted text-muted-foreground",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-rose-100 text-rose-700",
};

const NOTIFY_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export default function EventDetail() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { data: lesson, isLoading } = useGetLesson(eventId);
  const { data: students = [] } = useListStudents();
  const recordAttendance = useRecordAttendance(eventId!);
  const cancelLesson = useCancelLesson(eventId!);
  const notifyStudent = useNotifyStudent(eventId!);
  const updateLesson = useUpdateLesson(eventId!);
  const resyncLesson = useResyncLesson(eventId!);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [notifyMessage, setNotifyMessage] = useState("");
  const [meetLoading, setMeetLoading] = useState(false);
  const [meetError, setMeetError] = useState<string | null>(null);
  const [googleConnected, setGoogleConnected] = useState<boolean | null>(null);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
  const [todos, setTodos] = useState<LessonTodo[]>([]);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [newTodoText, setNewTodoText] = useState("");
  const initialized = useRef(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getGoogleConnectionStatus()
      .then((s) => setGoogleConnected(s.connected))
      .catch(() => setGoogleConnected(false));
  }, []);

  useEffect(() => {
    if (lesson && !initialized.current) {
      setNotesDraft(lesson.notes ?? "");
      setTodos(lesson.todos ?? []);
      initialized.current = true;
    }
  }, [lesson]);

  const saveNotes = useCallback(
    async (notes: string) => {
      if (!eventId || saving) return;
      setSaving(true);
      try {
        await updateLesson.mutateAsync({ notes: notes || null });
      } catch {
        toast.error("Failed to save notes");
      } finally {
        setSaving(false);
      }
    },
    [eventId, saving, updateLesson],
  );

  const saveTodos = useCallback(
    async (nextTodos: LessonTodo[]) => {
      if (!eventId || saving) return;
      setSaving(true);
      try {
        await updateLesson.mutateAsync({ todos: nextTodos });
      } catch {
        toast.error("Failed to save todos");
      } finally {
        setSaving(false);
      }
    },
    [eventId, saving, updateLesson],
  );

  const pending = useMemo(
    () => updateLesson.isPending || saving,
    [updateLesson.isPending, saving],
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
  const existingMeet = meetUrl(lesson.location);
  const studentName =
    students.find((s) => s.id === lesson.studentId)?.name ?? "Unknown student";
  const status = deriveLessonStatus(
    lesson.attendanceStatus,
    lesson.isCancelled,
  );
  const lessonFinished = isLessonFinished(lesson);
  const subject = lesson.subject;

  const notifiedAt = lesson.lastStudentNotifiedAt
    ? new Date(lesson.lastStudentNotifiedAt)
    : null;
  const nextAllowedAt = notifiedAt
    ? new Date(notifiedAt.getTime() + NOTIFY_COOLDOWN_MS)
    : null;
  const cooldownActive = nextAllowedAt
    ? Date.now() < nextAllowedAt.getTime()
    : false;

  const defaultNotifyMessage = (() => {
    const when = formatDateTime(lesson.startDateTime);
    const subjectPart = subject ? ` ${subject}` : "";
    return `Hi ${studentName},\n\nThis is a reminder about our upcoming${subjectPart} lesson on ${when}.\n\nLooking forward to seeing you!`;
  })();

  function openNotifyDialog() {
    setNotifyMessage(defaultNotifyMessage);
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
      await updateLesson.mutateAsync({ location: meetingLink });
    } catch (err) {
      setMeetError(
        err instanceof Error ? err.message : "Failed to generate Meet link",
      );
    } finally {
      setMeetLoading(false);
    }
  }

  async function handleNotify() {
    try {
      await notifyStudent.mutateAsync(notifyMessage);
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

  async function handleCancel() {
    if (!eventId) return;
    try {
      await cancelLesson.mutateAsync();
    } catch {
      setPickerError(cancelLesson.error?.message ?? "Failed to cancel lesson");
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

  function handleNotesSave() {
    setEditingNotes(false);
    saveNotes(notesDraft);
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

  function handleTodoBlur() {
    saveTodos(todos);
  }

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

      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            {subject ? `${subject} — ${studentName}` : studentName}
          </h1>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_TONE[status]}`}
          >
            {status}
          </span>
          {lesson.seriesId && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              <Repeat className="h-3 w-3" />
              Recurring
            </span>
          )}
          {googleConnected && !lesson.isCancelled && (
            <span
              className={
                "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium " +
                (lesson.googleCalendarEventId
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
                  : "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400")
              }
              title={
                lesson.googleCalendarEventId
                  ? "This lesson has an event on your Google Calendar"
                  : "This lesson isn't on your Google Calendar yet"
              }
            >
              {lesson.googleCalendarEventId ? (
                <CheckCircle2 className="h-3 w-3" />
              ) : (
                <CloudOff className="h-3 w-3" />
              )}
              {lesson.googleCalendarEventId
                ? "On Google Calendar"
                : "Not on Google Calendar"}
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {subject ? `${subject} session` : "Lesson"}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
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
              <DetailRow
                icon={<User className="h-4 w-4" />}
                label="Student"
                value={studentName}
              />
              {subject && (
                <DetailRow
                  icon={<StickyNote className="h-4 w-4" />}
                  label="Subject"
                  value={subject}
                />
              )}
              <div className="flex items-start gap-3">
                <div className="mt-0.5 text-muted-foreground">
                  {existingMeet ? (
                    <Video className="h-4 w-4" />
                  ) : (
                    <MapPin className="h-4 w-4" />
                  )}
                </div>
                <div className="min-w-0 space-y-1.5">
                  <p className="text-xs text-muted-foreground">Location</p>
                  {existingMeet ? (
                    <a
                      href={existingMeet}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                    >
                      Open Google Meet
                      <ExternalLink className="h-3.5 w-3.5" />
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

          <div className="grid gap-6 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  <span className="flex items-center gap-2">
                    <StickyNote className="h-4 w-4" />
                    Notes
                  </span>
                  {!editingNotes && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => setEditingNotes(true)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {editingNotes ? (
                  <div className="space-y-3">
                    <textarea
                      value={notesDraft}
                      onChange={(e) => setNotesDraft(e.target.value)}
                      rows={5}
                      placeholder="What to cover, prep notes, etc."
                      className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      autoFocus
                    />
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={handleNotesSave}
                        disabled={pending}
                      >
                        {pending ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Save className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingNotes(false)}
                        disabled={pending}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : notesDraft ? (
                  <p className="whitespace-pre-wrap text-sm">{notesDraft}</p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      No notes for this lesson.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CheckSquare className="h-4 w-4" />
                  Todos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {todos.length > 0 && (
                  <ul className="space-y-1">
                    {todos.map((todo) => (
                      <li
                        key={todo.id}
                        className="group flex items-start gap-2"
                      >
                        <button
                          type="button"
                          className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                          onClick={() => handleToggleTodo(todo.id)}
                        >
                          {todo.done ? (
                            <CheckSquare className="h-4 w-4 text-primary" />
                          ) : (
                            <Square className="h-4 w-4" />
                          )}
                        </button>
                        <AutoGrowTextarea
                          value={todo.text}
                          onChange={(e) =>
                            handleTodoTextChange(todo.id, e.target.value)
                          }
                          onBlur={handleTodoBlur}
                          className={`min-w-0 flex-1 resize-none overflow-hidden border-none bg-transparent p-0 text-sm outline-none transition-colors ${
                            todo.done
                              ? "text-muted-foreground line-through"
                              : "text-foreground"
                          }`}
                        />
                        <button
                          type="button"
                          className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                          onClick={() => handleDeleteTodo(todo.id)}
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
                    placeholder="Add a todo…"
                    className="min-w-0 flex-1 border-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 shrink-0"
                    disabled={!newTodoText.trim()}
                    onClick={handleAddTodo}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <Card className="lg:col-span-1 lg:sticky lg:top-6 lg:self-start">
          <CardHeader>
            <CardTitle className="text-base">Status &amp; attendance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">
                Student acceptance
              </p>
              <div className="flex items-center gap-2 text-sm font-medium">
                {lesson.acceptanceStatus === "accepted" && (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                )}
                {ACCEPTANCE_LABELS[lesson.acceptanceStatus]}
              </div>
            </div>

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
              <p className="text-xs text-muted-foreground">
                Reminders: {lesson.remindersEnabled ? "enabled" : "disabled"}
              </p>
            </div>

            <div className="space-y-2 border-t pt-4">
              {lesson.isCancelled ? (
                <p className="text-sm text-muted-foreground">
                  This occurrence has been cancelled.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setRescheduleOpen(true)}
                    disabled={lessonFinished}
                    className="w-full justify-start"
                    title={
                      lessonFinished
                        ? "Cannot reschedule finished lessons"
                        : "Move this lesson to a new time"
                    }
                  >
                    <CalendarClock className="h-4 w-4" />
                    Reschedule
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={openNotifyDialog}
                    disabled={cooldownActive}
                    className="w-full justify-start"
                    title={
                      cooldownActive && nextAllowedAt
                        ? `Already notified — can resend after ${nextAllowedAt.toLocaleString(
                            "en-US",
                            {
                              dateStyle: "medium",
                              timeStyle: "short",
                            },
                          )}`
                        : "Send a reminder email to the student"
                    }
                  >
                    <Mail className="h-4 w-4" />
                    {notifiedAt ? "Notify student again" : "Notify student"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancel}
                    disabled={cancelLesson.isPending || lessonFinished}
                    className="w-full justify-start text-destructive hover:text-destructive"
                    title={
                      lessonFinished
                        ? "Cannot cancel finished lessons"
                        : "Cancel this occurrence"
                    }
                  >
                    <Ban className="h-4 w-4" />
                    {cancelLesson.isPending
                      ? "Cancelling…"
                      : "Cancel this occurrence"}
                  </Button>
                  {googleConnected && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleResync}
                      disabled={resyncLesson.isPending}
                      className="w-full justify-start"
                      title={
                        lesson.googleCalendarEventId
                          ? "Update the Google Calendar event for this lesson, or recover it if it was deleted"
                          : "Add this lesson to your Google Calendar"
                      }
                    >
                      {resyncLesson.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                      {resyncLesson.isPending
                        ? "Syncing…"
                        : lesson.googleCalendarEventId
                          ? "Resync to Google"
                          : "Add to Google Calendar"}
                    </Button>
                  )}
                </div>
              )}
              {notifiedAt && (
                <p className="text-xs text-muted-foreground">
                  Last notified{" "}
                  {notifiedAt.toLocaleString("en-US", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                  {lesson.studentNotifiedCount
                    ? ` · ${lesson.studentNotifiedCount} sent`
                    : ""}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={notifyOpen} onOpenChange={setNotifyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Notify {studentName}</DialogTitle>
            <DialogDescription>
              Send a reminder email to the student. Lesson details are appended
              automatically. You can resend once every 24 hours.
            </DialogDescription>
          </DialogHeader>
          <textarea
            value={notifyMessage}
            onChange={(e) => setNotifyMessage(e.target.value)}
            rows={6}
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          {pickerError && (
            <p className="text-xs text-destructive">{pickerError}</p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setNotifyOpen(false)}
              disabled={notifyStudent.isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleNotify} disabled={notifyStudent.isPending}>
              {notifyStudent.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Mail className="mr-2 h-4 w-4" />
              )}
              {notifyStudent.isPending ? "Sending…" : "Send email"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RescheduleDialog
        lesson={lesson}
        open={rescheduleOpen}
        onOpenChange={setRescheduleOpen}
      />
    </div>
  );
}

interface DetailRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  muted?: boolean;
  href?: string | null;
}

function DetailRow({ icon, label, value, muted, href }: DetailRowProps) {
  const isMeet = !!href;
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 text-muted-foreground">
        {isMeet ? <Video className="h-4 w-4" /> : icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            Open Google Meet
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : (
          <p
            className={
              muted
                ? "truncate text-sm text-muted-foreground"
                : "truncate text-sm font-medium"
            }
          >
            {value}
          </p>
        )}
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
