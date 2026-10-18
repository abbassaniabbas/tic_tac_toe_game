import { useCallback, useState } from "react";
import { View, Share } from "react-native";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import {
  analyzeClassic,
  type GameState,
  type UltimateState,
  type ReplayRecord,
} from "@nexo/engine";
import { COSMETICS, ACHIEVEMENTS, type Cosmetic } from "@nexo/online";
import { useStudio, useSignatureMatch, useAccount } from "@nexo/online/react";
import { useArena } from "../../lib/arena-provider";
import { Board } from "../../components/board";
import { UltimateBoard } from "../../components/ultimate-board";
import { Field } from "../../components/online-lobby";
import { Brand, Button, Copy, Panel, Screen } from "../../components/ui";
const newId = () => Crypto.randomUUID();
const clock = (ms: number) =>
  `${Math.floor(Math.ceil(ms / 1000) / 60)}:${String(Math.ceil(ms / 1000) % 60).padStart(2, "0")}`;
function SignatureRoom({
  id,
  leave,
  enabled,
  accent,
}: {
  id: string;
  leave(): void;
  enabled: boolean;
  accent: string;
}) {
  const { user } = useAccount(),
    room = useSignatureMatch(id, enabled),
    [confirm, setConfirm] = useState(false);
  const m = room.match,
    allowed =
      enabled &&
      m?.phase === "active" &&
      m.players[m.game.turn] === user?.id &&
      !room.pending &&
      room.synced;
  return (
    <Panel>
      <Button secondary onPress={leave}>
        ← Studio rooms
      </Button>
      {room.error && <Copy>{room.error}</Copy>}
      {m ? (
        <>
          <Copy kind="title">
            {m.rulesVersion === "blitz-v1"
              ? "Blitz · 60 + 0"
              : "Ultimate · untimed"}
          </Copy>
          <Copy>Private · unrated</Copy>
          <Copy>
            {m.phase === "waiting"
              ? "Waiting for your friend"
              : m.phase === "active"
                ? `${m.game.turn} to move`
                : `${m.result ? (m.result === "draw" ? "Draw" : `${m.result} won`) : "Match closed"} · ${m.phase}`}
          </Copy>
          <Copy>
            {m.playerNames.X} (X) vs {m.playerNames.O ?? "A friend"} (O)
          </Copy>
          {room.clocks && (
            <View
              style={{ flexDirection: "row", justifyContent: "space-between" }}
            >
              <Copy kind="title">X {clock(room.clocks.X)}</Copy>
              <Copy kind="title">O {clock(room.clocks.O)}</Copy>
            </View>
          )}
          {m.rulesVersion === "ultimate-v1" ? (
            <UltimateBoard
              game={m.game as UltimateState}
              accent={accent}
              disabled={!allowed}
              onMove={(move) => void room.act("move", newId(), move)}
            />
          ) : (
            <Board
              game={m.game as GameState}
              accent={accent}
              disabled={!allowed}
              onMove={(move) => void room.act("move", newId(), move)}
            />
          )}
          <Copy kind="small">
            Server time decides Blitz deadlines. Displayed clocks are estimates.
            Accepted matches stay open when you leave.
          </Copy>
          {["waiting", "active"].includes(m.phase) && (
            <Button
              secondary
              disabled={room.pending || !room.synced}
              onPress={() =>
                confirm ? void room.act("end", newId()) : setConfirm(true)
              }
            >
              {confirm
                ? m.phase === "waiting"
                  ? "Confirm cancellation"
                  : "Confirm resignation"
                : m.phase === "waiting"
                  ? "Cancel invitation"
                  : "Resign match"}
            </Button>
          )}
          <Button secondary onPress={() => void room.refresh()}>
            Refresh match
          </Button>
        </>
      ) : (
        <Copy>Loading match…</Copy>
      )}
    </Panel>
  );
}
export default function StudioScreen() {
  const { studioInvite } = useLocalSearchParams<{ studioInvite?: string }>();
  const s = useStudio(AsyncStorage, newId, studioInvite),
    { user, api } = useAccount(),
    { colors, state, active } = useArena();
  const [focused, setFocused] = useState(false),
    [tab, setTab] = useState<
      "ultimate" | "puzzle" | "replay" | "online" | "collection"
    >(studioInvite ? "online" : "ultimate");
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  const records: ReplayRecord[] = [
    ...s.records,
    ...state.history.map((r) => ({
      id: r.id,
      rule: "classic-v1" as const,
      first: r.config.firstMark,
      moves: r.moves,
      result: r.winner ?? ("draw" as const),
      source: "local" as const,
    })),
  ];
  const accent = COSMETICS[s.color].color;
  const analysis =
    s.position && !("boards" in s.position) ? analyzeClassic(s.position) : null;
  return (
    <Screen>
      <Brand />
      <Copy kind="hero">Signature Studio</Copy>
      <Copy color={colors.muted}>One arena. More ways to think.</Copy>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {(
          ["ultimate", "puzzle", "replay", "online", "collection"] as const
        ).map((t) => (
          <Button
            secondary
            key={t}
            label={
              {
                ultimate: "Ultimate",
                puzzle: "Daily puzzle",
                replay: "Replay Lab",
                online: "Blitz & rooms",
                collection: "Collection",
              }[t]
            }
            onPress={() => setTab(t)}
          >
            {
              {
                ultimate: "Ultimate",
                puzzle: "Daily puzzle",
                replay: "Replay Lab",
                online: "Blitz & rooms",
                collection: "Collection",
              }[t]
            }
            {tab === t ? " · selected" : ""}
          </Button>
        ))}
      </View>
      {s.error && <Copy color={colors.violet}>{s.error}</Copy>}
      {s.message && <Copy>{s.message}</Copy>}
      {!s.ready ? (
        <Copy>Loading Studio…</Copy>
      ) : tab === "ultimate" ? (
        <Panel>
          <Copy kind="label" color={accent}>
            LOCAL TWO-PLAYER · ULTIMATE
          </Copy>
          <Copy kind="title">Nine boards. One win.</Copy>
          <Copy color={colors.muted}>
            Win three small boards in a row. Your square sends the next player
            to that board. A closed destination allows any open board.
          </Copy>
          <Copy>
            {s.ultimate.status === "playing"
              ? `${s.ultimate.turn} to move`
              : s.ultimate.winner
                ? `${s.ultimate.winner} won Ultimate`
                : "Ultimate draw"}
          </Copy>
          <UltimateBoard
            game={s.ultimate}
            accent={accent}
            onMove={s.ultimateMove}
          />
          <Button secondary onPress={s.resetUltimate}>
            New Ultimate game
          </Button>
        </Panel>
      ) : tab === "puzzle" ? (
        <Panel>
          <Copy kind="label" color={accent}>
            {s.day} · UTC DAILY
          </Copy>
          <Copy kind="title">{s.puzzle.title}</Copy>
          <Copy color={colors.muted}>
            {s.puzzle.theme} Play {s.puzzle.solver}; the opponent replies with
            optimal Classic play.
          </Copy>
          <Board
            game={s.puzzleGame}
            accent={accent}
            disabled={s.puzzleGame.status !== "playing"}
            onMove={s.puzzleMove}
          />
          <Copy>
            {s.puzzleGame.winner === s.puzzle.solver
              ? "Puzzle solved."
              : s.puzzleGame.status === "playing"
                ? "Find the forced win."
                : "Try another line."}
          </Copy>
          <Button
            secondary
            disabled={s.puzzleGame.status !== "playing"}
            onPress={s.hint}
          >
            Show hint
          </Button>
          <Button secondary onPress={s.resetPuzzle}>
            Retry puzzle
          </Button>
          <Button
            disabled={
              s.pending || !user || s.puzzleGame.winner !== s.puzzle.solver
            }
            onPress={() => void s.verify()}
          >
            Verify daily solve
          </Button>
          <Copy kind="small" color={colors.muted}>
            Seven curated puzzles rotate on UTC dates. Offline practice is saved
            here. Sign in through Online to verify a solve.
          </Copy>
        </Panel>
      ) : tab === "replay" ? (
        <Panel>
          <Copy kind="title">Every move, understood.</Copy>
          <Copy color={colors.muted}>
            Review accepted moves or local practice. Branches never change the
            saved match.
          </Copy>
          {records.length === 0 ? (
            <Copy>Finish a Classic or Ultimate game to add a replay.</Copy>
          ) : (
            records.map((r) => (
              <Button
                secondary
                key={r.id}
                disabled={s.pending}
                onPress={() => s.selectReplay(r)}
              >
                {r.source === "server" ? "Online" : "Local"} ·{" "}
                {r.rule.replace("-v1", "")} · {r.moves.length} moves ·{" "}
                {r.result ?? "open"}
              </Button>
            ))
          )}
          {s.replay && s.position && (
            <>
              <Copy kind="label" color={accent}>
                {s.replay.source === "server"
                  ? "ACCEPTED SERVER MOVES"
                  : "LOCAL PRACTICE"}{" "}
                ·{" "}
                {s.branching
                  ? "SANDBOX BRANCH"
                  : `MOVE ${s.step}/${s.replay.moves.length}`}
              </Copy>
              {"boards" in s.position ? (
                <UltimateBoard
                  game={s.position}
                  accent={accent}
                  onMove={s.branchMove}
                />
              ) : (
                <Board
                  game={s.position}
                  accent={accent}
                  disabled={s.position.status !== "playing"}
                  onMove={s.branchMove}
                />
              )}
              <Button secondary onPress={() => s.navigate(0)}>
                First
              </Button>
              <Button
                secondary
                disabled={!s.step}
                onPress={() => s.navigate(s.step - 1)}
              >
                Previous
              </Button>
              <Button
                secondary
                disabled={s.step === s.replay.moves.length}
                onPress={() => s.navigate(s.step + 1)}
              >
                Next
              </Button>
              <Button
                secondary
                onPress={() => s.navigate(s.replay!.moves.length)}
              >
                Last
              </Button>
              <Button secondary onPress={s.resetBranch}>
                Reset branch
              </Button>
              {analysis && (
                <Copy>
                  Perfect play:{" "}
                  {analysis.score === 1
                    ? "win"
                    : analysis.score === 0
                      ? "draw"
                      : "loss"}{" "}
                  for {s.position.turn}. Best squares:{" "}
                  {analysis.bestMoves.map((n) => n + 1).join(", ") ||
                    "finished"}
                  .
                </Copy>
              )}
              {"boards" in s.position && (
                <Copy kind="small">
                  Ultimate review shows routing and claims. Exact analysis is
                  available for Classic/Blitz positions.
                </Copy>
              )}
            </>
          )}
        </Panel>
      ) : tab === "online" ? (
        <Panel>
          <Copy kind="title">Blitz & Ultimate rooms</Copy>
          <Copy>
            Blitz gives each player 60 seconds without increment. Ultimate uses
            nine boards without a clock. Both are private and unrated.
          </Copy>
          {!api || !user ? (
            <Copy>
              Sign in through Online to use shared rooms. Offline Ultimate and
              puzzles work now.
            </Copy>
          ) : (
            <>
              <Button
                disabled={s.pending}
                onPress={() => void s.create("blitz-v1")}
              >
                Create Blitz room
              </Button>
              <Button
                secondary
                disabled={s.pending}
                onPress={() => void s.create("ultimate-v1")}
              >
                Create Ultimate room
              </Button>
              {s.created && (
                <>
                  <Field
                    label="Studio invitation"
                    value={s.created}
                    editable={false}
                    multiline
                  />
                  <Button
                    secondary
                    onPress={() => void Share.share({ message: s.created })}
                  >
                    Share Studio invitation
                  </Button>
                </>
              )}
              <Field
                label="Studio invitation link or code"
                value={s.invite}
                onChangeText={s.setInvite}
              />
              <Button
                secondary
                disabled={s.pending || !s.invite.trim()}
                onPress={() => void s.join()}
              >
                Join Studio room
              </Button>
              {s.matchId ? (
                <SignatureRoom
                  id={s.matchId}
                  accent={accent}
                  enabled={active && focused && tab === "online"}
                  leave={() => {
                    s.setMatchId(null);
                    void s.refresh();
                  }}
                />
              ) : (
                s.online.map((m) => (
                  <Button
                    secondary
                    key={m.matchId}
                    onPress={() => s.setMatchId(m.matchId)}
                  >
                    {m.rulesVersion.replace("-v1", "")} · {m.phase} ·{" "}
                    {m.playerNames.X} vs {m.playerNames.O ?? "waiting"}
                  </Button>
                ))
              )}
            </>
          )}
          <Button
            secondary
            disabled={s.pending || !user}
            onPress={() => void s.refresh()}
          >
            Refresh online Studio
          </Button>
        </Panel>
      ) : (
        <Panel>
          <Copy kind="title">Your collection</Copy>
          <Copy color={colors.muted}>
            Achievements come from accepted server results and verified daily
            solves. Local practice does not award them.
          </Copy>
          {Object.entries(ACHIEVEMENTS).map(([code, title]) => (
            <Copy key={code}>
              {s.extras?.achievements.some((a) => a.code === code) ? "✓" : "○"}{" "}
              {title}
            </Copy>
          ))}
          <Copy kind="title">Signature board palettes</Copy>
          {(Object.keys(COSMETICS) as Cosmetic[]).map((c) => {
            const theme = COSMETICS[c],
              unlocked =
                !theme.requires ||
                s.extras?.achievements.some((a) => a.code === theme.requires);
            return (
              <Button
                secondary
                key={c}
                disabled={s.pending || !unlocked}
                onPress={() => void s.setColor(c)}
              >
                {theme.name}
                {s.color === c ? " · selected" : ""}
                {unlocked ? "" : ` · ${ACHIEVEMENTS[theme.requires!]}`}
              </Button>
            );
          })}
          <Copy kind="small">
            Palettes affect Studio marks only. Blue and Silver work offline.
          </Copy>
          <Button
            secondary
            disabled={s.pending || !user}
            onPress={() => void s.refresh()}
          >
            Refresh collection
          </Button>
        </Panel>
      )}
    </Screen>
  );
}
