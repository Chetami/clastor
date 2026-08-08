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
import { useLocalSearchParams, useRouter } from "expo-router";
import type { LessonResponse } from "@examify-tms/interfaces";
import {
  deriveLessonStatus,
  useGetStudent,
  useListLessons,
  useUserCurrency,
} from "@examify-tms/shared";
import { colors, spacing } from "@/lib/theme";
import {
  ATTENDANCE_LABELS,
  compactCurrency,
  formatCurrencyFull,
  formatFrequency,
  getInitials,
  lessonTimeRange,
  relativeDayLabel,
  rateUnit,
} from "@/lib/format";

export default function StudentDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const currency = useUserCurrency();

  const studentQuery = useGetStudent(id);
  const lessonsQuery = useListLessons({ studentId: id, status: "all" });
  const student = studentQuery.data;
  const lessons = lessonsQuery.data ?? [];

  const recent = useMemo(
    () =>
      [...lessons]
        .sort(
          (a, b) =>
            new Date(b.startDateTime).getTime() -
            new Date(a.startDateTime).getTime(),
        )
        .slice(0, 12),
    [lessons],
  );

  const refreshing =
    (studentQuery.isFetching && !studentQuery.isLoading) ||
    (lessonsQuery.isFetching && !lessonsQuery.isLoading);

  if (studentQuery.isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <NavBar onBack={() => router.back()} title="Student" />
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!student) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <NavBar onBack={() => router.back()} title="Student" />
        <View style={styles.loading}>
          <Text style={styles.muted}>Student not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isActive = student.status === "active";

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <NavBar onBack={() => router.back()} title={student.name} />
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              studentQuery.refetch();
              lessonsQuery.refetch();
            }}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={styles.scroll}
      >
        {/* Profile header */}
        <View style={styles.profileCard}>
          <View style={styles.profileAvatar}>
            <Text style={styles.profileAvatarText}>
              {getInitials(student.name)}
            </Text>
          </View>
          <View style={{ flexShrink: 1 }}>
            <View style={styles.profileNameRow}>
              <Text style={styles.profileName} numberOfLines={1}>
                {student.name}
              </Text>
              <View
                style={[
                  styles.statusBadge,
                  isActive ? styles.statusActive : styles.statusPast,
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    isActive ? styles.statusTextActive : styles.statusTextPast,
                  ]}
                >
                  {isActive ? "Active" : "Past"}
                </Text>
              </View>
            </View>
            {student.email ? (
              <Pressable onPress={() => Linking.openURL(`mailto:${student.email}`)}>
                <Text style={styles.contactLink} numberOfLines={1}>
                  {student.email}
                </Text>
              </Pressable>
            ) : null}
            {student.phone ? (
              <Pressable onPress={() => Linking.openURL(`tel:${student.phone}`)}>
                <Text style={styles.contactLink} numberOfLines={1}>
                  {student.phone}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statRow}>
          <View style={styles.statCell}>
            <Text style={styles.statLabel}>Rate</Text>
            <Text style={styles.statValue}>
              {compactCurrency(student.expectedAmount, currency)}
              <Text style={styles.statUnit}>{rateUnit(student.rateType)}</Text>
            </Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCell}>
            <Text style={styles.statLabel}>Frequency</Text>
            <Text style={styles.statValue}>
              {formatFrequency(student.frequencyPerWeek, student.rateType)}
            </Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCell}>
            <Text style={styles.statLabel}>Owed</Text>
            <Text
              style={[
                styles.statValue,
                student.amountOwed > 0 && { color: colors.danger },
              ]}
            >
              {formatCurrencyFull(student.amountOwed, currency)}
            </Text>
          </View>
        </View>

        {student.notes ? (
          <View style={styles.notesCard}>
            <Text style={styles.notesLabel}>Notes</Text>
            <Text style={styles.notesText}>{student.notes}</Text>
          </View>
        ) : null}

        {/* Recent lessons */}
        <Text style={styles.sectionTitle}>Recent lessons</Text>
        {lessonsQuery.isLoading ? (
          <View style={{ paddingVertical: spacing.xl, alignItems: "center" }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : recent.length === 0 ? (
          <View style={styles.emptyLessons}>
            <Text style={styles.muted}>No lessons on record.</Text>
          </View>
        ) : (
          <View style={styles.lessonList}>
            {recent.map((lesson) => (
              <LessonMiniRow key={lesson.id} lesson={lesson} />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function NavBar({
  title,
  onBack,
}: {
  title: string;
  onBack: () => void;
}) {
  return (
    <View style={styles.navBar}>
      <Pressable
        onPress={onBack}
        style={({ pressed }) => [
          styles.backButton,
          pressed && { opacity: 0.6 },
        ]}
      >
        <Ionicons name="chevron-back" size={22} color={colors.primary} />
      </Pressable>
      <Text style={styles.navTitle} numberOfLines={1}>
        {title}
      </Text>
    </View>
  );
}

function LessonMiniRow({ lesson }: { lesson: LessonResponse }) {
  const cancelled =
    deriveLessonStatus(lesson.attendanceStatus, lesson.isCancelled) ===
    "cancelled";

  return (
    <View style={styles.lessonRow}>
      <View style={{ flexShrink: 1 }}>
        <Text style={styles.lessonSubject} numberOfLines={1}>
          {lesson.subject ?? "Lesson"}
        </Text>
        <Text style={styles.lessonMeta}>
          {relativeDayLabel(lesson.startDateTime)} · {lessonTimeRange(lesson)}
        </Text>
      </View>
      <Text
        style={[
          styles.lessonStatus,
          cancelled && { color: colors.mutedSoft },
        ]}
        numberOfLines={1}
      >
        {cancelled
          ? "Cancelled"
          : ATTENDANCE_LABELS[lesson.attendanceStatus] ?? "—"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceAlt },

  navBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  backButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  navTitle: { fontSize: 17, fontWeight: "600", color: colors.ink, flexShrink: 1 },

  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  muted: { fontSize: 14, color: colors.muted },

  scroll: { padding: spacing.lg, paddingBottom: spacing.xl },

  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  profileAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primaryTint,
    alignItems: "center",
    justifyContent: "center",
  },
  profileAvatarText: { fontSize: 20, fontWeight: "700", color: colors.primary },
  profileNameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  profileName: { fontSize: 19, fontWeight: "700", color: colors.ink, flexShrink: 1 },
  contactLink: { fontSize: 13, color: colors.primary, marginTop: 3 },

  statusBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  statusActive: { backgroundColor: colors.successTint },
  statusPast: { backgroundColor: colors.surfaceAlt },
  statusText: { fontSize: 10, fontWeight: "700" },
  statusTextActive: { color: colors.success },
  statusTextPast: { color: colors.muted },

  statRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    marginTop: spacing.md,
    paddingVertical: spacing.md,
  },
  statCell: { flex: 1, alignItems: "center" },
  statDivider: { width: StyleSheet.hairlineWidth, height: 32, backgroundColor: colors.line },
  statLabel: { fontSize: 11, color: colors.muted, fontWeight: "500" },
  statValue: { fontSize: 15, fontWeight: "700", color: colors.ink, marginTop: 4 },
  statUnit: { fontSize: 11, fontWeight: "400", color: colors.muted },

  notesCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    marginTop: spacing.md,
    padding: spacing.lg,
  },
  notesLabel: { fontSize: 11, fontWeight: "700", color: colors.inkSoft, textTransform: "uppercase", letterSpacing: 0.4 },
  notesText: { fontSize: 14, color: colors.inkSoft, marginTop: 6, lineHeight: 20 },

  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.ink,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },

  emptyLessons: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    padding: spacing.xl,
    alignItems: "center",
  },

  lessonList: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    overflow: "hidden",
  },
  lessonRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  lessonSubject: { fontSize: 14, fontWeight: "600", color: colors.ink },
  lessonMeta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  lessonStatus: { fontSize: 12, fontWeight: "600", color: colors.inkSoft, textAlign: "right" },
});
