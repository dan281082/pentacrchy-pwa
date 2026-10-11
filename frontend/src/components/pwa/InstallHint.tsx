// "Install Pentarchy Vial" hint — web only, hidden when already installed
// (standalone) or dismissed. Android/desktop Chrome: native install prompt.
// iOS Safari: Share → Add to Home Screen instructions (no prompt API exists).

import { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { storage } from "@/src/utils/storage";
import { colors, radius, spacing, fontSize, fontWeight } from "@/src/theme";

const KEY = "pentarchy.installHint.dismissed";

export function InstallHint() {
  const [visible, setVisible] = useState(false);
  const [prompt, setPrompt] = useState<any>(null);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches || (window.navigator as any).standalone === true;
    if (standalone) return;
    const ua = window.navigator.userAgent;
    const isIos = /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && "ontouchend" in document);
    setIos(isIos);
    const onPrompt = (e: any) => { e.preventDefault(); setPrompt(e); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    storage.getItem(KEY, false).then((d) => { if (!d && (isIos || /Android/.test(ua))) setVisible(true); });
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!visible) return null;

  const dismiss = () => { setVisible(false); storage.setItem(KEY, true); };
  const install = async () => {
    if (!prompt) return;
    prompt.prompt();
    const res = await prompt.userChoice.catch(() => null);
    if (res?.outcome === "accepted") dismiss();
  };

  return (
    <View style={styles.card} testID="install-hint">
      <View style={styles.icon}><Ionicons name="download-outline" size={20} color={colors.brandSecondary} /></View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.title}>Install Pentarchy Vial</Text>
        <Text style={styles.body}>
          {ios
            ? "Tap the Share button in Safari, then “Add to Home Screen”."
            : prompt
              ? "Add the app to your home screen for quick access."
              : "Open the browser menu (⋮) and choose “Install app” or “Add to Home screen”."}
        </Text>
        {!ios && !!prompt && (
          <Pressable onPress={install} style={styles.btn} accessibilityRole="button" testID="install-hint-button">
            <Text style={styles.btnText}>Install</Text>
          </Pressable>
        )}
      </View>
      <Pressable onPress={dismiss} hitSlop={10} style={styles.close} accessibilityLabel="Dismiss install hint" testID="install-hint-dismiss">
        <Ionicons name="close" size={18} color={colors.onSurfaceTertiary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", gap: spacing.md, marginHorizontal: spacing.lg, padding: spacing.lg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.brandTertiary, backgroundColor: colors.surfaceSecondary },
  icon: { width: 40, height: 40, borderRadius: radius.sm, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  title: { color: colors.onSurface, fontSize: fontSize.base, fontWeight: fontWeight.medium },
  body: { color: colors.onSurfaceSecondary, fontSize: fontSize.sm, lineHeight: 18 },
  btn: { alignSelf: "flex-start", marginTop: spacing.sm, minHeight: 36, paddingHorizontal: spacing.lg, borderRadius: radius.sm, backgroundColor: colors.brandPrimary, justifyContent: "center" },
  btnText: { color: colors.onBrandPrimary, fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  close: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
});
