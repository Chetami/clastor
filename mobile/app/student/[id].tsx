import { Screen } from "@/components/screen";
import { Box, Card, Text, Spinner, ScreenError } from "@/components/ui";
import { useLocalSearchParams } from "expo-router";
import {
  useGetStudent,
  useSubjects,
  resolveSubjectNames,
  useUserCurrency,
  getCurrencySymbol,
} from "@examify-tms/shared";

export default function StudentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const subjects = useSubjects();
  const currency = useUserCurrency();
  const symbol = getCurrencySymbol(currency);
  const { data: student, isLoading, isError, error } = useGetStudent(id);

  if (isLoading) return <Screen title="Student"><Spinner /></Screen>;
  if (isError) return <Screen title="Student"><ScreenError message={error.message} /></Screen>;
  if (!student) return null;

  return (
    <Screen title={student.name}>
      <Card className="mb-4 items-center">
        <Box className="mb-3 h-16 w-16 items-center justify-center rounded-full bg-brand">
          <Text className="text-2xl font-semibold text-white">
            {student.name.charAt(0).toUpperCase()}
          </Text>
        </Box>
        <Text variant="h3">{student.name}</Text>
        {student.email && <Text variant="muted">{student.email}</Text>}
        {student.phone && <Text variant="muted">{student.phone}</Text>}
      </Card>

      <Card className="mb-2">
        <Text variant="label" className="mb-1">Subjects</Text>
        <Text>{resolveSubjectNames(student.subjectIds, subjects) || "None assigned"}</Text>
      </Card>

      {student.expectedAmount != null && (
        <Card className="mb-2 flex-row items-center justify-between">
          <Text variant="muted">{student.rateType === "hourly" ? "Hourly rate" : "Rate per lesson"}</Text>
          <Text className="font-semibold">
            {symbol}{student.expectedAmount.toFixed(2)}
          </Text>
        </Card>
      )}

      {student.notes && (
        <Card className="mb-2">
          <Text variant="label" className="mb-1">Notes</Text>
          <Text>{student.notes}</Text>
        </Card>
      )}
    </Screen>
  );
}
