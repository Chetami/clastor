import { Linking, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Box, Text, Button } from "@/components/ui";

export default function SetupScreen() {
  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-950">
      <ScrollView contentContainerClassName="p-6">
        <Box className="mb-6">
          <Text variant="h1">Setup needed</Text>
          <Text variant="muted" className="mt-2">
            Before the app can sign users in, add your Firebase configuration
            via environment variables.
          </Text>
        </Box>

        <Box className="mb-4">
          <Text variant="label" className="mb-2">1. Create a .env file</Text>
          <Text variant="muted">
            Copy{"\n"}
            <Text className="font-mono text-brand">mobile/.env.example</Text>
            {"\n"}to{"\n"}
            <Text className="font-mono text-brand">mobile/.env</Text>
          </Text>
        </Box>

        <Box className="mb-4">
          <Text variant="label" className="mb-2">2. Get your Firebase config</Text>
          <Text variant="muted">
            Firebase console → Project settings → Your apps → SDK setup and
            configuration. Fill in the EXPO_PUBLIC_FIREBASE_* values.
          </Text>
          <Button
            variant="secondary"
            className="mt-3"
            onPress={() => Linking.openURL("https://console.firebase.google.com")}
          >
            Open Firebase console
          </Button>
        </Box>

        <Box className="mb-4">
          <Text variant="label" className="mb-2">3. Set the backend URL</Text>
          <Text variant="muted">
            Set{"\n"}
            <Text className="font-mono text-brand">EXPO_PUBLIC_API_URL</Text>
            {"\n"}to your backend (use your LAN IP for device testing).
          </Text>
        </Box>

        <Text variant="muted" className="mt-4">
          Restart the Expo server after saving (press shift+m or re-run{" "}
          <Text className="font-mono">npm start</Text>).
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
