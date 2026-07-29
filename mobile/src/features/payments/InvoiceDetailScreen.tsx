import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import {
  useGetInvoice,
  useMarkInvoicePaid,
  useSendInvoice,
  useVoidInvoice,
} from "@examify-tms/shared";
import { colors, spacing } from "@/lib/theme";
import {
  INVOICE_STATUS_META,
  PAYMENT_METHOD_LABELS,
  compactCurrency,
  formatCurrencyFull,
  formatDate,
} from "@/lib/format";

export default function InvoiceDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: invoice, isLoading, isFetching, refetch } = useGetInvoice(id);

  const markPaid = useMarkInvoicePaid();
  const voidInvoice = useVoidInvoice();
  const sendInvoice = useSendInvoice();
  const [actionError, setActionError] = useState<string | null>(null);

  const busy =
    markPaid.isPending || voidInvoice.isPending || sendInvoice.isPending;

  function handleMarkPaid() {
    if (!invoice) return;
    setActionError(null);
    markPaid.mutate(
      { id: invoice.id },
      {
        onError: (e) =>
          setActionError(e instanceof Error ? e.message : "Failed to mark as paid"),
      },
    );
  }

  function handleVoid() {
    if (!invoice) return;
    setActionError(null);
    Alert.alert(
      "Void invoice?",
      `This will cancel ${invoice.invoiceNumber}. This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Void",
          style: "destructive",
          onPress: () =>
            voidInvoice.mutate(invoice.id, {
              onError: (e) =>
                setActionError(e instanceof Error ? e.message : "Failed to void invoice"),
            }),
        },
      ],
    );
  }

  function handleSend() {
    if (!invoice) return;
    setActionError(null);
    sendInvoice.mutate(
      { id: invoice.id },
      {
        onError: (e) =>
          setActionError(e instanceof Error ? e.message : "Failed to send invoice"),
      },
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <NavBar onBack={() => router.back()} title="Invoice" />
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!invoice) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <NavBar onBack={() => router.back()} title="Invoice" />
        <View style={styles.loading}>
          <Text style={styles.muted}>Failed to load invoice.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const meta = INVOICE_STATUS_META[invoice.status];
  const hasBeenSent = invoice.sentAt !== null && invoice.sentAt !== undefined;
  const canSend = invoice.status !== "paid" && invoice.status !== "void";
  const canMarkPaid = invoice.status === "open" || invoice.status === "overdue";
  const canVoid = invoice.status !== "paid" && invoice.status !== "void";

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <NavBar onBack={() => router.back()} title={invoice.invoiceNumber} />
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading}
            onRefresh={() => refetch()}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={styles.scroll}
      >
        {/* Header card */}
        <View style={styles.headerCard}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.invoiceNumber}>{invoice.invoiceNumber}</Text>
              <Pressable
                onPress={() => router.push(`/students/${invoice.studentId}`)}
              >
                <Text style={styles.customerLink} numberOfLines={1}>
                  {invoice.customerName}
                </Text>
              </Pressable>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
              <Text style={[styles.statusText, { color: meta.text }]}>
                {meta.label}
              </Text>
            </View>
          </View>

          <View style={styles.totalBlock}>
            <Text style={styles.totalLabel}>Amount due</Text>
            <Text style={styles.totalValue}>
              {formatCurrencyFull(invoice.total, invoice.currency)}
            </Text>
          </View>
        </View>

        {actionError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{actionError}</Text>
          </View>
        ) : null}

        {/* Details grid */}
        <View style={styles.card}>
          <DetailRow label="Issue date" value={formatDate(invoice.issueDate)} />
          <DetailRow
            label="Due date"
            value={formatDate(invoice.dueDate)}
            tone={invoice.status === "overdue" ? "danger" : undefined}
          />
          {invoice.paidAt ? (
            <DetailRow
              label="Paid on"
              value={formatDate(invoice.paidAt)}
              tone="success"
            />
          ) : null}
          <DetailRow
            label="Email"
            value={hasBeenSent ? `Sent ${formatDate(invoice.sentAt!)}` : "Not sent yet"}
            tone={hasBeenSent ? undefined : "muted"}
          />
          <DetailRow
            label="Payment method"
            value={PAYMENT_METHOD_LABELS[invoice.paymentMethod]}
            last
          />
        </View>

        {/* Bill to */}
        <Text style={styles.sectionTitle}>Bill to</Text>
        <View style={styles.card}>
          <Pressable
            onPress={() => router.push(`/students/${invoice.studentId}`)}
          >
            <Text style={styles.customerLink}>{invoice.customerName}</Text>
          </Pressable>
          {invoice.billingEmail ? (
            <Pressable
              onPress={() => Linking.openURL(`mailto:${invoice.billingEmail}`)}
            >
              <Text style={styles.contactLink} numberOfLines={1}>
                {invoice.billingEmail}
              </Text>
            </Pressable>
          ) : null}
        </View>

        {/* Line items */}
        <Text style={styles.sectionTitle}>Items</Text>
        <View style={styles.card}>
          {invoice.lineItems.map((li, idx) => (
            <View
              key={idx}
              style={[
                styles.lineItem,
                idx < invoice.lineItems.length - 1 && styles.lineItemBorder,
              ]}
            >
              <View style={{ flexShrink: 1 }}>
                <Text style={styles.lineDescription}>{li.description}</Text>
                <Text style={styles.lineMeta}>
                  {li.rateType === "hourly" ? "Hourly" : "Per lesson"} ·{" "}
                  {li.quantity} × {compactCurrency(li.unitAmount, invoice.currency)}
                </Text>
              </View>
              <Text style={styles.lineAmount}>
                {formatCurrencyFull(li.amount, invoice.currency)}
              </Text>
            </View>
          ))}

          <View style={styles.totalsBlock}>
            <View style={styles.totalRow}>
              <Text style={styles.totalRowLabel}>Subtotal</Text>
              <Text style={styles.totalRowValue}>
                {formatCurrencyFull(invoice.subtotal, invoice.currency)}
              </Text>
            </View>
            <View style={[styles.totalRow, styles.totalRowFinal]}>
              <Text style={styles.totalRowFinalLabel}>Total</Text>
              <Text style={styles.totalRowFinalValue}>
                {formatCurrencyFull(invoice.total, invoice.currency)}
              </Text>
            </View>
          </View>
        </View>

        {invoice.notes ? (
          <>
            <Text style={styles.sectionTitle}>Notes</Text>
            <View style={styles.card}>
              <Text style={styles.notesText}>{invoice.notes}</Text>
            </View>
          </>
        ) : null}

        {/* Actions */}
        <View style={styles.actions}>
          {canSend ? (
            <ActionButton
              label={hasBeenSent ? "Resend invoice" : "Send invoice"}
              icon="paper-plane-outline"
              loading={sendInvoice.isPending}
              disabled={busy}
              onPress={handleSend}
              variant="primary"
            />
          ) : null}
          {canMarkPaid ? (
            <ActionButton
              label="Mark as paid"
              icon="cash-outline"
              loading={markPaid.isPending}
              disabled={busy}
              onPress={handleMarkPaid}
              variant="success"
            />
          ) : null}
          {canVoid ? (
            <ActionButton
              label="Void invoice"
              icon="ban-outline"
              loading={voidInvoice.isPending}
              disabled={busy}
              onPress={handleVoid}
              variant="danger"
            />
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* --------------------------------- NavBar -------------------------------- */

function NavBar({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={styles.navBar}>
      <Pressable
        onPress={onBack}
        style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.6 }]}
      >
        <Ionicons name="chevron-back" size={22} color={colors.primary} />
      </Pressable>
      <Text style={styles.navTitle} numberOfLines={1}>
        {title}
      </Text>
    </View>
  );
}

function DetailRow({
  label,
  value,
  tone,
  last,
}: {
  label: string;
  value: string;
  tone?: "danger" | "success" | "muted";
  last?: boolean;
}) {
  const color =
    tone === "danger"
      ? colors.danger
      : tone === "success"
        ? colors.success
        : tone === "muted"
          ? colors.muted
          : colors.ink;
  return (
    <View style={[styles.detailRow, last && { borderBottomWidth: 0 }]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, { color }]}>{value}</Text>
    </View>
  );
}

function ActionButton({
  label,
  icon,
  onPress,
  loading,
  disabled,
  variant,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  loading: boolean;
  disabled: boolean;
  variant: "primary" | "success" | "danger";
}) {
  const palette = {
    primary: { bg: colors.primary, text: "#fff" },
    success: { bg: colors.successTint, text: colors.success },
    danger: { bg: colors.dangerTint, text: colors.danger },
  }[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.actionButton,
        { backgroundColor: palette.bg },
        (disabled || pressed) && { opacity: 0.6 },
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={palette.text} />
      ) : (
        <Ionicons name={icon} size={17} color={palette.text} />
      )}
      <Text style={[styles.actionText, { color: palette.text }]}>{label}</Text>
    </Pressable>
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

  scroll: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },

  headerCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    marginBottom: spacing.md,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  invoiceNumber: { fontSize: 20, fontWeight: "700", color: colors.ink, letterSpacing: -0.3 },
  customerLink: { fontSize: 14, color: colors.primary, marginTop: 3, fontWeight: "500" },

  statusBadge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 7 },
  statusText: { fontSize: 11, fontWeight: "700" },

  totalBlock: {
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  totalLabel: { fontSize: 12, color: colors.muted, fontWeight: "500", textTransform: "uppercase", letterSpacing: 0.4 },
  totalValue: { fontSize: 30, fontWeight: "700", color: colors.ink, marginTop: 4, letterSpacing: -0.5 },

  errorBox: {
    backgroundColor: colors.dangerTint,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: spacing.md,
  },
  errorText: { color: colors.danger, fontSize: 13, fontWeight: "600" },

  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },

  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  detailLabel: { fontSize: 14, color: colors.muted },
  detailValue: { fontSize: 14, fontWeight: "600" },

  contactLink: { fontSize: 13, color: colors.primary, marginTop: 6 },

  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.inkSoft,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    marginLeft: 2,
  },

  lineItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 12,
  },
  lineItemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  lineDescription: { fontSize: 14, fontWeight: "500", color: colors.ink },
  lineMeta: { fontSize: 12, color: colors.muted, marginTop: 3 },
  lineAmount: { fontSize: 14, fontWeight: "700", color: colors.ink },

  totalsBlock: {
    marginTop: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  totalRowLabel: { fontSize: 14, color: colors.muted },
  totalRowValue: { fontSize: 14, fontWeight: "600", color: colors.ink },
  totalRowFinal: { paddingTop: 10, marginTop: 4 },
  totalRowFinalLabel: { fontSize: 16, fontWeight: "700", color: colors.ink },
  totalRowFinalValue: { fontSize: 16, fontWeight: "700", color: colors.ink },

  notesText: { fontSize: 14, color: colors.inkSoft, lineHeight: 20 },

  actions: { gap: spacing.sm, marginTop: spacing.lg },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  actionText: { fontSize: 15, fontWeight: "600" },
});
