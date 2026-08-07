import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Calendar,
  Clock,
  ExternalLink,
  Loader2,
  MapPin,
  StickyNote,
  User,
  Video,
} from "lucide-react";
import type { UseMutationResult } from "@tanstack/react-query";
import type { LessonResponse, Subject, UpdateLessonRequest } from "@examify-tms/interfaces";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  generateMeetLinkRequest,
  getGoogleAuthUrl,
} from "@/features/schedule/api/requests";
import { lessonEndDate } from "@/features/schedule/lesson-utils";
import { DetailRow } from "./ui";
import { formatDateTime, formatTime } from "./format";

type UpdateLessonMutation = UseMutationResult<
  LessonResponse,
  Error,
  UpdateLessonRequest
>;

interface LessonDetailsCardProps {
  lesson: LessonResponse;
  studentName: string;
  studentSubjects: Subject[];
  updateLesson: UpdateLessonMutation;
  googleConnected: boolean | null;
}

/**
 * The "Details" card: when / duration / student / subject / location, plus the
 * Google Meet link generator. Owns the subject-change and Meet-provisioning
 * interactions (they're local to these fields).
 */
export function LessonDetailsCard({
  lesson,
  studentName,
  studentSubjects,
  updateLesson,
  googleConnected,
}: LessonDetailsCardProps) {
  const [subjectError, setSubjectError] = useState<string | null>(null);
  const [meetLoading, setMeetLoading] = useState(false);
  const [meetError, setMeetError] = useState<string | null>(null);

  const end = lessonEndDate(lesson);
  const existingMeet = lesson.meetLink;
  const subject = lesson.subject;
  const subjectOptions =
    subject && !studentSubjects.some((s) => s.name === subject)
      ? [{ id: "__current__", name: subject, color: null }, ...studentSubjects]
      : studentSubjects;

  async function handleSubjectChange(value: string) {
    setSubjectError(null);
    try {
      await updateLesson.mutateAsync({ subject: value || null });
    } catch (err) {
      setSubjectError(
        err instanceof Error ? err.message : "Failed to update subject",
      );
    }
  }

  async function handleGenerateMeet() {
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

  return (
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
                  <p className="mt-1 text-xs text-destructive">{meetError}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
