import { useEffect, useState } from "react";
import { Animated, View } from "react-native";
import { router } from "expo-router";
import { useArena } from "../lib/arena-provider";
import {
  Button,
  Copy,
  MarkIcon,
  Panel,
  Screen,
  styles,
} from "../components/ui";
export default function Result() {
  const { state, colors, reducedMotion, dispatchSession } = useArena();
  const { game, config, score, round } = state.session;
  const [entry] = useState(() => new Animated.Value(reducedMotion ? 1 : 0));
  useEffect(() => {
    Animated.timing(entry, {
      toValue: 1,
      duration: reducedMotion ? 0 : 450,
      useNativeDriver: true,
    }).start();
    return () => entry.stopAnimation();
  }, [entry, reducedMotion]);
  useEffect(() => {
    if (game.status === "playing") router.replace("/game");
  }, [game.status]);
  if (game.status === "playing")
    return (
      <Screen>
        <Copy kind="title">Your round is waiting.</Copy>
        <Button onPress={() => router.replace("/game")}>Resume game</Button>
      </Screen>
    );
  const draw = !game.winner;
  const won = config.mode === "local" || game.winner === config.humanMark;
  return (
    <Screen>
      <Copy
        kind="label"
        color={colors.muted}
        style={{ textAlign: "center", marginTop: 36 }}
      >
        ROUND {round} · COMPLETE
      </Copy>
      <Animated.View
        style={{
          alignItems: "center",
          opacity: entry,
          transform: [
            {
              scale: entry.interpolate({
                inputRange: [0, 1],
                outputRange: [0.8, 1],
              }),
            },
          ],
          paddingVertical: 32,
        }}
      >
        {draw ? (
          <View style={styles.row}>
            <MarkIcon size={86} />
            <MarkIcon mark="O" size={86} />
          </View>
        ) : (
          <MarkIcon mark={game.winner!} size={140} />
        )}
      </Animated.View>
      <Copy kind="hero" style={{ textAlign: "center", fontSize: 38 }}>
        {draw
          ? "A worthy draw."
          : config.mode === "local"
            ? `Player ${game.winner} wins.`
            : won
              ? "Well played."
              : "Next move, yours."}
      </Copy>
      <Copy color={colors.muted} style={{ textAlign: "center" }}>
        {draw
          ? "Evenly matched. One more round?"
          : config.mode === "local"
            ? "A little rivalry goes a long way."
            : won
              ? `${state.preferences.playerName}, you outplayed NEXO.`
              : "NEXO takes this round. Your next chance awaits."}
      </Copy>
      <Panel>
        <Copy kind="label" color={colors.muted}>
          SESSION SCORE
        </Copy>
        <View style={[styles.row, { justifyContent: "space-around" }]}>
          {[
            ["X", score.X],
            ["Draws", score.draws],
            ["O", score.O],
          ].map(([label, value]) => (
            <View key={label} style={{ alignItems: "center", gap: 6 }}>
              <Copy kind="title">{value}</Copy>
              <Copy kind="small" color={colors.muted}>
                {label}
              </Copy>
            </View>
          ))}
        </View>
      </Panel>
      <Button
        onPress={() => {
          dispatchSession({ type: "rematch" });
          router.replace("/game");
        }}
      >
        Play again →
      </Button>
      <Button secondary onPress={() => router.replace("/")}>
        Back to arena
      </Button>
      <Copy kind="small" color={colors.faint} style={{ textAlign: "center" }}>
        Match saved in your history.
      </Copy>
    </Screen>
  );
}
