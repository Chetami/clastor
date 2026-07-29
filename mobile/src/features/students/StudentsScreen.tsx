import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import type { StudentResponse } from "@examify-tms/interfaces";
import { useListStudents, useUserCurrency } from "@examify-tms/shared";
import { colors, spacing } from "@/lib/theme";
import {
  compactCurrency,
  formatFrequency,
  getInitials,
  rateUnit,
} from "@/lib/format";

type StatusFilter = "active" | "past" | "all";

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "past", label: "Past" },
  { value: "all", label: "All" },
];

export default function StudentsScreen() {
  const router = useRouter();
  const currency = useUserCurrency();
  const {
    data: students = [],
    isLoading,
    isFetching,
    refetch,
  } = useListStudents();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [search, setSearch] = useState("");

  const activeCount = students.filter((s) => s.status === "active").length;
  const pastCount = students.filter((s) => s.status === "past").length;

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return students
      .filter((s) => {
        const matchesStatus =
          statusFilter === "all" || s.status === statusFilter;
        const matchesSearch =
          query.length === 0 ||
          s.name.toLowerCase().includes(query) ||
          s.email.toLowerCase().includes(query);
        return matchesStatus && matchesSearch;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [students, statusFilter, search]);

  const refreshing = isFetching && !isLoading;

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Students</Text>
        <Text style={styles.subtitle}>{students.length} total</Text>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Ionicons
          name="search"
          size={16}
          color={colors.muted}
          style={styles.searchIcon}
        />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search students..."
          placeholderTextColor={colors.mutedSoft}
          style={styles.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {/* Filter */}
      <View style={styles.filterRow}>
        {FILTERS.map((f) => {
          const active = f.value === statusFilter;
          const count =
            f.value === "active"
              ? activeCount
              : f.value === "past"
                ? pastCount
                : students.length;
          return (
            <Pressable
              key={f.value}
              onPress={() => setStatusFilter(f.value)}
              style={[styles.filterChip, active && styles.filterChipActive]}
            >
              <Text
                style={[
                  styles.filterText,
                  active && styles.filterTextActive,
                ]}
              >
                {f.label}
              </Text>
              <Text
                style={[
                  styles.filterCount,
                  active && styles.filterCountActive,
                ]}
              >
                {count}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => refetch()}
              tintColor={colors.primary}
            />
          }
        >
          {visible.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons
                  name="people-outline"
                  size={32}
                  color={colors.mutedSoft}
                />
              </View>
              <Text style={styles.emptyTitle}>
                {search.trim()
                  ? "No students match your search."
                  : `No ${statusFilter === "all" ? "" : statusFilter} students yet.`}
              </Text>
            </View>
          ) : (
            <View style={styles.list}>
              {visible.map((student) => (
                <StudentRow
                  key={student.id}
                  student={student}
                  currency={currency}
                  onPress={() =>
                    router.push(`/students/${student.id}`)
                  }
                />
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function StudentRow({
  student,
  currency,
  onPress,
}: {
  student: StudentResponse;
  currency: string;
  onPress: () => void;
}) {
  const isActive = student.status === "active";

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.studentRow, pressed && { opacity: 0.6 }]}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{getInitials(student.name)}</Text>
      </View>

      <View style={{ flexShrink: 1, flexGrow: 1 }}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
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
        <Text style={styles.email} numberOfLines={1}>
          {student.email}
        </Text>
      </View>

      <View style={styles.rateColumn}>
        <Text style={styles.rate}>
          {compactCurrency(student.expectedAmount, currency)}
          <Text style={styles.rateUnit}>{rateUnit(student.rateType)}</Text>
        </Text>
        <Text style={styles.frequency}>
          {formatFrequency(student.frequencyPerWeek, student.rateType)}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceAlt },

  header: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  title: { fontSize: 22, fontWeight: "700", color: colors.ink, letterSpacing: -0.3 },
  subtitle: { fontSize: 13, color: colors.muted },

  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    paddingHorizontal: 12,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 15, color: colors.ink },

  filterRow: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surface,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  filterChipActive: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  filterText: { fontSize: 13, fontWeight: "600", color: colors.muted },
  filterTextActive: { color: "#fff" },
  filterCount: {
    fontSize: 11,
    color: colors.muted,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 5,
    overflow: "hidden",
  },
  filterCountActive: { color: "#fff", backgroundColor: "rgba(255,255,255,0.2)" },

  loading: { flex: 1, alignItems: "center", justifyContent: "center" },

  scroll: { padding: spacing.lg, paddingBottom: spacing.xl },
  list: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    overflow: "hidden",
  },

  studentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },

  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryTint,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 14, fontWeight: "700", color: colors.primary },

  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 1,
  },
  name: { fontSize: 15, fontWeight: "600", color: colors.ink, flexShrink: 1 },
  statusBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  statusActive: { backgroundColor: colors.successTint },
  statusPast: { backgroundColor: colors.surfaceAlt },
  statusText: { fontSize: 10, fontWeight: "700" },
  statusTextActive: { color: colors.success },
  statusTextPast: { color: colors.muted },

  email: { fontSize: 13, color: colors.muted, marginTop: 2 },

  rateColumn: { alignItems: "flex-end" },
  rate: { fontSize: 14, fontWeight: "600", color: colors.ink },
  rateUnit: { fontSize: 11, fontWeight: "400", color: colors.muted },
  frequency: { fontSize: 11, color: colors.muted, marginTop: 1 },

  empty: { alignItems: "center", paddingVertical: spacing.xl * 2 },
  emptyIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  emptyTitle: { fontSize: 14, color: colors.muted, textAlign: "center" },
});
