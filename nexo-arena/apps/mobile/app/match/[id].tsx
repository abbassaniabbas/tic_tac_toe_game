import { useState } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { createGame, playMove } from "@nexo/engine";
import { useArena } from "../../lib/arena-provider";
import { Board } from "../../components/board";
import { Button, Copy, Screen, styles } from "../../components/ui";
export default function Match() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, colors } = useArena();
  const match = state.history.find((item) => item.id === id);
  const [step, setStep] = useState(0);
  if (!match)
    return (
      <Screen>
        <Copy kind="title">Match unavailable</Copy>
        <Copy color={colors.muted}>
          This match is no longer saved on this device.
        </Copy>
        <Button onPress={() => router.replace("/history")}>Open history</Button>
      </Screen>
    );
  const game = match.moves
    .slice(0, step)
    .reduce(
      (g, index) => playMove(g, index),
      createGame(match.config.firstMark),
    );
  return (
    <Screen>
      <Button secondary onPress={() => router.back()}>
        ← History
      </Button>
      <Copy kind="title">Every move, revisited.</Copy>
      <Copy color={colors.muted}>
        {new Date(match.completedAt).toLocaleString()} ·{" "}
        {match.config.mode === "ai"
          ? `${match.config.difficulty} AI`
          : "Local play"}
      </Copy>
      <Copy kind="label" color={colors.blue}>
        MOVE {step} OF {match.moves.length}
      </Copy>
      <Board game={game} disabled onMove={() => undefined} />
      <View style={styles.row}>
        <Button
          secondary
          style={{ flex: 1 }}
          disabled={!step}
          onPress={() => setStep(step - 1)}
        >
          ← Previous
        </Button>
        <Button
          style={{ flex: 1 }}
          disabled={step === match.moves.length}
          onPress={() => setStep(step + 1)}
        >
          Next →
        </Button>
      </View>
      <Copy style={{ textAlign: "center" }}>
        {game.status === "playing"
          ? `${game.turn} to move`
          : game.winner
            ? `Final result: ${game.winner} won`
            : "Draw"}
      </Copy>
    </Screen>
  );
}
