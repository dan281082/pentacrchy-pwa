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
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AuthError } from "@/src/api/auth";
import { Button } from "@/src/components/ui/Button";
import { TextField } from "@/src/components/ui/TextField";
import { TopBar } from "@/src/components/ui/TopBar";
import { useAuth } from "@/src/context/auth";
import { normalizeTelegram } from "@/src/utils/telegram";
import { colors, radius, spacing, fontSize, fontWeight } from "@/src/theme";

export default function RegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { register } = useAuth();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [telegram, setTelegram] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!firstName.trim()) next.firstName = "Enter your first name.";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) next.email = "Enter a valid email.";
    const tg = normalizeTelegram(telegram);
    if (!tg.ok) next.telegram = tg.error ?? "Invalid Telegram username.";
    if (password.length < 8) next.password = "At least 8 characters.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = async () => {
    setFormError(null);
    if (!validate()) return;
    setSubmitting(true);
    try {
      await register({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        password,
        telegramUsername: telegram.trim(),
      });
      // Route guards take over once status updates.
    } catch (e) {
      setFormError(e instanceof AuthError ? e.message : "Unable to create your account. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container} testID="register-screen">
      <TopBar title="Create account" showBack showBasket={false} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
        >
          <Text style={styles.subtitle}>
            Join the community storefront. Your Telegram username links you to the group-buy members list.
          </Text>

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <TextField
                label="First name"
                testID="register-first-name"
                value={firstName}
                onChangeText={setFirstName}
                placeholder="First"
                autoCapitalize="words"
                error={errors.firstName}
              />
            </View>
            <View style={{ flex: 1 }}>
              <TextField
                label="Last name"
                testID="register-last-name"
                value={lastName}
                onChangeText={setLastName}
                placeholder="Last"
                autoCapitalize="words"
              />
            </View>
          </View>

          <TextField
            label="Email"
            testID="register-email"
            icon="mail-outline"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            error={errors.email}
          />

          <TextField
            label="Telegram username"
            testID="register-telegram"
            prefix="@"
            value={telegram}
            onChangeText={setTelegram}
            placeholder="your_telegram"
            autoCapitalize="none"
            autoCorrect={false}
            error={errors.telegram}
          />
          <View style={styles.hintRow}>
            <Ionicons name="paper-plane-outline" size={14} color={colors.onSurfaceTertiary} />
            <Text style={styles.hint}>Required — must match your Telegram handle in the group.</Text>
          </View>

          <TextField
            label="Password"
            testID="register-password"
            icon="lock-closed-outline"
            value={password}
            onChangeText={setPassword}
            placeholder="At least 8 characters"
            secureTextEntry
            autoCapitalize="none"
            error={errors.password}
          />

          {!!formError && (
            <Text style={styles.error} testID="register-error">
              {formError}
            </Text>
          )}

          <Button
            title="Create account"
            onPress={onSubmit}
            loading={submitting}
            style={{ marginTop: spacing.sm }}
            testID="register-submit"
          />

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already a member?</Text>
            <Pressable testID="go-login" onPress={() => router.back()} hitSlop={8}>
              <Text style={styles.link}>Sign in</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: spacing.lg },
  subtitle: { color: colors.onSurfaceTertiary, fontSize: fontSize.base, lineHeight: 21 },
  row: { flexDirection: "row", gap: spacing.md },
  hintRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: -spacing.sm },
  hint: { color: colors.onSurfaceTertiary, fontSize: fontSize.sm },
  error: { color: colors.error, fontSize: fontSize.base },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, marginTop: spacing.lg },
  footerText: { color: colors.onSurfaceTertiary, fontSize: fontSize.base },
  link: { color: colors.brandSecondary, fontSize: fontSize.base, fontWeight: fontWeight.medium },
});
