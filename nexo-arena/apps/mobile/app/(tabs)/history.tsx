import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { summarizeHistory } from "@nexo/shared";
import { useArena } from "../../lib/arena-provider";
import { Copy, MarkIcon, Panel, Screen, styles } from "../../components/ui";
export default function History() {
  const { state, colors } = useArena();
  const stats = summarizeHistory(state.history);
  return (
    <Screen>
      <Copy kind="label" color={colors.blue}>
        EVERY MOVE TELLS A STORY
      </Copy>
      <Copy kind="hero" style={{ fontSize: 38 }}>
        Your matchbook.
      </Copy>
      <Copy color={colors.muted}>
        Your latest 200 completed games, saved on this device.
      </Copy>
      <Panel>
        <View style={[styles.row, { justifyContent: "space-around" }]}>
          {[
            ["Played", stats.played],
            ["AI wins", stats.aiWins],
            ["AI losses", stats.aiLosses],
            ["Draws", stats.draws],
          ].map(([label, value]) => (
            <View key={label} style={{ alignItems: "center", gap: 6 }}>
              <Copy kind="title">{value}</Copy>
              <Copy kind="small" color={colors.muted}>
                {label}
              </Copy>
            </View>
          ))}
        </View>
        <Copy kind="small" color={colors.muted}>
          Local wins · X {stats.localXWins} / O {stats.localOWins}
        </Copy>
      </Panel>
      {!state.history.length ? (
        <Panel>
          <MarkIcon mark="O" size={48} />
          <Copy kind="title" style={{ fontSize: 22 }}>
            A fresh start.
          </Copy>
          <Copy color={colors.muted}>
            Finish a round to begin your match history.
          </Copy>
        </Panel>
      ) : (
        state.history.map((match) => {
          const result = !match.winner
            ? "Draw"
            : match.config.mode === "local"
              ? `${match.winner} won`
              : match.winner === match.config.humanMark
                ? "You won"
                : "NEXO won";
          return (
            <Pressable
              key={match.id}
              accessibilityRole="button"
              accessibilityLabel={`${result}, ${match.config.mode === "ai" ? match.config.difficulty + " AI" : "local"}, view match`}
              onPress={() =>
                router.push({
                  pathname: "/match/[id]",
                  params: { id: match.id },
                })
              }
            >
              <Panel style={{ padding: 18 }}>
                <View style={[styles.row, { justifyContent: "space-between" }]}>
                  <View style={styles.row}>
                    <MarkIcon mark={match.winner ?? "O"} size={38} />
                    <View>
                      <Copy style={{ fontWeight: "700" }}>{result}</Copy>
                      <Copy kind="small" color={colors.muted}>
                        {match.config.mode === "ai"
                          ? `${match.config.difficulty} AI`
                          : "Local multiplayer"}{" "}
                        · {match.moves.length} moves
                      </Copy>
                    </View>
                  </View>
                  <Copy color={colors.muted}>↗</Copy>
                </View>
                <Copy kind="small" color={colors.faint}>
                  {new Date(match.completedAt).toLocaleString()}
                </Copy>
              </Panel>
            </Pressable>
          );
        })
      )}
    </Screen>
  );
}
