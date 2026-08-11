import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Video, Radio, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { LessonResponse } from "@examify-tms/interfaces";
import { useGenerateMeetLink } from "../api";
import { useUpdateLesson } from "@/features/schedule/api";
import { lessonTimeRange } from "../lib";

type Props = {
  lesson: LessonResponse;
  studentName: string;
};

export function CurrentLesson({ lesson, studentName }: Props) {
  const generateMeet = useGenerateMeetLink();
  const updateLesson = useUpdateLesson(lesson.id);

  const callLink = lesson.meetLink;
  const isMeet = !!lesson.meetLink;

  const handleGenerate = async () => {
    try {
      const res = await generateMeet.mutateAsync({
        lessonId: lesson.id,
        startDateTime: lesson.startDateTime,
        durationMinutes: lesson.durationMinutes,
      });
      // Persist the link on the lesson so the button becomes "Join Meet" on
      // the next render and the calendar/schedule can display it too.
      await updateLesson.mutateAsync({
        location: "Google Meet",
        meetLink: res.meetingLink,
      });
      toast.success("Google Meet link created");
    } catch (err) {
      toast.error(
        err instanceof Error && err.message
          ? err.message
          : "Connect your Google account to generate Meet links",
      );
    }
  };

  return (
    <Card className="border-primary/40 bg-primary/5">
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="relative flex h-2.5 w-2.5 mt-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
          </span>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1 font-normal">
                <Radio className="h-3 w-3" /> Live now
              </Badge>
              <span className="text-xs text-muted-foreground">
                {lessonTimeRange(lesson)}
              </span>
            </div>
            <p className="font-medium">
              {studentName} · {lesson.subject}
            </p>
            <Link
              to={`/lessons/${lesson.id}`}
              className="text-xs text-muted-foreground hover:underline"
            >
              View lesson details
            </Link>
          </div>
        </div>

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
            disabled={generateMeet.isPending || updateLesson.isPending}
          >
            {generateMeet.isPending || updateLesson.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Video className="h-4 w-4" />
            )}
            Generate Meet link
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
