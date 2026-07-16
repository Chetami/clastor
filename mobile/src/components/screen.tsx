import { type ReactNode } from "react";
import { View, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text, Box } from "./ui";

/**
 * Standard screen shell with a title header, safe-area top inset, and a
 * scrollable body. Keeps every tab screen visually consistent.
 */
export function Screen({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-gray-50 dark:bg-gray-950">
      <Box
        className="flex-row items-end justify-between border-b border-gray-100 bg-white px-5 pb-3 dark:border-gray-800 dark:bg-gray-900"
        style={{ paddingTop: insets.top + 8 }}
      >
        <Box>
          <Text variant="h2">{title}</Text>
          {subtitle && <Text variant="muted" className="mt-0.5">{subtitle}</Text>}
        </Box>
        {action}
      </Box>
      <ScrollView
        contentContainerClassName="p-5"
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </View>
  );
}
