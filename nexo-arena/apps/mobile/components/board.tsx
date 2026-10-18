import { useEffect, useState } from "react";
import { Animated, Pressable, View } from "react-native";
import Svg, { Line } from "react-native-svg";
import type { GameState, Mark } from "@nexo/engine";
import { useArena } from "../lib/arena-provider";
import { MarkIcon } from "./ui";
function AnimatedMark({ mark, color }: { mark: Mark; color?: string }) {
  const { reducedMotion } = useArena();
  const [progress] = useState(() => new Animated.Value(reducedMotion ? 1 : 0));
  useEffect(() => {
    if (reducedMotion) progress.setValue(1);
    else
      Animated.spring(progress, {
        toValue: 1,
        damping: 15,
        stiffness: 170,
        mass: 0.6,
        useNativeDriver: true,
      }).start();
    return () => progress.stopAnimation();
  }, [progress, reducedMotion]);
  return (
    <Animated.View
      style={{
        opacity: progress,
        transform: [
          {
            scale: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [0.5, 1],
            }),
          },
        ],
      }}
    >
      <MarkIcon mark={mark} size={64} color={color} />
    </Animated.View>
  );
}
export function Board({
  game,
  disabled = false,
  onMove,
  accent,
}: {
  game: GameState;
  disabled?: boolean;
  onMove(index: number): void;
  accent?: string;
}) {
  const { colors, reducedMotion } = useArena();
  const [win] = useState(() => new Animated.Value(0));
  useEffect(() => {
    win.setValue(0);
    if (game.winningLine)
      Animated.timing(win, {
        toValue: 1,
        duration: reducedMotion ? 0 : 400,
        useNativeDriver: true,
      }).start();
    return () => win.stopAnimation();
  }, [game.winningLine, reducedMotion, win]);
  const line = game.winningLine;
  const point = (index: number) => ({
    x: ((index % 3) + 0.5) * 100,
    y: (Math.floor(index / 3) + 0.5) * 100,
  });
  return (
    <View
      style={{
        width: "100%",
        maxWidth: 440,
        alignSelf: "center",
        aspectRatio: 1,
        backgroundColor: colors.board,
        borderRadius: 26,
        padding: 8,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      {[0, 1, 2].map((row) => (
        <View key={row} style={{ flex: 1, flexDirection: "row" }}>
          {[0, 1, 2].map((col) => {
            const index = row * 3 + col;
            const mark = game.board[index];
            const blocked = disabled || !!mark || game.status !== "playing";
            return (
              <Pressable
                key={index}
                testID={`square-${index}`}
                accessibilityRole="button"
                accessibilityLabel={`Row ${row + 1}, column ${col + 1}, ${mark ?? "empty"}`}
                accessibilityState={{ disabled: blocked }}
                disabled={blocked}
                onPress={() => onMove(index)}
                style={({ pressed }) => ({
                  flex: 1,
                  minHeight: 44,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRightWidth: col < 2 ? 1 : 0,
                  borderBottomWidth: row < 2 ? 1 : 0,
                  borderColor: colors.border,
                  backgroundColor: pressed ? colors.raised : "transparent",
                })}
              >
                {mark && (
                  <AnimatedMark
                    key={`${index}-${mark}`}
                    mark={mark}
                    color={mark === "X" ? accent : undefined}
                  />
                )}
              </Pressable>
            );
          })}
        </View>
      ))}
      {line && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 8,
            left: 8,
            right: 8,
            bottom: 8,
            opacity: win,
          }}
        >
          <Svg width="100%" height="100%" viewBox="0 0 300 300">
            <Line
              x1={point(line[0]).x}
              y1={point(line[0]).y}
              x2={point(line[2]).x}
              y2={point(line[2]).y}
              stroke={
                game.winner === "X" ? (accent ?? colors.blue) : colors.violet
              }
              strokeWidth={5}
              strokeLinecap="round"
            />
          </Svg>
        </Animated.View>
      )}
    </View>
  );
}
