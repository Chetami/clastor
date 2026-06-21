import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarClock, Video, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { LessonResponse } from "@examify-tms/interfaces";
import { useGenerateMeetLink } from "../api";
import {
  lessonTimeRange,
  relativeDayLabel,
  timeUntil,
  extractCallLink,
  isGoogleMeet,
} from "../lib";

type Props = {
  lesson: LessonResponse | undefined;
  studentName: string;
};

export function NextLesson({ lesson, studentName }: Props) {
  // Re-render every 30s so the countdown stays fresh.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const generateMeet = useGenerateMeetLink();

  if (!lesson) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center gap-2 space-y-0 p-4 pb-2">
          <CalendarClock className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Next lesson</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <p className="py-2 text-sm text-muted-foreground">
            No upcoming lessons scheduled.
          </p>
        </CardContent>
      </Card>
    );
  }

  const callLink = extractCallLink(lesson.location);
  const isMeet = callLink ? isGoogleMeet(callLink) : false;

  const handleGenerate = async () => {
    try {
      const res = await generateMeet.mutateAsync({
        startDateTime: lesson.startDateTime,
        durationMinutes: lesson.durationMinutes,
      });
      toast.success("Google Meet link created");
      window.open(res.meetingLink, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(
        err instanceof Error && err.message
          ? err.message
          : "Connect your Google account to generate Meet links",
      );
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2 space-y-0 p-4 pb-2">
        <CalendarClock className="h-4 w-4 text-muted-foreground" />
        <CardTitle className="text-base">Next lesson</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-2">
        <div className="flex items-center justify-between gap-4">
          {/* Clickable summary → lesson detail (replaces the old "View lesson" link) */}
          <Link
            to={`/lessons/${lesson.id}`}
            className="min-w-0 space-y-1 rounded-md transition-opacity hover:opacity-80"
          >
            <p className="text-2xl font-semibold leading-tight tracking-tight text-primary">
              {timeUntil(lesson.startDateTime)}
            </p>
            <p className="text-xs text-muted-foreground">
              {relativeDayLabel(lesson.startDateTime)} · {lessonTimeRange(lesson)}
            </p>
            <p className="text-sm font-medium">
              {studentName} · {lesson.subject}
            </p>
          </Link>

          {/* Open the call when a link exists; otherwise offer to generate a Meet */}
          {callLink ? (
            <Button asChild size="sm" className="shrink-0 gap-1.5">
              <a href={callLink} target="_blank" rel="noopener noreferrer">
                <Video className="h-4 w-4" />
                {isMeet ? "Join Meet" : "Join call"}
                <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              className="shrink-0 gap-1.5"
              onClick={handleGenerate}
              disabled={generateMeet.isPending}
            >
              {generateMeet.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Video className="h-4 w-4" />
              )}
              Generate Meet
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
