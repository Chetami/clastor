import { useEffect, useState } from "react";
import { Switch, View } from "react-native";
import { router } from "expo-router";
import { Screen } from "@/components/screen";
import { Box, Card, Text, Button } from "@/components/ui";
import { useAuthStore } from "@examify-tms/shared";
import { useLogout } from "@/features/auth/hooks";
import { useTheme, type ThemePreference } from "@/hooks/use-theme";
import {
  useBiometricAuth,
  isBiometricEnabled,
  setBiometricEnabled,
} from "@/hooks/use-biometric-auth";

const THEME_OPTIONS: { label: string; value: ThemePreference }[] = [
  { label: "Light", value: "light" },
  { label: "Dark", value: "dark" },
  { label: "System", value: "system" },
];

export default function SettingsScreen() {
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();
  const { preference, setPreference } = useTheme();
  const { isAvailable, biometricLabel } = useBiometricAuth();

  const [biometricOn, setBiometricOn] = useState(false);

  useEffect(() => {
    isBiometricEnabled().then(setBiometricOn);
  }, []);

  async function toggleBiometric(value: boolean) {
    if (value) {
      setBiometricOn(true);
      await setBiometricEnabled(true);
    } else {
      setBiometricOn(false);
      await setBiometricEnabled(false);
    }
  }

  return (
    <Screen title="Settings">
      <Card className="mb-4 flex-row items-center">
        <Box className="mr-4 h-14 w-14 items-center justify-center rounded-full bg-brand">
          <Text className="text-xl font-semibold text-white">
            {user?.name?.charAt(0).toUpperCase() ?? "?"}
          </Text>
        </Box>
        <Box className="flex-1">
          <Text className="text-lg font-semibold">{user?.name}</Text>
          <Text variant="muted">{user?.email}</Text>
        </Box>
      </Card>

      {/* ── Appearance ─────────────────────────────────────────────── */}
      <Text variant="label" className="mb-2 ml-1">Appearance</Text>
      <Card className="mb-4">
        {THEME_OPTIONS.map((opt) => (
          <View
            key={opt.value}
            className="flex-row items-center justify-between py-2"
          >
            <Text>{opt.label}</Text>
            <ThemeRadio
              selected={preference === opt.value}
              onPress={() => setPreference(opt.value)}
            />
          </View>
        ))}
      </Card>

      {/* ── Security ───────────────────────────────────────────────── */}
      <Text variant="label" className="mb-2 ml-1">Security</Text>
      <Card className="mb-4 flex-row items-center justify-between">
        <Box className="flex-1">
          <Text>{biometricLabel} lock</Text>
          <Text variant="muted" className="text-xs">
            Require {biometricLabel} when returning to the app
          </Text>
        </Box>
        <Switch
          value={biometricOn}
          disabled={!isAvailable}
          onValueChange={toggleBiometric}
        />
      </Card>
      {!isAvailable && (
        <Text className="mb-4 ml-1 text-xs text-amber-600">
          {biometricLabel} isn't available on this device.
        </Text>
      )}

      {/* ── Account ────────────────────────────────────────────────── */}
      <Text variant="label" className="mb-2 ml-1">Account</Text>
      <Card className="mb-4">
        <Row label="Role" value={user?.role === "tutor" ? "Tutor" : user?.role} />
        <Row label="Currency" value={user?.currency ?? "AUD"} />
        {user?.timezone && <Row label="Timezone" value={user.timezone} />}
      </Card>

      <Button
        variant="destructive"
        loading={logout.isPending}
        onPress={async () => {
          await logout.mutateAsync();
          router.replace("/login");
        }}
      >
        Sign out
      </Button>

      <Text className="mt-6 text-center text-xs text-gray-400">
        Examify TMS — v1.0.0
      </Text>
    </Screen>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <Box className="flex-row items-center justify-between py-2">
      <Text variant="muted">{label}</Text>
      <Text className="font-medium">{value ?? "—"}</Text>
    </Box>
  );
}

function ThemeRadio({
  selected,
  onPress,
}: {
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <View
      className={`h-6 w-6 items-center justify-center rounded-full border-2 ${
        selected ? "border-brand bg-brand" : "border-gray-300"
      }`}
      onTouchEnd={onPress}
    >
      {selected && <View className="h-2.5 w-2.5 rounded-full bg-white" />}
    </View>
  );
}
