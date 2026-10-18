import { useEffect } from "react";
import { Stack } from "expo-router";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ActivityIndicator, View } from "react-native";
import { ArenaProvider, useArena } from "../lib/arena-provider";
import { NativeAccountProvider } from "../lib/online";
SplashScreen.preventAutoHideAsync().catch(() => undefined);
function Navigation() {
  const { ready, colors, reducedMotion } = useArena();
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);
  if (!ready)
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          justifyContent: "center",
        }}
      >
        <ActivityIndicator
          color={colors.blue}
          accessibilityLabel="Loading saved game"
        />
      </View>
    );
  return (
    <>
      <StatusBar style={colors.background === "#101115" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: reducedMotion ? "none" : "slide_from_right",
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="game" />
        <Stack.Screen name="result" />
        <Stack.Screen name="match/[id]" />
        <Stack.Screen name="invite/[code]" />
        <Stack.Screen name="online-match/[id]" />
      </Stack>
    </>
  );
}
export default function Layout() {
  const [loaded, error] = useFonts({
    SpaceGrotesk: require("../assets/fonts/SpaceGrotesk.ttf"),
    Manrope: require("../assets/fonts/Manrope.ttf"),
  });
  if (!loaded && !error) return null;
  return (
    <SafeAreaProvider>
      <ArenaProvider>
        <NativeAccountProvider><Navigation /></NativeAccountProvider>
      </ArenaProvider>
    </SafeAreaProvider>
  );
}
