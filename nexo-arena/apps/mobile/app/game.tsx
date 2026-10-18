import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { canUndo } from "@nexo/engine";
import { useArena } from "../lib/arena-provider";
import { useFeedback } from "../lib/feedback";
import { useAiTurn } from "../lib/ai-turn";
import { Board } from "../components/board";
import {
  Button,
  Copy,
  MarkIcon,
  Panel,
  Screen,
  styles,
} from "../components/ui";
export default function Game() {
  const { state, colors, active, reducedMotion, dispatchSession, play } =
    useArena();
  const { game, config, score, round } = state.session;
  const [focused, setFocused] = useState(false);
  const feedback = useFeedback();
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  const aiMove = useCallback(
    (index: number) => {
      const outcome = play(index, "ai");
      if (outcome) feedback(outcome !== "playing");
    },
    [play, feedback],
  );
  useAiTurn(state.session, focused && active, aiMove);
  useEffect(() => {
    if (!focused || !active || game.status === "playing") return;
    const timer = setTimeout(
      () => router.replace("/result"),
      reducedMotion ? 0 : 750,
    );
    return () => clearTimeout(timer);
  }, [focused, active, game.status, reducedMotion]);
  const thinking =
    config.mode === "ai" &&
    game.turn !== config.humanMark &&
    game.status === "playing";
  const name = (mark: "X" | "O") =>
    config.mode === "ai"
      ? mark === config.humanMark
        ? state.preferences.playerName
        : "NEXO AI"
      : `Player ${mark}`;
  const status =
    game.status === "draw"
      ? "A perfect balance. Draw."
      : game.winner
        ? `${name(game.winner)} wins!`
        : thinking
          ? "NEXO is thinking…"
          : `${name(game.turn)}’s turn`;
  return (
    <Screen>
      <View style={[styles.row, { justifyContent: "space-between" }]}>
        <Button
          secondary
          label="Back to arena"
          onPress={() => router.back()}
          style={{ paddingHorizontal: 16 }}
        >
          ← Arena
        </Button>
        <Copy kind="label" color={colors.muted}>
          ROUND {round.toString().padStart(2, "0")}
        </Copy>
      </View>
      <View style={{ gap: 6 }}>
        <Copy kind="title">
          {config.mode === "ai" ? "You vs NEXO" : "A friendly rivalry"}
        </Copy>
        <Copy kind="small" color={colors.muted}>
          {config.mode === "ai"
            ? `${config.difficulty.toUpperCase()} AI`
            : "PASS & PLAY"}{" "}
          · CLASSIC 3 × 3
        </Copy>
      </View>
      <View style={styles.row}>
        {(["X", "O"] as const).map((mark) => (
          <Panel
            key={mark}
            style={{
              flex: 1,
              padding: 14,
              gap: 8,
              borderColor:
                game.turn === mark && game.status === "playing"
                  ? mark === "X"
                    ? colors.blue
                    : colors.violet
                  : colors.border,
            }}
          >
            <View style={[styles.row, { justifyContent: "space-between" }]}>
              <MarkIcon mark={mark} size={24} />
              <Copy kind="title" style={{ fontSize: 24 }}>
                {score[mark]}
              </Copy>
            </View>
            <Copy kind="small" color={colors.muted}>
              {name(mark)}
            </Copy>
          </Panel>
        ))}
      </View>
      <View accessibilityLiveRegion="polite">
        <Copy
          style={{ textAlign: "center" }}
          color={thinking ? colors.violet : colors.text}
        >
          {status}
        </Copy>
      </View>
      <Board
        game={game}
        disabled={!active || thinking}
        onMove={(index) => {
          const outcome = play(index, "human");
          if (outcome) feedback(outcome !== "playing");
        }}
      />
      <Copy kind="small" color={colors.muted} style={{ textAlign: "center" }}>
        {score.draws} draws · Three in a row wins
      </Copy>
      <View style={styles.row}>
        <Button
          secondary
          style={{ flex: 1 }}
          disabled={!canUndo(state.session)}
          onPress={() => dispatchSession({ type: "undo" })}
        >
          ↶ Undo
        </Button>
        <Button
          secondary
          style={{ flex: 1 }}
          disabled={game.status !== "playing"}
          onPress={() => dispatchSession({ type: "restart" })}
        >
          Restart
        </Button>
      </View>
      <Copy kind="small" color={colors.faint} style={{ textAlign: "center" }}>
        Your round is saved when you leave.
      </Copy>
    </Screen>
  );
}
