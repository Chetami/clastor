import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventInput } from "@fullcalendar/core";
import { useListLessons, useExternalCalendarEvents, previewRescheduleEmailRequest } from "./api";
import { useListStudents } from "@/features/students/api";
import { useGoogleConnectionStatus } from "@/features/settings/api/use-google-connect";
import { useAuthStore } from "@/store/auth-store";
import { EmailComposeDialog } from "@/components/email-compose-dialog";
import {
  lessonToCalendarEvent,
  externalEventToCalendarEvent,
} from "./lesson-utils";
import { workingHoursToBusinessHours } from "./working-hours-utils";
import { CreateEventDialog } from "./CreateEventDialog";
import { EventPopover, type EventAnchor } from "./EventPopover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";
import { useDropReschedule } from "./useDropReschedule";
import { DropConfirmDialog } from "./DropConfirmDialog";

export default function Schedule() {
  const calendarRef = useRef<FullCalendar>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const now = new Date();

  const [visibleWindow, setVisibleWindow] = useState<{
    from: string;
    to: string;
  } | null>(null);

  // Lessons are scoped to the calendar's visible window so navigating
  // weeks/days only fetches what's in view.
  const { data: lessons = [] } = useListLessons(
    visibleWindow ? { from: visibleWindow.from, to: visibleWindow.to } : undefined,
    { enabled: !!visibleWindow },
  );
  const { data: students = [] } = useListStudents();
  const { data: googleStatus } = useGoogleConnectionStatus();
  const googleConnected = !!googleStatus?.connected;
  const user = useAuthStore((s) => s.user);

  const { data: externalEvents = [] } = useExternalCalendarEvents(
    visibleWindow,
    googleConnected,
  );

  const studentNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const s of students) map[s.id] = s.name;
    return map;
  }, [students]);

  const lessonEvents = useMemo(
    () =>
      lessons
        .filter((l) => !l.isCancelled)
        .map((l) => lessonToCalendarEvent(l, studentNames)),
    [lessons, studentNames],
  );

  const externalCalendarEvents = useMemo(
    () => externalEvents.map(externalEventToCalendarEvent),
    [externalEvents],
  );

  // External (read-only) events are non-editable; lesson events inherit editable.
  const allEvents: EventInput[] = useMemo(
    () => [
      ...lessonEvents,
      ...externalCalendarEvents.map((e) => ({ ...e, editable: false })),
    ],
    [lessonEvents, externalCalendarEvents],
  );

  const businessHours = useMemo(
    () => workingHoursToBusinessHours(user?.workingHours),
    [user?.workingHours],
  );

  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState<{ start: Date; end: Date } | null>(null);
  const [view, setView] = useState("timeGridWeek");
  const [title, setTitle] = useState("");
  const [eventAnchor, setEventAnchor] = useState<EventAnchor | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [eventPopoverOpen, setEventPopoverOpen] = useState(false);

  const {
    dropPending,
    dropNotify,
    setDropNotify,
    dropScope,
    setDropScope,
    composeDrop,
    reschedulePending,
    openDropConfirm,
    cancelDrop,
    confirmDrop,
    runDropReschedule,
    clearComposeDrop,
  } = useDropReschedule();

  const changeView = (next: string) => {
    calendarRef.current?.getApi().changeView(next);
    setView(next);
  };

  const tzOffset = -now.getTimezoneOffset();
  const tzSign = tzOffset >= 0 ? "+" : "-";
  const tzHours = Math.floor(Math.abs(tzOffset) / 60);
  const tzMins = Math.abs(tzOffset) % 60;
  const tzLabel = `GMT${tzSign}${tzHours}${tzMins ? ":" + String(tzMins).padStart(2, "0") : ""}`;

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const api = calendarRef.current?.getApi();
    if (!wrapper || !api) return;
    let lastWidth = wrapper.clientWidth;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0].contentRect.width;
      if (width !== lastWidth) {
        lastWidth = width;
        api.updateSize();
      }
    });
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const api = calendarRef.current?.getApi();
    if (!api) return;
    setTitle(
      api.view.currentStart.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      }),
    );
  }, []);

  return (
    <div
      className="gi-calendar relative flex flex-col h-[calc(100vh-8rem)]"
      ref={wrapperRef}
      data-tour="schedule"
    >
      <header className="flex items-center justify-between gap-4 px-1 py-2 bg-background">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => calendarRef.current?.getApi().today()}
          >
            Today
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => calendarRef.current?.getApi().prev()}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => calendarRef.current?.getApi().next()}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">{tzLabel}</span>
          <div className="ml-2 hidden items-center gap-3 text-[11px] text-muted-foreground md:flex">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Accepted
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              Pending
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-rose-500" />
              Declined
            </span>
            {googleConnected && (
              <span className="inline-flex items-center gap-1">
                <span className="gi-external-legend h-2 w-2 rounded-full" />
                Google Calendar
              </span>
            )}
          </div>
        </div>
        <div className="text-lg font-semibold tracking-tight">{title}</div>
        <ToggleGroup
          type="single"
          value={view}
          size="sm"
          variant="outline"
          onValueChange={(v) => {
            if (v) changeView(v);
          }}
        >
          <ToggleGroupItem value="timeGridWeek">Week</ToggleGroupItem>
          <ToggleGroupItem value="timeGridFourDay">4 Day</ToggleGroupItem>
          <ToggleGroupItem value="timeGridDay">Day</ToggleGroupItem>
        </ToggleGroup>
      </header>
      <div className="flex-1 overflow-hidden">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          firstDay={1}
          allDaySlot={false}
          scrollTimeReset={false}
          nowIndicator
          selectable={!eventPopoverOpen}
          selectMirror
          editable
          headerToolbar={false}
          businessHours={businessHours}
          datesSet={(info) => {
            setView(info.view.type);
            setTitle(
              info.view.currentStart.toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              }),
            );
            setVisibleWindow({
              from: info.view.activeStart.toISOString(),
              to: info.view.activeEnd.toISOString(),
            });
          }}
          dayHeaderContent={(arg) => (
            <button
              type="button"
              className="gi-calendar-header"
              onClick={() =>
                calendarRef.current?.getApi().changeView("timeGridDay", arg.date)
              }
            >
              <span className="gi-calendar-header__day">{arg.date.getDate()}</span>
              <span className="gi-calendar-header__weekday">
                {arg.date.toLocaleDateString("en-US", { weekday: "short" })}
              </span>
            </button>
          )}
          views={{
            timeGridWeek: {},
            timeGridDay: {},
            timeGridFourDay: { type: "timeGrid", dayCount: 4 },
          }}
          events={allEvents}
          eventClassNames={(arg) => {
            if (arg.event.extendedProps.kind === "external") {
              return ["gi-external-event"];
            }
            const a = arg.event.extendedProps.acceptance as string | undefined;
            return a ? [`gi-acceptance-${a}`] : [];
          }}
          eventContent={(arg) => (
            <div className="fc-event-main-frame">
              <div className="fc-event-time">{arg.timeText}</div>
              <div className="fc-event-title-container">
                <div className="fc-event-title">
                  {arg.event.extendedProps.kind === "external"
                    ? arg.event.title
                    : arg.event.extendedProps.studentName ?? arg.event.title}
                </div>
              </div>
            </div>
          )}
          eventClick={(info) => {
            if (info.event.extendedProps.kind === "external") return;
            const el = info.el;
            setEventAnchor({
              getBoundingClientRect: () => el.getBoundingClientRect(),
            });
            setSelectedEventId(info.event.id);
            setEventPopoverOpen(true);
          }}
          eventDrop={(info) => {
            if (info.event.extendedProps.kind === "external") {
              info.revert();
              return;
            }
            openDropConfirm(info.event, info.revert);
          }}
          eventResize={(info) => {
            if (info.event.extendedProps.kind === "external") {
              info.revert();
              return;
            }
            openDropConfirm(info.event, info.revert);
          }}
          select={(info) => {
            if (info.allDay) return;
            setDraft({ start: info.start, end: info.end });
            setCreateOpen(true);
            info.view.calendar.unselect();
          }}
          height="100%"
        />
      </div>
      <CreateEventDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        start={draft?.start ?? null}
        end={draft?.end ?? null}
        externalEvents={externalEvents}
      />
      <EventPopover
        lessonId={selectedEventId}
        open={eventPopoverOpen}
        onOpenChange={setEventPopoverOpen}
        anchor={eventAnchor}
      />
      <DropConfirmDialog
        open={!!dropPending}
        label={dropPending?.label}
        hasSeries={!!dropPending?.seriesId}
        scope={dropScope}
        notify={dropNotify}
        pending={reschedulePending}
        onScopeChange={setDropScope}
        onNotifyChange={setDropNotify}
        onCancel={cancelDrop}
        onConfirm={confirmDrop}
      />

      {composeDrop && (
        <EmailComposeDialog
          open
          onOpenChange={(o) => {
            if (!o) clearComposeDrop();
          }}
          title="Review reschedule email"
          description={
            composeDrop.scope === "this_and_future"
              ? "A summary of the new schedule will be emailed."
              : "An updated calendar invite will be emailed."
          }
          fetchPreview={(message) =>
            previewRescheduleEmailRequest(composeDrop.lessonId, {
              startDateTime: composeDrop.startDateTime,
              durationMinutes: composeDrop.durationMinutes,
              scope: composeDrop.isSeries ? composeDrop.scope : undefined,
              message,
            })
          }
          onSend={(message) => runDropReschedule(message || null)}
        />
      )}
    </div>
  );
}
