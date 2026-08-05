import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { CalendarDays, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import {
  useGetLessonSeries,
  useListLessons,
  useUpdateLessonSeries,
  useGenerateSeriesMeetLink,
} from "@/features/schedule/api";
import { useListStudents } from "@/features/students/api";
import type { LessonAcceptance, LessonResponse } from "@examify-tms/interfaces";
import { lessonIssues } from "./lesson-series-utils";
import { LessonSeriesCalendar } from "./LessonSeriesCalendar";
import { SeriesHeader } from "./SeriesHeader";
import { SeriesActionsMenu } from "./SeriesActionsMenu";

export default function LessonSeriesDetail() {
  const { seriesId = "" } = useParams();

  const series = useGetLessonSeries(seriesId);
  const updateSeries = useUpdateLessonSeries(seriesId);
  const generateMeet = useGenerateSeriesMeetLink(seriesId);
  const { data: students = [] } = useListStudents();
  const lessonsQuery = useListLessons({ seriesId });

  const studentName = useMemo(() => {
    if (!series.data) return undefined;
    return students.find((s) => s.id === series.data!.studentId)?.name;
  }, [series.data, students]);

  const lessons = useMemo<LessonResponse[]>(
    () => lessonsQuery.data ?? [],
    [lessonsQuery.data],
  );
  const isLoading = series.isLoading || lessonsQuery.isLoading;
  const issueCount = useMemo(
    () => lessons.reduce((n, l) => n + lessonIssues(l).length, 0),
    [lessons],
  );
  const upcomingLessons = useMemo<LessonResponse[]>(() => {
    const now = Date.now();
    return lessons
      .filter(
        (l) =>
          !l.isCancelled &&
          new Date(l.startDateTime).getTime() >= now,
      )
      .sort(
        (a, b) =>
          new Date(a.startDateTime).getTime() -
          new Date(b.startDateTime).getTime(),
      );
  }, [lessons]);

  async function handleAcceptanceChange(value: LessonAcceptance) {
    try {
      await updateSeries.mutateAsync({ acceptanceStatus: value });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update acceptance",
      );
    }
  }

  async function handleGenerateMeet() {
    try {
      const result = await generateMeet.mutateAsync();
      toast.success(
        `Meet link generated and applied to ${result.appliedTo} lesson${
          result.appliedTo === 1 ? "" : "s"
        }.`,
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to generate Meet link",
      );
    }
  }

  return (
    <div className="flex h-full flex-col gap-6">
      {isLoading && (
        <div className="flex shrink-0 items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && (series.error || !series.data) && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Couldn't load this lesson series.
          </CardContent>
        </Card>
      )}

      {!isLoading && series.data && (
        <>
          <SeriesHeader
            subject={series.data.subject}
            studentName={studentName}
            studentId={series.data.studentId}
            acceptance={series.data.acceptanceStatus}
            onAcceptanceChange={handleAcceptanceChange}
            acceptanceDisabled={updateSeries.isPending}
            intervalWeeks={series.data.intervalWeeks}
            slots={series.data.slots}
            durationMinutes={series.data.durationMinutes}
            timezone={series.data.timezone}
            startDate={series.data.startDate}
            until={series.data.until ?? null}
            count={series.data.count}
            issueCount={issueCount}
            meetLink={series.data.meetLink ?? null}
            onGenerateMeet={handleGenerateMeet}
            meetPending={generateMeet.isPending}
            actions={
              <SeriesActionsMenu seriesId={seriesId} upcoming={upcomingLessons} />
            }
          />

          {lessonsQuery.error ? (
            <Card className="shrink-0">
              <CardContent className="py-12 text-center text-sm text-destructive">
                Failed to load lessons. Please try again.
              </CardContent>
            </Card>
          ) : lessons.length === 0 ? (
            <Card className="shrink-0">
              <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
                <CalendarDays className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  No lessons in this series yet.
                </p>
              </CardContent>
            </Card>
          ) : (
            <LessonSeriesCalendar lessons={lessons} />
          )}
        </>
      )}
    </div>
  );
}
