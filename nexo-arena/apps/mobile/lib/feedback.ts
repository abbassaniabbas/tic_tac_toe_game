import { useCallback, useEffect } from "react";
import * as Haptics from "expo-haptics";
import { useAudioPlayer } from "expo-audio";
import { useArena } from "./arena-provider";
export function useFeedback() {
  const { state, active } = useArena();
  const move = useAudioPlayer(require("../assets/sounds/move.wav"));
  const result = useAudioPlayer(require("../assets/sounds/result.wav"));
  useEffect(() => {
    if (!active || !state.preferences.sound) {
      move.pause();
      result.pause();
    }
  }, [active, state.preferences.sound, move, result]);
  return useCallback(
    (finished = false) => {
      if (!active) return;
      if (state.preferences.haptics)
        (finished
          ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          : Haptics.selectionAsync()
        ).catch(() => undefined);
      if (state.preferences.sound) {
        const player = finished ? result : move;
        player
          .seekTo(0)
          .then(() => player.play())
          .catch(() => undefined);
      }
    },
    [active, state.preferences.sound, state.preferences.haptics, move, result],
  );
}
