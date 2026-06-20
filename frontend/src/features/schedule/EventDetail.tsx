import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  StickyNote,
  User,
  CalendarClock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getEventById } from "./events";

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
  const event = getEventById(eventId);

  if (!event) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <CalendarClock className="h-10 w-10 text-muted-foreground" />
        <div className="space-y-1">
          <p className="font-medium">Event not found</p>
          <p className="text-sm text-muted-foreground">
            This event may have been removed or is no longer on the schedule.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/schedule">
            <ArrowLeft className="h-4 w-4" />
            Back to Schedule
          </Link>
        </Button>
      </div>
    );
  }

  const start = new Date(event.start);
  const end = new Date(event.end);
  const durationMin = Math.round((end.getTime() - start.getTime()) / 60000);

  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 text-muted-foreground"
        onClick={() => navigate("/schedule")}
      >
        <ArrowLeft className="h-4 w-4" />
        Schedule
      </Button>

      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{event.title}</h1>
        <p className="text-sm text-muted-foreground">{event.subject} session</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <DetailRow
              icon={<Calendar className="h-4 w-4" />}
              label="When"
              value={formatDateTime(event.start)}
            />
            <DetailRow
              icon={<Clock className="h-4 w-4" />}
              label="Duration"
              value={`${formatTime(event.start)} – ${formatTime(event.end)} (${durationMin} min)`}
            />
            <DetailRow
              icon={<User className="h-4 w-4" />}
              label="Student"
              value={event.student}
            />
            <DetailRow
              icon={<MapPin className="h-4 w-4" />}
              label="Location"
              value={event.location ?? "Not specified"}
              muted={!event.location}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <StickyNote className="h-4 w-4" />
              Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {event.notes ? (
              <p className="whitespace-pre-wrap text-sm">{event.notes}</p>
            ) : (
              <p className="text-sm text-muted-foreground">No notes for this event.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface DetailRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  muted?: boolean;
}

function DetailRow({ icon, label, value, muted }: DetailRowProps) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 text-muted-foreground">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p
          className={
            muted
              ? "truncate text-sm text-muted-foreground"
              : "truncate text-sm font-medium"
          }
        >
          {value}
        </p>
      </div>
    </div>
  );
}
