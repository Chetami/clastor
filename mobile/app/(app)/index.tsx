import { Screen } from "@/components/screen";
import { Box, Card, Text, Spinner, ScreenError } from "@/components/ui";
import {
  useDashboardSummary,
  useUserCurrency,
  getCurrencySymbol,
} from "@examify-tms/shared";

function pctChange(current: number, previous: number): string | null {
  if (!previous) return null;
  const delta = ((current - previous) / previous) * 100;
  return `${delta >= 0 ? "+" : ""}${delta.toFixed(0)}%`;
}

export default function DashboardScreen() {
  const currency = useUserCurrency();
  const symbol = getCurrencySymbol(currency);
  const { data, isLoading, isError, error } = useDashboardSummary("month");

  if (isLoading) return <Screen title="Dashboard"><Spinner /></Screen>;
  if (isError) return <Screen title="Dashboard"><ScreenError message={error.message} /></Screen>;
  if (!data) return null;

  const incomeDelta = pctChange(data.income, data.previousIncome);

  return (
    <Screen title="Dashboard" subtitle="Last 30 days">
      <Box className="mb-4">
        <Card className="bg-brand">
          <Text className="text-indigo-200">Income collected</Text>
          <Text variant="h1" className="mt-1 text-white">
            {symbol}
            {data.income.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </Text>
          {incomeDelta && (
            <Text className="mt-1 text-indigo-200">
              {incomeDelta} vs last period
            </Text>
          )}
        </Card>
      </Box>

      <Box className="flex-row gap-3">
        <Box className="flex-1">
          <Card>
            <Text variant="muted">Hours</Text>
            <Text variant="h3" className="mt-1">{data.hoursWorked.toFixed(1)}</Text>
          </Card>
        </Box>
        <Box className="flex-1">
          <Card>
            <Text variant="muted">Lessons</Text>
            <Text variant="h3" className="mt-1">{data.lessonsTaught}</Text>
          </Card>
        </Box>
        <Box className="flex-1">
          <Card>
            <Text variant="muted">Students</Text>
            <Text variant="h3" className="mt-1">{data.studentCount}</Text>
          </Card>
        </Box>
      </Box>

      <Box className="mt-4">
        <Card>
          <Box className="flex-row items-center justify-between">
            <Text variant="muted">Attendance rate</Text>
            <Text className="text-lg font-semibold">
              {data.attendanceRate != null
                ? `${(data.attendanceRate * 100).toFixed(0)}%`
                : "—"}
            </Text>
          </Box>
        </Card>
      </Box>
    </Screen>
  );
}
