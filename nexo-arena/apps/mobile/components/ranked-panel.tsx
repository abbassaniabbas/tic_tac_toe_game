import { useCallback, useState } from "react";
import { View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import * as Crypto from "expo-crypto";
import { useAccount, useLeaderboard, useMatchmaking } from "@nexo/online/react";
import { useArena } from "../lib/arena-provider";
import { Button, Copy, Panel } from "./ui";
export function RankedPanel() {
  const { active, colors } = useArena();
  const { profile } = useAccount();
  const [focused, setFocused] = useState(false),
    [regional, setRegional] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  const enabled = active && focused;
  const { queue, pending, error, enter, cancel, refresh } =
    useMatchmaking(enabled);
  const board = useLeaderboard(
    regional ? (profile?.region ?? null) : null,
    enabled,
  );
  return (
    <Panel>
      <Copy kind="label" color={colors.blue}>
        CLASSIC · UNTIMED
      </Copy>
      <Copy kind="title">Find your next rival.</Copy>
      {queue && (
        <>
          <Copy kind="hero">{queue.rating.value} Elo</Copy>
          <Copy color={colors.muted}>
            {queue.rating.provisional
              ? `${queue.rating.games}/10 placements`
              : `${queue.rating.games} rated games`}
          </Copy>
        </>
      )}
      <Copy color={colors.muted}>
        Match near your rating. We prefer your selected region for 15 seconds,
        then widen globally.
      </Copy>
      {!enabled ? (
        <Copy>Return to this screen to search.</Copy>
      ) : queue?.match ? (
        <Button
          onPress={() => router.push(`/online-match/${queue.match!.matchId}`)}
        >
          Open ranked match →
        </Button>
      ) : queue?.status === "waiting" ? (
        <>
          <Copy>Searching for an opponent…</Copy>
          <Button secondary disabled={pending} onPress={() => void cancel()}>
            Cancel search
          </Button>
        </>
      ) : (
        <Button
          disabled={pending || !queue || !enabled}
          onPress={() => void enter(Crypto.randomUUID())}
        >
          {pending ? "Starting search…" : "Find ranked match"}
        </Button>
      )}
      {queue?.status === "expired" && (
        <Copy>Your search expired. Start again when you’re ready.</Copy>
      )}
      {error && <Copy color={colors.violet}>{error}</Copy>}
      <Button
        secondary
        disabled={pending || !enabled}
        onPress={() => void refresh()}
      >
        Refresh ranked play
      </Button>
      <Copy kind="small" color={colors.muted}>
        Leaving the lobby cancels an unmatched search. Accepted matches stay
        open. Resignation counts as a rated loss.
      </Copy>
      <Copy kind="title">Leaderboard</Copy>
      <View style={{ gap: 10 }}>
        <Button
          secondary
          label="Global leaderboard"
          onPress={() => setRegional(false)}
        >
          {regional ? "Global" : "Global · selected"}
        </Button>
        <Button
          secondary
          disabled={!profile?.region}
          onPress={() => setRegional(true)}
        >
          {profile?.region ?? "Region"}
          {regional ? " · selected" : ""}
        </Button>
      </View>
      <Copy kind="small" color={colors.muted}>
        Top 50 · Classic open season. Public handles appear after 10 rated games
        and opt-in through Edit profile.
      </Copy>
      {board.error ? (
        <Copy color={colors.violet}>{board.error}</Copy>
      ) : board.entries === null ? (
        <Copy>Loading leaderboard…</Copy>
      ) : board.entries.length === 0 ? (
        <Copy>No eligible players yet.</Copy>
      ) : (
        board.entries.map((entry) => (
          <View
            key={entry.handle}
            style={{
              gap: 4,
              paddingVertical: 8,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <Copy>
              {entry.rank}. @{entry.handle} · {entry.rating} Elo
            </Copy>
            <Copy kind="small" color={colors.muted}>
              {entry.region ?? "Global"} · {entry.games} games
            </Copy>
          </View>
        ))
      )}
      <Button secondary disabled={!enabled} onPress={board.refresh}>
        Refresh leaderboard
      </Button>
    </Panel>
  );
}
