// Account → "Stock alerts": two independent opt-ins (new vial / back in stock).
// Permission is only requested when the member switches an alert on.

import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { colors, radius, spacing, fontSize, fontWeight } from "@/src/theme";
import { getPushStatus, pushSupport, savePrefs, sendTestAlert, type AlertPrefs, type PushStatus } from "@/src/utils/web-push";

const ROWS: { key: keyof AlertPrefs; title: string; sub: string }[] = [
  { key: "new_vial", title: "New product added", sub: "When a new members-only product is published" },
  { key: "back_in_stock", title: "Back in stock", sub: "When a sold-out product becomes available again" },
];

export function StockAlerts() {
  const [support, setSupport] = useState(pushSupport());
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (support === "ok" || support === "denied") getPushStatus().then(setStatus).catch(() => setMsg("Couldn't load alert settings."));
  }, [support]);

  if (Platform.OS !== "web") return null;

  const toggle = async (key: keyof AlertPrefs, value: boolean) => {
    if (!status) return;
    setBusy(key);
    setMsg(null);
    try {
      setStatus(await savePrefs({ ...status.prefs, [key]: value }, status));
    } catch (e: any) {
      if (e?.message === "denied") { setSupport("denied"); }
      else setMsg(e?.message === "dismissed" ? "Allow notifications to turn on alerts." : e?.message ?? "Couldn't update alerts.");
    } finally {
      setBusy(null);
    }
  };

  const test = async () => {
    setBusy("test");
    setMsg(null);
    try {
      const r = await sendTestAlert();
      setMsg(r.sent > 0 ? "Test alert sent — check your notifications." : "Couldn't deliver a test alert to this device.");
    } catch (e: any) {
      setMsg(e?.message ?? "Couldn't send a test alert.");
    } finally {
      setBusy(null);
    }
  };

  let body: React.ReactNode;
  if (support === "needs_install") {
    body = <Info icon="phone-portrait-outline" text="To get stock alerts on iPhone, add Pentarchy to your Home Screen (Share → Add to Home Screen), then open it from the icon." />;
  } else if (support === "unsupported") {
    body = <Info icon="alert-circle-outline" text="This browser doesn't support notifications. Try Chrome on Android, or the installed app on iPhone." />;
  } else if (support === "denied") {
    body = <Info icon="notifications-off-outline" text="Notifications are blocked for Pentarchy. Allow them in your phone or browser settings (Site settings → Notifications), then reopen the app." />;
  } else if (!status) {
    body = <ActivityIndicator color={colors.brandPrimary} />;
  } else if (!status.available) {
    body = <Info icon="alert-circle-outline" text="Stock alerts aren't available right now." />;
  } else {
    const anyOn = status.thisDevice && (status.prefs.new_vial || status.prefs.back_in_stock);
    body = (
      <>
        <Text style={styles.lead}>Get a notification on this device when products become available. You can turn each alert off at any time.</Text>
        {ROWS.map((r) => (
          <View key={r.key} style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{r.title}</Text>
              <Text style={styles.sub}>{r.sub}</Text>
            </View>
            {busy === r.key ? (
              <ActivityIndicator color={colors.brandPrimary} />
            ) : (
              <Switch
                value={status.thisDevice && status.prefs[r.key]}
                onValueChange={(v) => toggle(r.key, v)}
                trackColor={{ true: colors.brandPrimary, false: colors.surfaceTertiary }}
                testID={`alert-toggle-${r.key}`}
              />
            )}
          </View>
        ))}
        {anyOn && (
          <Pressable onPress={test} style={styles.test} disabled={busy === "test"} testID="alert-test-button">
            <Text style={styles.testText}>{busy === "test" ? "Sending…" : "Send a test alert"}</Text>
          </Pressable>
        )}
      </>
    );
  }

  return (
    <View testID="stock-alerts">
      <Text style={styles.section}>Stock alerts</Text>
      <View style={styles.card}>
        {body}
        {!!msg && <Text style={styles.msg} testID="alert-message">{msg}</Text>}
      </View>
    </View>
  );
}

function Info({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.info}>
      <Ionicons name={icon} size={18} color={colors.onSurfaceTertiary} />
      <Text style={styles.infoText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { color: colors.onSurfaceTertiary, fontSize: fontSize.sm, fontWeight: fontWeight.medium, letterSpacing: 1, textTransform: "uppercase", marginBottom: spacing.sm, marginLeft: spacing.xs },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.md },
  lead: { color: colors.onSurfaceSecondary, fontSize: fontSize.sm, lineHeight: 18 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 48 },
  title: { color: colors.onSurface, fontSize: fontSize.base, fontWeight: fontWeight.medium },
  sub: { color: colors.onSurfaceTertiary, fontSize: fontSize.sm, marginTop: 2 },
  test: { alignSelf: "flex-start", minHeight: 40, justifyContent: "center", paddingHorizontal: spacing.md, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border },
  testText: { color: colors.onSurface, fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  info: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  infoText: { flex: 1, color: colors.onSurfaceSecondary, fontSize: fontSize.sm, lineHeight: 18 },
  msg: { color: colors.onSurfaceSecondary, fontSize: fontSize.sm },
});
