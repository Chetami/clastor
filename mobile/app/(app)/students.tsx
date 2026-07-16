import { Screen } from "@/components/screen";
import { Box, Card, Text, Spinner, ScreenError, Input } from "@/components/ui";
import { useState } from "react";
import { router } from "expo-router";
import { Pressable } from "react-native";
import {
  useListStudents,
  resolveSubjectNames,
  useSubjects,
} from "@examify-tms/shared";

export default function StudentsScreen() {
  const [query, setQuery] = useState("");
  const { data, isLoading, isError, error } = useListStudents();
  const subjects = useSubjects();

  if (isLoading) return <Screen title="Students"><Spinner /></Screen>;
  if (isError) return <Screen title="Students"><ScreenError message={error.message} /></Screen>;

  const students = (data ?? []).filter((s) =>
    s.name.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <Screen title="Students" subtitle={`${data?.length ?? 0} total`}>
      <Input
        className="mb-4"
        placeholder="Search students…"
        value={query}
        onChangeText={setQuery}
      />

      {students.length === 0 && (
        <Text variant="muted">No students found.</Text>
      )}

      {students.map((student) => (
        <Pressable
          key={student.id}
          onPress={() => router.push(`/student/${student.id}`)}
        >
          <Card className="mb-2 flex-row items-center">
            <Box className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-brand">
              <Text className="font-semibold text-white">
                {student.name.charAt(0).toUpperCase()}
              </Text>
            </Box>
            <Box className="flex-1">
              <Text className="font-medium">{student.name}</Text>
              <Text variant="muted" className="text-xs">
                {resolveSubjectNames(student.subjectIds, subjects) || "No subjects"}
              </Text>
            </Box>
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}
