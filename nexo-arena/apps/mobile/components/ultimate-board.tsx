import { useState } from "react";
import { View, Pressable } from "react-native";
import {
  evaluate,
  ultimateMoves,
  type UltimateState,
  type UltimateMove,
} from "@nexo/engine";
import { useArena } from "../lib/arena-provider";
import { Board } from "./board";
import { Copy } from "./ui";
export function UltimateBoard({
  game,
  onMove,
  disabled = false,
  accent,
}: {
  game: UltimateState;
  onMove(move: UltimateMove): void;
  disabled?: boolean;
  accent?: string;
}) {
  const { colors } = useArena(),
    [selected, setSelected] = useState<number | null>(null);
  const legal = ultimateMoves(game),
    live = !disabled && game.status === "playing";
  const index = live
    ? (game.forcedBoard ??
      (selected !== null && game.claims[selected] === null
        ? selected
        : (legal[0]?.board ?? 0)))
    : (selected ?? game.forcedBoard ?? 0);
  const board = game.boards[index],
    mini = {
      board,
      first: game.first,
      turn: game.turn,
      moves: [],
      ...evaluate(board),
    };
  return (
    <View style={{ gap: 16 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {game.boards.map((cells, b) => {
          const blocked = live && !legal.some((m) => m.board === b);
          return (
            <Pressable
              key={b}
              accessibilityRole="button"
              accessibilityLabel={`Board ${b + 1}${game.claims[b] ? `, ${game.claims[b]}` : ""}${game.forcedBoard === b ? ", required" : ""}`}
              accessibilityState={{ disabled: blocked, selected: index === b }}
              disabled={blocked}
              onPress={() => setSelected(b)}
              style={{
                width: "31%",
                minHeight: 82,
                padding: 8,
                backgroundColor: colors.raised,
                borderRadius: 10,
                borderWidth: index === b ? 2 : 1,
                borderColor:
                  index === b ? (accent ?? colors.blue) : colors.border,
                opacity: blocked ? 0.4 : 1,
              }}
            >
              <Copy kind="small">
                {b + 1}
                {game.claims[b] ? ` · ${game.claims[b]}` : ""}
              </Copy>
              <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                {cells.map((v, c) => (
                  <Copy
                    key={c}
                    kind="small"
                    style={{ width: "33%", textAlign: "center" }}
                    color={v === "X" ? (accent ?? colors.blue) : colors.muted}
                  >
                    {v ?? "·"}
                  </Copy>
                ))}
              </View>
            </Pressable>
          );
        })}
      </View>
      <Copy kind="small" color={colors.muted}>
        {live
          ? game.forcedBoard !== null
            ? `Play in board ${game.forcedBoard + 1}. Your square routes the next player.`
            : "Choose any open board."
          : "Select a board to inspect."}
      </Copy>
      <Copy kind="label">BOARD {index + 1}</Copy>
      <Board
        game={mini}
        accent={accent}
        disabled={!live || !legal.some((m) => m.board === index)}
        onMove={(cell) => {
          onMove({ board: index, cell });
          setSelected(null);
        }}
      />
    </View>
  );
}
