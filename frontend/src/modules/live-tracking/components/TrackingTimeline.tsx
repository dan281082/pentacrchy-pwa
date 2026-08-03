import { StyleSheet, Text, View } from "react-native";

import type { TrackingEvent } from "../types";
import { colors, spacing, fontSize, fontWeight, radius } from "@/src/theme";

// Renders courier events in order. Shows nothing (empty copy) when there are no
// real events — never fabricates a timeline.
export function TrackingTimeline({ events }: { events: TrackingEvent[] }) {
  if (events.length === 0) {
    return (
      <Text style={styles.none} testID="tracking-timeline-empty">
        No tracking updates yet. We’ll show them here as the courier provides them.
      </Text>
    );
  }
  return (
    <View style={styles.wrap} testID="tracking-timeline">
      {events.map((e, i) => (
        <View key={e.id} style={styles.item}>
          <View style={styles.rail}>
            <View style={[styles.dot, i === 0 && styles.dotActive]} />
            {i < events.length - 1 && <View style={styles.line} />}
          </View>
          <View style={styles.body}>
            <Text style={styles.status}>{e.status || e.description}</Text>
            {!!e.description && e.status ? <Text style={styles.desc}>{e.description}</Text> : null}
            <Text style={styles.meta}>
              {e.timestamp.replace("T", " ").slice(0, 16)}
              {e.location ? ` · ${e.location}` : ""}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  none: { color: colors.onSurfaceTertiary, fontSize: fontSize.base, padding: spacing.lg, lineHeight: 20 },
  item: { flexDirection: "row", gap: spacing.md },
  rail: { alignItems: "center", width: 16 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.borderStrong, marginTop: 4 },
  dotActive: { backgroundColor: colors.brandPrimary },
  line: { flex: 1, width: 2, backgroundColor: colors.border, marginVertical: 2 },
  body: { flex: 1, paddingBottom: spacing.lg, gap: 2 },
  status: { color: colors.onSurface, fontSize: fontSize.base, fontWeight: fontWeight.medium },
  desc: { color: colors.onSurfaceSecondary, fontSize: fontSize.sm },
  meta: { color: colors.onSurfaceTertiary, fontSize: fontSize.sm },
});
