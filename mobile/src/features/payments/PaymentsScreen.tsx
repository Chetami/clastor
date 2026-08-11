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
import type { InvoiceResponse, InvoiceStatus } from "@examify-tms/interfaces";
import { useListInvoices, useUserCurrency } from "@examify-tms/shared";
import { colors, spacing } from "@/lib/theme";
import {
  INVOICE_STATUS_META,
  compactCurrency,
  formatCurrencyFull,
  formatDate,
  isOverdue,
} from "@/lib/format";

type StatusFilter = InvoiceStatus | "all";

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "open", label: "Open" },
  { value: "overdue", label: "Overdue" },
  { value: "paid", label: "Paid" },
  { value: "void", label: "Void" },
];

export default function PaymentsScreen() {
  const router = useRouter();
  const currency = useUserCurrency();
  const { data: invoices = [], isLoading, isFetching, refetch } = useListInvoices();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: invoices.length };
    for (const inv of invoices) c[inv.status] = (c[inv.status] ?? 0) + 1;
    return c;
  }, [invoices]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return invoices
      .filter((inv) => {
        const matchesStatus =
          statusFilter === "all" || inv.status === statusFilter;
        const matchesSearch =
          query.length === 0 ||
          inv.invoiceNumber.toLowerCase().includes(query) ||
          inv.customerName.toLowerCase().includes(query) ||
          (inv.billingEmail ?? "").toLowerCase().includes(query);
        return matchesStatus && matchesSearch;
      })
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  }, [invoices, statusFilter, search]);

  const total = visible.reduce((sum, i) => sum + i.total, 0);
  const refreshing = isFetching && !isLoading;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Payments</Text>
        <Text style={styles.subtitle}>{invoices.length} invoices</Text>
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
          placeholder="Search invoices, customers..."
          placeholderTextColor={colors.mutedSoft}
          style={styles.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {/* Status chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ height: 48, flexGrow: 0, flexShrink: 0 }}
        contentContainerStyle={styles.chipsRow}
      >
        {STATUS_TABS.map((tab) => {
          const active = tab.value === statusFilter;
          const count = counts[tab.value] ?? 0;
          return (
            <Pressable
              key={tab.value}
              onPress={() => setStatusFilter(tab.value)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text
                style={[styles.chipText, active && styles.chipTextActive]}
              >
                {tab.label}
              </Text>
              <Text
                style={[
                  styles.chipCount,
                  active && styles.chipCountActive,
                ]}
              >
                {count}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
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
                  name="receipt-outline"
                  size={32}
                  color={colors.mutedSoft}
                />
              </View>
              <Text style={styles.emptyTitle}>
                {search.trim()
                  ? "No invoices match your search."
                  : `No ${statusFilter === "all" ? "" : statusFilter} invoices yet.`}
              </Text>
            </View>
          ) : (
            <View style={styles.list}>
              {visible.map((invoice) => (
                <InvoiceRow
                  key={invoice.id}
                  invoice={invoice}
                  onPress={() => router.push(`/payments/${invoice.id}`)}
                />
              ))}
            </View>
          )}

          {visible.length > 0 && (
            <View style={styles.summaryFooter}>
              <Text style={styles.summaryText}>
                {visible.length}{" "}
                {visible.length === 1 ? "invoice" : "invoices"}
              </Text>
              <Text style={styles.summaryTotal}>
                Total {formatCurrencyFull(total, currency)}
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function InvoiceRow({
  invoice,
  onPress,
}: {
  invoice: InvoiceResponse;
  onPress: () => void;
}) {
  const meta = INVOICE_STATUS_META[invoice.status];
  const overdue = isOverdue(invoice);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.invoiceRow, pressed && { opacity: 0.6 }]}
    >
      <View style={styles.invoiceMain}>
        <View style={styles.invoiceTopRow}>
          <Text style={styles.invoiceNumber}>{invoice.invoiceNumber}</Text>
          <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
            <Text style={[styles.statusText, { color: meta.text }]}>
              {meta.label}
            </Text>
          </View>
        </View>
        <Text style={styles.customerName} numberOfLines={1}>
          {invoice.customerName}
        </Text>
        <Text
          style={[styles.invoiceMeta, overdue && { color: colors.danger, fontWeight: "600" }]}
        >
          {overdue ? "Overdue · " : "Due "}
          {formatDate(invoice.dueDate)}
        </Text>
      </View>

      <View style={styles.amountColumn}>
        <Text style={styles.amount}>
          {compactCurrency(invoice.total, invoice.currency)}
        </Text>
        <Ionicons
          name="chevron-forward"
          size={14}
          color={colors.mutedSoft}
          style={{ marginTop: 8 }}
        />
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

  chipsRow: {
    gap: 6,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    height: 32,
    gap: 6,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontSize: 13, fontWeight: "600", color: colors.muted },
  chipTextActive: { color: "#fff" },
  chipCount: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.muted,
    backgroundColor: colors.surfaceAlt,
    minWidth: 18,
    height: 16,
    lineHeight: 16,
    paddingHorizontal: 4,
    textAlign: "center",
    textAlignVertical: "center",
    borderRadius: 8,
    overflow: "hidden",
    includeFontPadding: false,
  },
  chipCountActive: { color: "#fff", backgroundColor: "rgba(255,255,255,0.2)" },

  loading: { flex: 1, alignItems: "center", justifyContent: "center" },

  scroll: { padding: spacing.lg, paddingBottom: spacing.xl },

  list: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    overflow: "hidden",
  },

  invoiceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  invoiceMain: { flexShrink: 1, flexGrow: 1 },
  invoiceTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  invoiceNumber: { fontSize: 15, fontWeight: "700", color: colors.ink },
  statusBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  statusText: { fontSize: 10, fontWeight: "700" },
  customerName: { fontSize: 13, color: colors.inkSoft, marginTop: 3 },
  invoiceMeta: { fontSize: 12, color: colors.muted, marginTop: 2 },

  amountColumn: { alignItems: "flex-end" },
  amount: { fontSize: 15, fontWeight: "700", color: colors.ink },

  summaryFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.md,
    paddingHorizontal: 4,
  },
  summaryText: { fontSize: 12, color: colors.muted },
  summaryTotal: { fontSize: 12, color: colors.muted, fontWeight: "600" },

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
