import { Screen } from "@/components/screen";
import { Box, Card, Text, Spinner, ScreenError } from "@/components/ui";
import { useListLessons } from "@examify-tms/shared";
import { format, parseISO, isToday, isTomorrow } from "date-fns";

export default function ScheduleScreen() {
  const { data, isLoading, isError, error } = useListLessons();

  if (isLoading) return <Screen title="Schedule"><Spinner /></Screen>;
  if (isError) return <Screen title="Schedule"><ScreenError message={error.message} /></Screen>;

  const lessons = data ?? [];

  const byDay = new Map<string, typeof lessons>();
  for (const lesson of lessons) {
    const dayKey = format(parseISO(lesson.startDateTime), "yyyy-MM-dd");
    const list = byDay.get(dayKey) ?? [];
    list.push(lesson);
    byDay.set(dayKey, list);
  }

  const sortedDays = [...byDay.keys()].sort();

  return (
    <Screen title="Schedule" subtitle={`${lessons.length} lessons`}>
      {sortedDays.length === 0 && (
        <Text variant="muted">No upcoming lessons.</Text>
      )}
      {sortedDays.map((dayKey) => {
        const dayLessons = byDay.get(dayKey)!;
        const date = parseISO(dayKey + "T00:00:00");
        const label = isToday(date)
          ? "Today"
          : isTomorrow(date)
            ? "Tomorrow"
            : format(date, "EEE d MMM");
        return (
          <Box key={dayKey} className="mb-5">
            <Text variant="label" className="mb-2">{label}</Text>
            {dayLessons.map((lesson) => (
              <Card key={lesson.id} className="mb-2 flex-row items-center">
                <Box className="w-16">
                  <Text className="font-semibold">
                    {format(parseISO(lesson.startDateTime), "HH:mm")}
                  </Text>
                  <Text variant="muted" className="text-xs">
                    {format(parseISO(lesson.startDateTime), "EEE")}
                  </Text>
                </Box>
                <Box className="flex-1">
                  <Text className="font-medium">{lesson.subject ?? "Lesson"}</Text>
                  <Text variant="muted">{lesson.durationMinutes} min</Text>
                </Box>
                <Box className="items-end">
                  <Text className="text-xs text-gray-400">
                    {format(parseISO(lesson.startDateTime), "h:mm a")}
                  </Text>
                </Box>
              </Card>
            ))}
          </Box>
        );
      })}
    </Screen>
  );
}
