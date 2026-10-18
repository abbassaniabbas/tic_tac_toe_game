import { router } from "expo-router";
import { Button, Copy, Screen } from "../components/ui";
export default function NotFound() {
  return (
    <Screen>
      <Copy kind="title">This arena is still empty.</Copy>
      <Button onPress={() => router.replace("/")}>Back to arena</Button>
    </Screen>
  );
}
