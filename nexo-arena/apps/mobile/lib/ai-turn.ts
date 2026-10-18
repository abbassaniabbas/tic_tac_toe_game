import { useEffect } from "react";
import { chooseAiMove, type Session } from "@nexo/engine";
export function useAiTurn(
  session: Session,
  enabled: boolean,
  play: (index: number) => void,
) {
  useEffect(() => {
    if (
      !enabled ||
      session.config.mode !== "ai" ||
      session.game.status !== "playing" ||
      session.game.turn === session.config.humanMark
    )
      return;
    const timer = setTimeout(() => {
      const index = chooseAiMove(session.game, session.config.difficulty);
      if (index !== null) play(index);
    }, 420);
    return () => clearTimeout(timer);
  }, [session, enabled, play]);
}
