import { Screen } from "@/components/screen";
import { Box, Card, Text, Spinner, ScreenError } from "@/components/ui";
import {
  useListInvoices,
  useUserCurrency,
  getCurrencySymbol,
} from "@examify-tms/shared";
import { format, parseISO } from "date-fns";

const STATUS_COLORS: Record<string, string> = {
  paid: "text-green-600",
  open: "text-amber-600",
  overdue: "text-red-600",
  void: "text-gray-400",
  draft: "text-gray-400",
};

export default function PaymentsScreen() {
  const currency = useUserCurrency();
  const symbol = getCurrencySymbol(currency);
  const { data, isLoading, isError, error } = useListInvoices();

  if (isLoading) return <Screen title="Payments"><Spinner /></Screen>;
  if (isError) return <Screen title="Payments"><ScreenError message={error.message} /></Screen>;

  const invoices = data ?? [];
  const outstanding = invoices
    .filter((i) => i.status === "open" || i.status === "overdue")
    .reduce((sum, i) => sum + i.total, 0);

  return (
    <Screen title="Payments">
      <Card className="mb-4">
        <Text variant="muted">Outstanding</Text>
        <Text variant="h2" className="mt-1 text-amber-600">
          {symbol}
          {outstanding.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </Text>
      </Card>

      <Text variant="label" className="mb-2">Invoices</Text>

      {invoices.length === 0 && <Text variant="muted">No invoices yet.</Text>}

      {invoices.map((invoice) => (
        <Card key={invoice.id} className="mb-2 flex-row items-center justify-between">
          <Box className="flex-1">
            <Text className="font-medium">{invoice.customerName}</Text>
            <Text variant="muted" className="text-xs">
              {format(parseISO(invoice.issueDate), "d MMM yyyy")}
            </Text>
          </Box>
          <Box className="items-end">
            <Text className="font-semibold">
              {symbol}{invoice.total.toFixed(2)}
            </Text>
            <Text className={`text-xs font-medium capitalize ${STATUS_COLORS[invoice.status] ?? "text-gray-400"}`}>
              {invoice.status}
            </Text>
          </Box>
        </Card>
      ))}
    </Screen>
  );
}
