import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import { addEvent, getEvents, toFullCalendarEvents } from "./events";
import { CreateEventDialog } from "./CreateEventDialog";
import type { EventFormData } from "./event-schema";

export default function Schedule() {
  const calendarRef = useRef<FullCalendar>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const now = new Date();

  const [events, setEvents] = useState(() => [...getEvents()]);
  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState<{ start: Date; end: Date } | null>(null);

  const handleCreated = (values: EventFormData) => {
    const created = addEvent(values);
    setEvents((prev) => [...prev, created]);
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

  return (
    <div className="gi-calendar" ref={wrapperRef}>
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        firstDay={1}
        allDaySlot={false}
        scrollTimeReset={false}
        nowIndicator
        selectable
        selectMirror
        buttonText={{ today: "Today" }}
        customButtons={{
          timezoneLabel: { text: tzLabel, click: () => {} },
        }}
        headerToolbar={{
          left: "today prev,next timezoneLabel",
          center: "title",
          right: "timeGridWeek,timeGridFourDay,timeGridDay",
        }}
        titleFormat={{ month: "long", year: "numeric" }}
        dayHeaderContent={(arg) => (
          <button
            type="button"
            className="gi-calendar-header"
            onClick={() =>
              calendarRef.current?.getApi().changeView("timeGridDay", arg.date)
            }
          >
            <span className="gi-calendar-header__day">
              {arg.date.getDate()}
            </span>
            <span className="gi-calendar-header__weekday">
              {arg.date.toLocaleDateString("en-US", { weekday: "short" })}
            </span>
          </button>
        )}
        views={{
          timeGridWeek: { buttonText: "Week" },
          timeGridDay: { buttonText: "Day" },
          timeGridFourDay: {
            type: "timeGrid",
            dayCount: 4,
            buttonText: "4 Day",
          },
        }}
        events={toFullCalendarEvents(events)}
        eventContent={(arg) => (
          <div className="fc-event-main-frame">
            <div className="fc-event-time">{arg.timeText}</div>
            <div className="fc-event-title-container">
              <div className="fc-event-title">
                {arg.event.extendedProps.student}
              </div>
            </div>
          </div>
        )}
        select={(info) => {
          if (info.allDay) return;
          setDraft({ start: info.start, end: info.end });
          setCreateOpen(true);
          info.view.calendar.unselect();
        }}
        eventClick={(info) => {
          if (info.event.id) navigate(`/schedule/${info.event.id}`);
        }}
        height="calc(100vh - 8rem)"
      />
      <CreateEventDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        start={draft?.start ?? null}
        end={draft?.end ?? null}
        onCreated={handleCreated}
      />
    </div>
  );
}
