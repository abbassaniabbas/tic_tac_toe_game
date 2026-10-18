"use client";
import { useState } from "react";
import {
  evaluate,
  ultimateMoves,
  type UltimateState,
  type UltimateMove,
} from "@nexo/engine";
import { Board } from "./board";
export function UltimateBoard({
  game,
  onMove,
  disabled = false,
}: {
  game: UltimateState;
  onMove(move: UltimateMove): void;
  disabled?: boolean;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const legal = ultimateMoves(game),
    live = !disabled && game.status === "playing";
  const index = live
    ? (game.forcedBoard ??
      (selected !== null && game.claims[selected] === null
        ? selected
        : (legal[0]?.board ?? 0)))
    : (selected ?? game.forcedBoard ?? 0);
  const board = game.boards[index],
    outcome = evaluate(board);
  const mini = {
    board,
    first: game.first,
    turn: game.turn,
    moves: [],
    ...outcome,
  };
  return (
    <div className="ultimate-view">
      <div
        className="ultimate-overview"
        role="group"
        aria-label="Ultimate boards"
      >
        {game.boards.map((cells, b) => (
          <button
            key={b}
            className={`ultimate-mini ${index === b ? "selected" : ""}`}
            aria-label={`Board ${b + 1}${game.claims[b] ? `, ${game.claims[b]}` : ""}${game.forcedBoard === b ? ", required" : ""}`}
            aria-pressed={index === b}
            disabled={live && !legal.some((m) => m.board === b)}
            onClick={() => setSelected(b)}
          >
            <span>
              {b + 1}
              {game.claims[b] ? ` · ${game.claims[b]}` : ""}
            </span>
            <span className="mini-cells" aria-hidden="true">
              {cells.map((v, c) => (
                <i key={c}>{v ?? "·"}</i>
              ))}
            </span>
          </button>
        ))}
      </div>
      <p className="micro-copy">
        {live
          ? game.forcedBoard !== null
            ? `Play in board ${game.forcedBoard + 1}. Your square sends the next player to that board.`
            : "Choose any open board."
          : "Select a board to inspect."}
      </p>
      <h4>Board {index + 1}</h4>
      <Board
        game={mini}
        thinking={!live || !legal.some((m) => m.board === index)}
        onMove={(cell) => {
          onMove({ board: index, cell });
          setSelected(null);
        }}
      />
    </div>
  );
}
