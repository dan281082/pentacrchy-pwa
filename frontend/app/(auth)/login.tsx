import { useRouter } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AuthError } from "@/src/api/auth";
import { Button } from "@/src/components/ui/Button";
import { TextField } from "@/src/components/ui/TextField";
import { useAuth } from "@/src/context/auth";
import { env } from "@/src/config/env";
import { colors, radius, spacing, fontSize, fontWeight } from "@/src/theme";

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setSubmitting(true);
    try {
      await login(email, password);
      // Route guards take over once status updates.
    } catch (e) {
      setError(e instanceof AuthError ? e.message : "Unable to sign in. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container} testID="login-screen">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + spacing["2xl"], paddingBottom: insets.bottom + spacing.xl },
          ]}
        >
          <View style={styles.brand}>
            <Text style={styles.wordmark}>PENTARCHY</Text>
            <View style={styles.dot} />
          </View>
          <Text style={styles.title}>Members sign in</Text>
          <Text style={styles.subtitle}>
            Private storefront for the group-buy community. Sign in to view available vials.
          </Text>

          <View style={styles.form}>
            <TextField
              label="Email"
              testID="login-email"
              icon="mail-outline"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
            />
            <TextField
              label="Password"
              testID="login-password"
              icon="lock-closed-outline"
              value={password}
              onChangeText={setPassword}
              placeholder="Your password"
              secureTextEntry
              autoCapitalize="none"
            />

            {!!error && (
              <Text style={styles.error} testID="login-error">
                {error}
              </Text>
            )}

            <Button
              title="Sign in"
              onPress={onSubmit}
              loading={submitting}
              testID="login-submit"
            />
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>New to the community?</Text>
            <Pressable testID="go-register" onPress={() => router.push("/(auth)/register")} hitSlop={8}>
              <Text style={styles.link}>Create an account</Text>
            </Pressable>
          </View>

          <Text style={styles.note}>
            Accounts are for approved members of the {env.appName} group-buy community only.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  brand: { flexDirection: "row", alignItems: "flex-start", marginBottom: spacing.sm },
  wordmark: { color: colors.onSurface, fontSize: 34, fontWeight: fontWeight.medium, letterSpacing: 4 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.brandPrimary, marginTop: 8, marginLeft: 3 },
  title: { color: colors.onSurface, fontSize: fontSize["2xl"], fontWeight: fontWeight.medium },
  subtitle: { color: colors.onSurfaceTertiary, fontSize: fontSize.base, lineHeight: 21 },
  form: { gap: spacing.lg, marginTop: spacing.lg },
  error: { color: colors.error, fontSize: fontSize.base },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, marginTop: spacing.xl },
  footerText: { color: colors.onSurfaceTertiary, fontSize: fontSize.base },
  link: { color: colors.brandSecondary, fontSize: fontSize.base, fontWeight: fontWeight.medium },
  note: {
    color: colors.onSurfaceTertiary, fontSize: fontSize.sm, textAlign: "center",
    lineHeight: 18, marginTop: spacing.xl, paddingHorizontal: spacing.md,
  },
});
