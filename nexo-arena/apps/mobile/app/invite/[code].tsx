import { useLocalSearchParams } from "expo-router";
import { KeyboardAvoidingView, Platform } from "react-native";
import { OnlineLobby } from "../../components/online-lobby";
import { Brand, Copy, Screen } from "../../components/ui";
export default function Invite() {
  const { code } = useLocalSearchParams<{ code: string }>();
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Screen>
        <Brand />
        {/^[a-f0-9]{48}$/.test(code ?? "") ? (
          <OnlineLobby initialInvite={code} />
        ) : (
          <Copy kind="title">Invalid invitation.</Copy>
        )}
      </Screen>
    </KeyboardAvoidingView>
  );
}
