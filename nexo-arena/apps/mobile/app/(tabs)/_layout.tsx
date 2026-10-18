import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Tabs } from "expo-router";
import type { ColorValue } from "react-native";
import Svg, { Path, Circle } from "react-native-svg";
import { useArena } from "../../lib/arena-provider";
function Icon({
  kind,
  color,
}: {
  kind: "arena" | "history" | "settings" | "online" | "studio";
  color: ColorValue;
}) {
  return (
    <Svg
      width={23}
      height={23}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.7}
      strokeLinecap="round"
    >
      {kind === "studio" ? (
        <Path d="M13 2L4 14h7l-1 8 10-13h-7l1-7" />
      ) : kind === "arena" ? (
        <Path d="M8 3v18M16 3v18M3 8h18M3 16h18" />
      ) : kind === "online" ? (
        <>
          <Circle cx={8} cy={8} r={3} />
          <Circle cx={17} cy={8} r={3} />
          <Path d="M2 21v-4a5 5 0 0 1 10 0v4M14 13a5 5 0 0 1 8 4v4" />
        </>
      ) : kind === "history" ? (
        <>
          <Path d="M4 5v5H0M3 9a9 9 0 1 1 0 6M12 7v5l3 2" />
        </>
      ) : (
        <>
          <Circle cx={12} cy={12} r={8} />
          <Circle cx={12} cy={12} r={3} />
          <Path d="M12 1v3M12 20v3M1 12h3M20 12h3" />
        </>
      )}
    </Svg>
  );
}
export default function TabsLayout() {
  const { colors } = useArena();
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.blue,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 8),
          height: 72 + insets.bottom,
        },
        tabBarLabelPosition: "below-icon",
        tabBarLabelStyle: {
          fontFamily: "Manrope",
          fontSize: 11,
          lineHeight: 16,
        },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Arena",
          tabBarIcon: ({ color }) => <Icon kind="arena" color={color} />,
        }}
      />
      <Tabs.Screen
        name="online"
        options={{
          title: "Online",
          tabBarIcon: ({ color }) => <Icon kind="online" color={color} />,
        }}
      />
      <Tabs.Screen
        name="studio"
        options={{
          title: "Studio",
          tabBarIcon: ({ color }) => <Icon kind="studio" color={color} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "History",
          tabBarIcon: ({ color }) => <Icon kind="history" color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color }) => <Icon kind="settings" color={color} />,
        }}
      />
    </Tabs>
  );
}
