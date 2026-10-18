import { useState } from "react";
import { Modal, Switch, TextInput, View, Linking } from "react-native";
import { PRIVACY_SECTIONS } from "@nexo/shared";
import { useArena } from "../../lib/arena-provider";
import {
  Button,
  Copy,
  Options,
  Panel,
  Screen,
  styles,
} from "../../components/ui";
export default function Settings() {
  const {
    state,
    colors,
    reducedMotion,
    preferences,
    clearHistory,
    dispatchSession,
  } = useArena();
  const [confirm, setConfirm] = useState<"history" | "score" | null>(null);
  const [privacy, setPrivacy] = useState(false);
  const p = state.preferences;
  return (
    <Screen>
      <Copy kind="label" color={colors.blue}>
        MAKE IT YOURS
      </Copy>
      <Copy kind="hero" style={{ fontSize: 38 }}>
        Your arena.
      </Copy>
      <Copy color={colors.muted}>Small details. A better way to play.</Copy>
      <Panel>
        <Copy kind="label" color={colors.muted}>
          PLAYER NAME
        </Copy>
        <TextInput
          accessibilityLabel="Player name"
          value={p.playerName}
          maxLength={24}
          onChangeText={(playerName) =>
            preferences({
              playerName: playerName.replace(/[\u0000-\u001f]/g, ""),
            })
          }
          onBlur={() =>
            preferences({ playerName: p.playerName.trim() || "You" })
          }
          placeholder="You"
          placeholderTextColor={colors.faint}
          autoCorrect={false}
          returnKeyType="done"
          style={{
            minHeight: 50,
            padding: 14,
            borderRadius: 12,
            backgroundColor: colors.raised,
            color: colors.text,
            fontFamily: "Manrope",
            fontSize: 16,
          }}
        />
        <Copy kind="small" color={colors.muted}>
          A local display name. No account required.
        </Copy>
      </Panel>
      <Panel>
        <Options
          label="APPEARANCE"
          values={["system", "dark", "light"]}
          value={p.theme}
          onChange={(theme) => preferences({ theme })}
        />
        {(
          [
            {
              key: "sound",
              title: "Sound effects",
              detail: "A little sound for every move.",
            },
            {
              key: "haptics",
              title: "Haptic feedback",
              detail: "Feel each move on supported devices.",
            },
            {
              key: "reducedMotion",
              title: "Reduce motion",
              detail: "Also follows your device accessibility setting.",
            },
          ] as const
        ).map((item) => (
          <View
            key={item.key}
            style={[styles.row, { justifyContent: "space-between" }]}
          >
            <View style={{ flex: 1 }}>
              <Copy>{item.title}</Copy>
              <Copy kind="small" color={colors.muted}>
                {item.detail}
              </Copy>
            </View>
            <Switch
              accessibilityLabel={item.title}
              value={p[item.key]}
              onValueChange={(value) => preferences({ [item.key]: value })}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#fff"
            />
          </View>
        ))}
      </Panel>
      <Panel>
        <Copy kind="label" color={colors.muted}>
          LOCAL DATA
        </Copy>
        <Button secondary onPress={() => setConfirm("score")}>
          Reset session score
        </Button>
        <Button secondary onPress={() => setConfirm("history")}>
          Clear match history
        </Button>
        <Copy kind="small" color={colors.muted}>
          Your saved games and preferences work without an internet connection.
        </Copy>
      </Panel>
      <Panel>
        <Button secondary onPress={() => setPrivacy((v) => !v)}>
          Privacy & data
        </Button>
        {privacy &&
          PRIVACY_SECTIONS.map((s) => (
            <View key={s.title} style={{ gap: 8 }}>
              <Copy kind="title">{s.title}</Copy>
              <Copy color={colors.muted}>{s.text}</Copy>
            </View>
          ))}
        {process.env.EXPO_PUBLIC_WEB_URL && (
          <Button
            secondary
            onPress={() =>
              void Linking.openURL(
                `${process.env.EXPO_PUBLIC_WEB_URL!.replace(/\/$/, "")}/support`,
              ).catch(() => setPrivacy(true))
            }
          >
            Support website →
          </Button>
        )}
      </Panel>
      <Copy kind="small" color={colors.faint} style={{ textAlign: "center" }}>
        NEXO Arena · v1.0.0 · Classic rules
      </Copy>
      <Modal
        visible={!!confirm}
        transparent
        animationType={reducedMotion ? "none" : "fade"}
        onRequestClose={() => setConfirm(null)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "#0009",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <Panel style={{ width: "100%", maxWidth: 440, alignSelf: "center" }}>
            <Copy kind="title" style={{ fontSize: 24 }}>
              {confirm === "history"
                ? "Clear your matchbook?"
                : "Reset this session?"}
            </Copy>
            <Copy color={colors.muted}>
              {confirm === "history"
                ? "Saved match history and its statistics will be removed from this device."
                : "Scores and the current round will start fresh. Match history stays saved."}
            </Copy>
            <Button
              onPress={() => {
                if (confirm === "history") clearHistory();
                else dispatchSession({ type: "resetScore" });
                setConfirm(null);
              }}
            >
              Confirm reset
            </Button>
            <Button secondary onPress={() => setConfirm(null)}>
              Cancel
            </Button>
          </Panel>
        </View>
      </Modal>
    </Screen>
  );
}
