export interface ScheduleEvent {
  id: string;
  title: string;
  subject: string;
  student: string;
  start: string;
  end: string;
  location?: string;
  notes?: string;
}

export interface NewScheduleEventInput {
  studentId: string;
  studentName: string;
  subject: string;
  date: string;
  startTime: string;
  endTime: string;
  location?: string;
  notes?: string;
}

function buildSeedEvents(
  todayStr: string,
  tomorrowStr: string,
  plusTwoStr: string,
): ScheduleEvent[] {
  return [
    {
      id: "evt-1",
      title: "Math — Sarah",
      subject: "Mathematics",
      student: "Sarah",
      start: `${todayStr}T09:00:00`,
      end: `${todayStr}T10:00:00`,
      location: "Online — Zoom",
      notes: "Cover algebra fundamentals and review homework.",
    },
    {
      id: "evt-2",
      title: "Physics — James",
      subject: "Physics",
      student: "James",
      start: `${todayStr}T13:00:00`,
      end: `${todayStr}T14:30:00`,
      location: "In-person",
      notes: "Newton's laws and worked examples.",
    },
    {
      id: "evt-3",
      title: "Chemistry — Aisha",
      subject: "Chemistry",
      student: "Aisha",
      start: `${tomorrowStr}T11:00:00`,
      end: `${tomorrowStr}T12:00:00`,
      location: "Online — Google Meet",
    },
    {
      id: "evt-4",
      title: "English — Liam",
      subject: "English",
      student: "Liam",
      start: `${tomorrowStr}T16:00:00`,
      end: `${tomorrowStr}T17:00:00`,
      location: "Online — Zoom",
    },
    {
      id: "evt-5",
      title: "Biology — Noor",
      subject: "Biology",
      student: "Noor",
      start: `${plusTwoStr}T10:30:00`,
      end: `${plusTwoStr}T11:30:00`,
      location: "In-person",
    },
  ];
}

function seedEvents(): ScheduleEvent[] {
  const now = new Date();
  const toStr = (d: Date) => d.toISOString().slice(0, 10);
  const todayStr = toStr(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const plusTwo = new Date(now);
  plusTwo.setDate(now.getDate() + 2);
  return buildSeedEvents(todayStr, toStr(tomorrow), toStr(plusTwo));
}

const store: ScheduleEvent[] = seedEvents();

export function getEvents(): ScheduleEvent[] {
  return store;
}

export function getEventById(id: string | undefined): ScheduleEvent | undefined {
  if (!id) return undefined;
  return store.find((e) => e.id === id);
}

export function addEvent(input: NewScheduleEventInput): ScheduleEvent {
  const event: ScheduleEvent = {
    id: `local_${Date.now()}`,
    title: `${input.subject} — ${input.studentName}`,
    subject: input.subject,
    student: input.studentName,
    start: `${input.date}T${input.startTime}:00`,
    end: `${input.date}T${input.endTime}:00`,
    location: input.location || undefined,
    notes: input.notes || undefined,
  };
  store.push(event);
  return event;
}

export function toFullCalendarEvents(events: ScheduleEvent[]) {
  return events.map(({ id, title, start, end, student }) => ({
    id,
    title,
    start,
    end,
    extendedProps: { student },
  }));
}
