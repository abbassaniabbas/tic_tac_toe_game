import { KeyboardAvoidingView, Platform } from "react-native";
import { Brand, Screen } from "../../components/ui";
import { OnlineLobby } from "../../components/online-lobby";
export default function Online() {
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Screen>
        <Brand />
        <OnlineLobby />
      </Screen>
    </KeyboardAvoidingView>
  );
}
