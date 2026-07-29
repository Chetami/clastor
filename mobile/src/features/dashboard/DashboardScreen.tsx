import { useEffect, useMemo, useState } from "react";
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
import type {
  DashboardPeriod,
  DashboardSummaryResponse,
  LessonResponse,
} from "@examify-tms/interfaces";
import {
  useAuthStore,
  useDashboardSummary,
  useListLessons,
  useListStudents,
  useUserCurrency,
} from "@examify-tms/shared";
import { colors, spacing } from "@/lib/theme";
import {
  ATTENDANCE_LABELS,
  deltaPercent,
  findCurrentLesson,
  formatCurrency,
  formatHours,
  formatRate,
  getInitials,
  lessonTimeRange,
  nextLesson,
  previousPeriodLabel,
  relativeDayLabel,
  timeUntil,
  todoLessons,
} from "@/lib/format";

const PERIODS: { value: DashboardPeriod; label: string }[] = [
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
];

export default function DashboardScreen() {
  const user = useAuthStore((s) => s.user);
  const currency = useUserCurrency();
  const [period, setPeriod] = useState<DashboardPeriod>("week");

  const summaryQuery = useDashboardSummary(period);
  const lessonsQuery = useListLessons();
  const studentsQuery = useListStudents();
  const summary = summaryQuery.data;
  const lessons = lessonsQuery.data ?? [];
  const students = studentsQuery.data ?? [];

  const refreshing =
    (summaryQuery.isFetching && !summaryQuery.isLoading) ||
    (lessonsQuery.isFetching && !lessonsQuery.isLoading);

  const studentNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const s of students) map[s.id] = s.name;
    return map;
  }, [students]);

  const current = useMemo(() => findCurrentLesson(lessons), [lessons]);
  const upcoming = useMemo(() => nextLesson(lessons), [lessons]);
  const todos = useMemo(() => todoLessons(lessons), [lessons]);

  // Re-render every 30s so the next-lesson countdown stays fresh.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const firstName = user?.name?.split(" ")[0];

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              summaryQuery.refetch();
              lessonsQuery.refetch();
              studentsQuery.refetch();
            }}
            tintColor={colors.primary}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.greeting}>
            Welcome back{firstName ? `, ${firstName}` : ""}.
          </Text>
          <Text style={styles.subtitle}>
            Here's what's happening with your tutoring.
          </Text>
          <PeriodSelector value={period} onChange={setPeriod} />
        </View>

        {/* Live lesson banner */}
        {current && (
          <View style={styles.liveBanner}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>
              In progress ·{" "}
              {studentNames[current.studentId] ?? "Student"}
              {current.subject ? ` · ${current.subject}` : ""}
            </Text>
          </View>
        )}

        {/* Stat cards */}
        {summaryQuery.isLoading || !summary ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <StatGrid
            summary={summary}
            period={period}
            currency={currency}
          />
        )}

        {/* Next lesson */}
        <SectionTitle>Next lesson</SectionTitle>
        <NextLessonCard lesson={upcoming} studentName={upcoming ? studentNames[upcoming.studentId] : ""} />

        {/* Things to do */}
        <SectionTitle>Things to do</SectionTitle>
        {todos.length === 0 ? (
          <EmptyCard
            icon="checkmark-done-circle"
            text="You're all caught up — no lessons need attendance."
          />
        ) : (
          <View style={styles.stack}>
            {todos.map((lesson) => (
              <TodoRow
                key={lesson.id}
                lesson={lesson}
                studentName={studentNames[lesson.studentId] ?? "Student"}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/* -------------------------------- Period selector ------------------------- */

function PeriodSelector({
  value,
  onChange,
}: {
  value: DashboardPeriod;
  onChange: (p: DashboardPeriod) => void;
}) {
  return (
    <View style={styles.segment}>
      {PERIODS.map((p) => {
        const active = p.value === value;
        return (
          <Pressable
            key={p.value}
            onPress={() => onChange(p.value)}
            style={[styles.segmentItem, active && styles.segmentItemActive]}
          >
            <Text
              style={[
                styles.segmentText,
                active && styles.segmentTextActive,
              ]}
            >
              {p.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* --------------------------------- Stat grid ------------------------------ */

function StatGrid({
  summary,
  period,
  currency,
}: {
  summary: DashboardSummaryResponse;
  period: DashboardPeriod;
  currency: string;
}) {
  const incomeDelta = deltaPercent(summary.income, summary.previousIncome);
  const hoursDelta = deltaPercent(summary.hoursWorked, summary.previousHoursWorked);
  const lessonsDelta = deltaPercent(
    summary.lessonsTaught,
    summary.previousLessonsTaught,
  );

  const cards: {
    key: string;
    icon: Parameters<typeof StatCard>[0]["icon"];
    label: string;
    value: string;
    delta?: number | null;
    sub: string;
    tone: "neutral" | "danger";
  }[] = [
    {
      key: "income",
      icon: "cash",
      label: "Income",
      value: formatCurrency(summary.income, currency),
      delta: incomeDelta,
      sub: `${previousPeriodLabel(period)} ${formatCurrency(summary.previousIncome, currency)}`,
      tone: "neutral",
    },
    {
      key: "hours",
      icon: "time",
      label: "Hours taught",
      value: formatHours(summary.hoursWorked),
      delta: hoursDelta,
      sub: `${previousPeriodLabel(period)} ${formatHours(summary.previousHoursWorked)}`,
      tone: "neutral",
    },
    {
      key: "lessons",
      icon: "checkmark-done",
      label: "Lessons taught",
      value: String(summary.lessonsTaught),
      delta: lessonsDelta,
      sub: `${formatRate(summary.attendanceRate)} attendance`,
      tone: "neutral",
    },
    {
      key: "outstanding",
      icon: "wallet",
      label: "Outstanding",
      value: formatCurrency(summary.outstandingAmount, currency),
      sub:
        summary.overdueAmount > 0
          ? `incl. ${formatCurrency(summary.overdueAmount, currency)} overdue`
          : `${summary.unbilledLessons} unbilled`,
      tone: summary.overdueAmount > 0 ? "danger" : "neutral",
    },
  ];

  return (
    <View style={styles.grid}>
      {[0, 2].map((start) => (
        <View key={start} style={styles.gridRow}>
          {cards.slice(start, start + 2).map((c) => (
            <View key={c.key} style={styles.gridCell}>
              <StatCard
                icon={c.icon}
                label={c.label}
                value={c.value}
                delta={c.delta}
                sub={c.sub}
                tone={c.tone}
              />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function StatCard({
  icon,
  label,
  value,
  delta,
  sub,
  tone = "neutral",
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  delta?: number | null;
  sub?: string;
  tone?: "neutral" | "danger";
}) {
  const isUp = (delta ?? null) !== null && delta! > 0;
  const isDown = (delta ?? null) !== null && delta! < 0;
  const deltaColor = isUp
    ? colors.success
    : isDown
      ? colors.danger
      : colors.muted;

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={styles.cardLabel}>{label}</Text>
        <View
          style={[
            styles.cardIcon,
            tone === "danger" && styles.cardIconDanger,
          ]}
        >
          <Ionicons name={icon} size={15} color={tone === "danger" ? colors.danger : colors.primary} />
        </View>
      </View>
      <View style={styles.cardValueRow}>
        <Text style={styles.cardValue}>{value}</Text>
        {delta !== undefined && delta !== null && (
          <Text style={[styles.cardDelta, { color: deltaColor }]}>
            {isUp ? "▲" : isDown ? "▼" : "–"} {Math.abs(Math.round(delta))}%
          </Text>
        )}
      </View>
      {sub ? (
        <Text
          style={[
            styles.cardSub,
            tone === "danger" && { color: colors.danger },
          ]}
          numberOfLines={1}
        >
          {sub}
        </Text>
      ) : null}
    </View>
  );
}

/* ------------------------------- Next lesson ------------------------------ */

function NextLessonCard({
  lesson,
  studentName,
}: {
  lesson: LessonResponse | undefined;
  studentName: string;
}) {
  if (!lesson) {
    return (
      <View style={[styles.card, styles.nextCard]}>
        <Ionicons
          name="calendar"
          size={18}
          color={colors.muted}
          style={{ marginBottom: spacing.sm }}
        />
        <Text style={styles.mutedText}>No upcoming lessons scheduled.</Text>
      </View>
    );
  }

  const callLink = lesson.meetLink;

  return (
    <View style={[styles.card, styles.nextCard]}>
      <View style={styles.nextRow}>
        <View style={{ flexShrink: 1 }}>
          <Text style={styles.nextCountdown}>
            {timeUntil(lesson.startDateTime)}
          </Text>
          <Text style={styles.nextWhen}>
            {relativeDayLabel(lesson.startDateTime)} · {lessonTimeRange(lesson)}
          </Text>
          <Text style={styles.nextWho} numberOfLines={1}>
            {studentName || "Student"}
            {lesson.subject ? ` · ${lesson.subject}` : ""}
          </Text>
        </View>

        {callLink ? (
          <Pressable
            style={styles.joinButton}
            onPress={() => Linking.openURL(callLink)}
          >
            <Ionicons name="videocam" size={16} color="#fff" />
            <Text style={styles.joinText}>Join</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/* ------------------------------- Things to do ----------------------------- */

function TodoRow({
  lesson,
  studentName,
}: {
  lesson: LessonResponse;
  studentName: string;
}) {
  return (
    <View style={styles.todoRow}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{getInitials(studentName)}</Text>
      </View>
      <View style={{ flexShrink: 1 }}>
        <Text style={styles.todoName} numberOfLines={1}>
          {studentName}
          {lesson.subject ? ` · ${lesson.subject}` : ""}
        </Text>
        <Text style={styles.todoMeta}>
          {relativeDayLabel(lesson.startDateTime)} · {lessonTimeRange(lesson)}
        </Text>
      </View>
      <View style={styles.todoBadge}>
        <Text style={styles.todoBadgeText}>
          {ATTENDANCE_LABELS[lesson.attendanceStatus] ?? "Record"}
        </Text>
      </View>
    </View>
  );
}

/* --------------------------------- Shared UI ------------------------------ */

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

function EmptyCard({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={[styles.card, styles.emptyCard]}>
      <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={26} color={colors.mutedSoft} />
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceAlt },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xl },

  header: { marginBottom: spacing.lg },
  greeting: { fontSize: 24, fontWeight: "700", color: colors.ink, letterSpacing: -0.3 },
  subtitle: { fontSize: 14, color: colors.muted, marginTop: 2, marginBottom: spacing.md },

  segment: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 3,
    alignSelf: "flex-start",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  segmentItem: { paddingVertical: 7, paddingHorizontal: 16, borderRadius: 8 },
  segmentItemActive: { backgroundColor: colors.primary },
  segmentText: { fontSize: 13, fontWeight: "600", color: colors.muted },
  segmentTextActive: { color: "#fff" },

  loadingRow: { paddingVertical: spacing.xl, alignItems: "center" },

  liveBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.successTint,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: spacing.md,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  liveText: { color: colors.success, fontSize: 13, fontWeight: "600" },

  grid: {
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  gridRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  gridCell: {
    flex: 1,
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  cardLabel: { fontSize: 11, color: colors.muted, fontWeight: "500" },
  cardIcon: {
    width: 26,
    height: 26,
    borderRadius: 7,
    backgroundColor: colors.primaryTint,
    alignItems: "center",
    justifyContent: "center",
  },
  cardIconDanger: { backgroundColor: colors.dangerTint },
  cardValueRow: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  cardValue: { fontSize: 20, fontWeight: "700", color: colors.ink, letterSpacing: -0.3 },
  cardDelta: { fontSize: 11, fontWeight: "600" },
  cardSub: { fontSize: 11, color: colors.muted, marginTop: 6 },

  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.ink,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },

  nextCard: { marginBottom: spacing.xs },
  nextRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  nextCountdown: { fontSize: 24, fontWeight: "700", color: colors.primary, letterSpacing: -0.3 },
  nextWhen: { fontSize: 12, color: colors.muted, marginTop: 2 },
  nextWho: { fontSize: 14, fontWeight: "600", color: colors.ink, marginTop: 6 },

  joinButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  joinText: { color: "#fff", fontSize: 14, fontWeight: "600" },

  mutedText: { fontSize: 14, color: colors.muted },

  stack: { gap: spacing.sm },
  todoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryTint,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 13, fontWeight: "700", color: colors.primary },
  todoName: { fontSize: 14, fontWeight: "600", color: colors.ink },
  todoMeta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  todoBadge: {
    backgroundColor: colors.warningTint,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  todoBadgeText: { fontSize: 11, fontWeight: "600", color: colors.warning },

  emptyCard: { alignItems: "center", gap: 8, paddingVertical: spacing.xl },
  emptyText: { fontSize: 14, color: colors.muted, textAlign: "center" },
});
