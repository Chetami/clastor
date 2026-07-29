import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "@examify-tms/shared";
import { useLogout } from "@/features/auth/hooks";
import { colors, spacing } from "@/lib/theme";

export default function SettingsScreen() {
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={26} color={colors.primary} />
          </View>
          <View style={{ flexShrink: 1 }}>
            <Text style={styles.name}>{user?.name || "Signed in"}</Text>
            {user?.email ? (
              <Text style={styles.email} numberOfLines={1}>
                {user.email}
              </Text>
            ) : null}
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.button,
            (logout.isPending || pressed) && styles.buttonPressed,
          ]}
          onPress={() => logout.mutate()}
          disabled={logout.isPending}
        >
          <Ionicons name="log-out-outline" size={18} color={colors.danger} />
          <Text style={styles.buttonText}>
            {logout.isPending ? "Signing out…" : "Sign out"}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceAlt },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: { fontSize: 22, fontWeight: "700", color: colors.ink, letterSpacing: -0.3 },

  content: { padding: spacing.lg },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    marginBottom: spacing.lg,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryTint,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { fontSize: 17, fontWeight: "700", color: colors.ink },
  email: { fontSize: 14, color: colors.muted, marginTop: 3 },

  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.dangerTint,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#fecaca",
    borderRadius: 12,
    paddingVertical: 14,
  },
  buttonPressed: { opacity: 0.6 },
  buttonText: { color: colors.danger, fontSize: 15, fontWeight: "600" },
});
