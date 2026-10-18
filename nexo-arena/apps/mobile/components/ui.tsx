import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import Svg, { Circle, Path, G, Rect } from "react-native-svg";
import { useArena } from "../lib/arena-provider";
export function Copy({
  children,
  kind = "body",
  color,
  style,
}: {
  children: React.ReactNode;
  kind?: "body" | "title" | "hero" | "label" | "small";
  color?: string;
  style?: StyleProp<import("react-native").TextStyle>;
}) {
  const { colors } = useArena();
  return (
    <Text
      style={[
        {
          color: color ?? colors.text,
          fontFamily:
            kind === "title" || kind === "hero" ? "SpaceGrotesk" : "Manrope",
          fontSize: { body: 15, title: 28, hero: 44, label: 11, small: 12 }[
            kind
          ],
          lineHeight: { body: 23, title: 34, hero: 50, label: 17, small: 19 }[
            kind
          ],
        },
        kind === "label" && { letterSpacing: 1.8, fontWeight: "700" },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
export function Screen({
  children,
  scroll = true,
}: {
  children: React.ReactNode;
  scroll?: boolean;
}) {
  const { colors, storageError } = useArena();
  const insets = useSafeAreaInsets();
  const content = (
    <View style={styles.content}>
      {storageError && (
        <Copy color={colors.violet} kind="small">
          {storageError}
        </Copy>
      )}
      {children}
    </View>
  );
  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      {scroll ? (
        <ScrollView
          contentContainerStyle={{
            paddingBottom: Math.max(32, insets.bottom + 16),
          }}
          keyboardShouldPersistTaps="handled"
        >
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}
export function Button({
  children,
  onPress,
  secondary = false,
  disabled = false,
  label,
  style,
}: {
  children: React.ReactNode;
  onPress(): void;
  secondary?: boolean;
  disabled?: boolean;
  label?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useArena();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        {
          minHeight: 52,
          borderRadius: 16,
          paddingHorizontal: 20,
          paddingVertical: 14,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: secondary ? colors.raised : colors.primary,
          opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
        },
        style,
      ]}
    >
      <Copy
        color={secondary ? colors.text : "#ffffff"}
        style={{ fontWeight: "700" }}
      >
        {children}
      </Copy>
    </Pressable>
  );
}
export function Panel({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useArena();
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: 1,
          padding: 20,
          borderRadius: 24,
          gap: 16,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
export function MarkIcon({
  mark = "X",
  size = 32,
  color,
}: {
  mark?: "X" | "O";
  size?: number;
  color?: string;
}) {
  const { colors } = useArena();
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {mark === "X" ? (
        <Path
          d="M25 25L75 75M75 25L25 75"
          stroke={color ?? colors.blue}
          strokeWidth={10}
          strokeLinecap="round"
        />
      ) : (
        <Circle
          cx={50}
          cy={50}
          r={30}
          stroke={color ?? colors.violet}
          strokeWidth={10}
          fill="none"
        />
      )}
    </Svg>
  );
}
export function BrandLogo({ size = 32 }: { size?: number }) {
  const { colors } = useArena();
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      accessibilityElementsHidden
    >
      <G transform="translate(128 126) skewY(-12)">
        <Rect width={64} height={256} rx={6} fill={colors.blue} />
        <Rect
          x={96}
          y={51}
          width={64}
          height={154}
          rx={6}
          fill={colors.violet}
        />
        <Rect x={192} width={64} height={256} rx={6} fill={colors.text} />
      </G>
    </Svg>
  );
}
export function Brand() {
  const { colors } = useArena();
  const { width } = useWindowDimensions();
  return (
    <View
      style={[
        styles.row,
        { justifyContent: "space-between", marginBottom: 20 },
      ]}
    >
      <View style={styles.row}>
        <View
          style={{
            backgroundColor: colors.raised,
            padding: 5,
            borderRadius: 12,
          }}
        >
          <BrandLogo size={30} />
        </View>
        <Copy style={{ fontWeight: "800", letterSpacing: 2 }}>
          NEXO <Copy color={colors.muted}>ARENA</Copy>
        </Copy>
      </View>
      {width >= 360 && (
        <Copy kind="label" color={colors.cyan}>
          PLAY. CONNECT.
        </Copy>
      )}
    </View>
  );
}
export function Options<T extends string>({
  label,
  values,
  value,
  onChange,
}: {
  label: string;
  values: readonly T[];
  value: T;
  onChange(value: T): void;
}) {
  const { colors } = useArena();
  return (
    <View style={{ gap: 8 }}>
      <Copy kind="label" color={colors.muted}>
        {label}
      </Copy>
      <View style={[styles.row, { gap: 6 }]}>
        {values.map((item) => (
          <Pressable
            key={item}
            accessibilityRole="radio"
            accessibilityLabel={`${label}: ${item}`}
            accessibilityState={{ selected: item === value }}
            onPress={() => onChange(item)}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: 48,
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: item === value ? colors.primary : colors.raised,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Copy
              color={item === value ? "#fff" : colors.muted}
              style={{ textTransform: "capitalize", fontSize: 13 }}
            >
              {item}
            </Copy>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
export const styles = StyleSheet.create({
  content: {
    width: "100%",
    maxWidth: 680,
    alignSelf: "center",
    padding: 24,
    gap: 20,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
});
