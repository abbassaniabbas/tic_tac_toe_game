import { View } from "react-native";
import type { GameConfig } from "@nexo/engine";
import { Options } from "./ui";
export function Configuration({
  config,
  onChange,
}: {
  config: GameConfig;
  onChange(config: GameConfig): void;
}) {
  return (
    <View style={{ gap: 18 }}>
      <Options
        label="GAME MODE"
        values={["ai", "local"]}
        value={config.mode}
        onChange={(mode) => onChange({ ...config, mode })}
      />
      {config.mode === "ai" && (
        <>
          <Options
            label="DIFFICULTY"
            values={["easy", "medium", "hard"]}
            value={config.difficulty}
            onChange={(difficulty) => onChange({ ...config, difficulty })}
          />
          <Options
            label="YOUR MARK"
            values={["X", "O"]}
            value={config.humanMark}
            onChange={(humanMark) => onChange({ ...config, humanMark })}
          />
        </>
      )}
      <Options
        label="FIRST MOVE"
        values={["X", "O"]}
        value={config.firstMark}
        onChange={(firstMark) => onChange({ ...config, firstMark })}
      />
    </View>
  );
}
