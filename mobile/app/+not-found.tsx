import { Link } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Box, Text, Button } from "@/components/ui";

export default function NotFoundScreen() {
  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-white p-6 dark:bg-gray-950">
      <Box className="items-center">
        <Text variant="h1">Not found</Text>
        <Text variant="muted" className="mt-2 mb-6 text-center">
          This screen doesn't exist.
        </Text>
        <Link href="/" asChild>
          <Button>Go home</Button>
        </Link>
      </Box>
    </SafeAreaView>
  );
}
