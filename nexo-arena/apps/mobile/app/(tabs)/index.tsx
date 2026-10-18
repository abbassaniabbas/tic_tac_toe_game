import { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { summarizeHistory } from "@nexo/shared";
import { useArena } from "../../lib/arena-provider";
import {
  Brand,
  Button,
  Copy,
  MarkIcon,
  Panel,
  Screen,
  styles,
} from "../../components/ui";
import { Configuration } from "../../components/configuration";
export default function Home() {
  const { state, colors, dispatchSession } = useArena();
  const [config, setConfig] = useState(state.session.config);
  const stats = summarizeHistory(state.history);
  const ongoing =
    state.session.game.moves.length > 0 &&
    state.session.game.status === "playing";
  function start() {
    if (JSON.stringify(config) !== JSON.stringify(state.session.config))
      dispatchSession({ type: "configure", config });
    else if (state.session.game.status !== "playing")
      dispatchSession({ type: "rematch" });
    router.push("/game");
  }
  return (
    <Screen>
      <Brand />
      <Copy kind="label" color={colors.blue}>
        YOUR NEXT MOVE STARTS HERE
      </Copy>
      <Copy kind="hero" style={{ fontSize: 36, lineHeight: 42 }}>
        Small board.{"\n"}Big possibilities.
      </Copy>
      <Copy color={colors.muted}>
        A timeless rivalry, reimagined. Challenge the AI or pass the phone to a
        friend.
      </Copy>
      <View
        style={[
          styles.row,
          { marginVertical: 4, justifyContent: "center", gap: 26 },
        ]}
      >
        <MarkIcon size={76} />
        <Copy kind="label" color={colors.faint}>
          VS
        </Copy>
        <MarkIcon mark="O" size={76} />
      </View>
      <Panel>
        <View style={[styles.row, { justifyContent: "space-between", flexWrap: "wrap" }]}>
          <Copy kind="title" style={{ fontSize: 22 }}>
            Enter the arena
          </Copy>
          <Copy kind="label" color={colors.cyan}>
            OFFLINE READY
          </Copy>
        </View>
        <Button onPress={start}>Play now →</Button>
        <Configuration config={config} onChange={setConfig} />
        {ongoing && (
          <Button secondary onPress={() => router.push("/game")}>
            Resume round {state.session.round}
          </Button>
        )}
        <Copy kind="small" color={colors.muted}>
          {config.mode === "ai"
            ? {
                easy: "Easy · A relaxed opponent that explores freely.",
                medium: "Medium · Smart tactics with room to outplay it.",
                hard: "Hard · Perfect play. Can you earn a draw?",
              }[config.difficulty]
            : "Local · Two players, one device. Pass it after your move."}
        </Copy>
      </Panel>
      <View style={[styles.row, { justifyContent: "space-between", flexWrap: "wrap" }]}>
        <Copy kind="label" color={colors.muted} style={{flex:1}}>
          YOUR ARENA, {state.preferences.playerName.toUpperCase()}
        </Copy>
        <Copy kind="small" color={colors.muted}>
          {stats.played} saved matches
        </Copy>
      </View>
      <View style={styles.row}>
        {[
          ["AI wins", stats.aiWins],
          ["AI losses", stats.aiLosses],
          ["Draws", stats.draws],
        ].map(([label, value]) => (
          <Panel key={label} style={{ flex: 1, padding: 14, gap: 4 }}>
            <Copy kind="title" style={{ fontSize: 26 }}>
              {value}
            </Copy>
            <Copy kind="small" color={colors.muted}>
              {label}
            </Copy>
          </Panel>
        ))}
      </View>
      <Copy kind="small" color={colors.faint}>
        Classic rules. No account needed. Your games stay on this device.
      </Copy>
    </Screen>
  );
}
