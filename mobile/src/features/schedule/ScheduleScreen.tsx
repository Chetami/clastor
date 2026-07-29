import { useMemo } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { LessonResponse } from "@examify-tms/interfaces";
import { useListLessons, useListStudents } from "@examify-tms/shared";
import { colors, spacing } from "@/lib/theme";
import {
  ACCEPTANCE_LABELS,
  ATTENDANCE_LABELS,
  getInitials,
  groupByDay,
  lessonTimeRange,
  monthYear,
} from "@/lib/format";

export default function ScheduleScreen() {
  const lessonsQuery = useListLessons({ status: "upcoming" });
  const studentsQuery = useListStudents();

  const lessons = lessonsQuery.data ?? [];
  const students = studentsQuery.data ?? [];

  const studentNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const s of students) map[s.id] = s.name;
    return map;
  }, [students]);

  const groups = useMemo(() => groupByDay(lessons), [lessons]);
  const now = new Date();

  const refreshing =
    (lessonsQuery.isFetching && !lessonsQuery.isLoading) ||
    (studentsQuery.isFetching && !studentsQuery.isLoading);

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Schedule</Text>
          <Text style={styles.subtitle}>{monthYear(now)}</Text>
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.todayButton,
            pressed && { opacity: 0.7 },
          ]}
          onPress={() => lessonsQuery.refetch()}
        >
          <Ionicons name="refresh" size={14} color={colors.primary} />
          <Text style={styles.todayText}>Refresh</Text>
        </Pressable>
      </View>

      {lessonsQuery.isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : groups.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Ionicons name="calendar-outline" size={34} color={colors.mutedSoft} />
          </View>
          <Text style={styles.emptyTitle}>No upcoming lessons</Text>
          <Text style={styles.emptyText}>
            Scheduled lessons will appear here grouped by day.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                lessonsQuery.refetch();
                studentsQuery.refetch();
              }}
              tintColor={colors.primary}
            />
          }
        >
          {groups.map((group) => (
            <View key={group.key} style={styles.section}>
              <Text style={styles.sectionHeader}>{group.label}</Text>
              <View style={styles.cardStack}>
                {group.lessons.map((lesson) => (
                  <LessonCard
                    key={lesson.id}
                    lesson={lesson}
                    studentName={studentNames[lesson.studentId]}
                  />
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function LessonCard({
  lesson,
  studentName,
}: {
  lesson: LessonResponse;
  studentName?: string;
}) {
  const cancelled = deriveCancelled(lesson);
  const name = studentName ?? "Student";
  const dotColor = acceptanceDotColor(lesson.acceptanceStatus);

  return (
    <View style={styles.lessonCard}>
      <View style={styles.timeColumn}>
        <Text style={styles.timeStart}>
          {lessonTimeRange(lesson).split(" – ")[0]}
        </Text>
        <Text style={styles.timeDur}>{lesson.durationMinutes}m</Text>
      </View>

      <View style={styles.divider} />

      <View style={{ flexShrink: 1 }}>
        <View style={styles.lessonTitleRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials(name)}</Text>
          </View>
          <Text style={styles.lessonName} numberOfLines={1}>
            {name}
          </Text>
        </View>
        {lesson.subject ? (
          <Text style={styles.lessonSubject} numberOfLines={1}>
            {lesson.subject}
          </Text>
        ) : null}
        <View style={styles.badgeRow}>
          <View
            style={[styles.dotBadge, { backgroundColor: dotColor }]}
          />
          <Text style={styles.badgeText}>
            {cancelled
              ? "Cancelled"
              : ATTENDANCE_LABELS[lesson.attendanceStatus] ??
                ACCEPTANCE_LABELS[lesson.acceptanceStatus] ??
                "Scheduled"}
          </Text>
          {lesson.meetLink ? (
            <Pressable
              style={styles.joinChip}
              onPress={() => lesson.meetLink && Linking.openURL(lesson.meetLink)}
            >
              <Ionicons name="videocam" size={11} color={colors.primary} />
              <Text style={styles.joinChipText}>Join</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function acceptanceDotColor(acceptance: string): string {
  switch (acceptance) {
    case "accepted":
      return colors.emerald;
    case "pending":
      return colors.amber;
    case "declined":
      return colors.rose;
    default:
      return colors.mutedSoft;
  }
}

function deriveCancelled(lesson: LessonResponse): boolean {
  if (lesson.isCancelled) return true;
  return (
    lesson.attendanceStatus === "tutor_cancelled" ||
    lesson.attendanceStatus === "tutor_cancelled_makeup_issued"
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceAlt },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  title: { fontSize: 22, fontWeight: "700", color: colors.ink, letterSpacing: -0.3 },
  subtitle: { fontSize: 13, color: colors.muted, marginTop: 2 },

  todayButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.primaryTint,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  todayText: { color: colors.primary, fontSize: 13, fontWeight: "600" },

  loading: { flex: 1, alignItems: "center", justifyContent: "center" },

  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: colors.ink },
  emptyText: {
    fontSize: 14,
    color: colors.muted,
    textAlign: "center",
    marginTop: 6,
    maxWidth: 260,
  },

  scroll: { padding: spacing.lg, paddingBottom: spacing.xl },
  section: { marginBottom: spacing.lg },
  sectionHeader: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.inkSoft,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: spacing.sm,
    marginLeft: 2,
  },

  cardStack: { gap: spacing.sm },

  lessonCard: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  timeColumn: { width: 58, justifyContent: "center" },
  timeStart: { fontSize: 14, fontWeight: "700", color: colors.ink },
  timeDur: { fontSize: 11, color: colors.muted, marginTop: 2 },

  divider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: colors.line,
    marginHorizontal: spacing.sm,
  },

  lessonTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primaryTint,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 10, fontWeight: "700", color: colors.primary },
  lessonName: { fontSize: 15, fontWeight: "600", color: colors.ink, flexShrink: 1 },
  lessonSubject: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 3,
    marginLeft: 36,
  },

  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 8,
    marginLeft: 36,
  },
  dotBadge: { width: 7, height: 7, borderRadius: 4 },
  badgeText: { fontSize: 11, color: colors.inkSoft, fontWeight: "500" },

  joinChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: colors.primaryTint,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginLeft: "auto",
  },
  joinChipText: { fontSize: 11, fontWeight: "600", color: colors.primary },
});
