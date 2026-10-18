import { useState } from "react";
import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import * as Crypto from "expo-crypto";
import { isUuid, onlineStatus, ratingSummary } from "@nexo/online";
import { useAccount, useOnlineMatch } from "@nexo/online/react";
import { useArena } from "../../lib/arena-provider";
import { Board } from "../../components/board";
import { Brand, Button, Copy, Panel, Screen } from "../../components/ui";
export default function OnlineMatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { active, colors } = useArena();
  const { user, client, ready } = useAccount();
  const [focused, setFocused] = useState(false);
  const [confirm, setConfirm] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  const { match, connection, error, pending, synchronized, act, refresh } =
    useOnlineMatch(isUuid(id) ? id : null, active && focused);
  const myTurn =
    match?.phase === "active" && match.players[match.game.turn] === user?.id;
  return (
    <Screen>
      <Brand />
      <Button secondary onPress={() => router.replace("/online")}>
        ← Rooms & history
      </Button>
      {!isUuid(id) ? (
        <Copy>Invalid match link.</Copy>
      ) : !ready ? (
        <Copy>Restoring your account…</Copy>
      ) : !client ? (
        <Copy>Online play is unavailable in this build.</Copy>
      ) : !user ? (
        <>
          <Copy>Sign in to open your private match.</Copy>
          <Button onPress={() => router.replace("/online")}>Sign in</Button>
        </>
      ) : (
        <>
          <Copy kind="label" color={colors.blue}>
            {connection === "live"
              ? "CONNECTED"
              : connection === "reconnecting"
                ? "RECONNECTING"
                : "CONNECTING"}
          </Copy>
          {error && <Copy color={colors.violet}>{error}</Copy>}
          {match ? (
            <>
              <Copy kind="title">{onlineStatus(match, user.id)}</Copy>
              <Copy kind="small" color={colors.muted}>
                {ratingSummary(match, user.id)}
              </Copy>
              <Copy color={colors.muted}>
                {match.playerNames.X ?? "Deleted player"} (X) vs{" "}
                {match.playerNames.O ?? "A friend"} (O)
              </Copy>
              <Board
                game={match.game}
                disabled={
                  !myTurn || pending || !synchronized || !active || !focused
                }
                onMove={(square) => {
                  void act("move", Crypto.randomUUID(), square);
                }}
              />
              {match.phase === "waiting" && (
                <Copy color={colors.muted}>
                  Your invitation expires in 10 minutes. Return to rooms to
                  share it.
                </Copy>
              )}
              {["waiting", "active"].includes(match.phase) &&
                (confirm ? (
                  <Panel>
                    <Copy>
                      {match.phase === "waiting"
                        ? "Cancel this invitation?"
                        : "Resign this match? Your opponent will win."}
                    </Copy>
                    <Button
                      disabled={pending}
                      onPress={() => {
                        void act("end", Crypto.randomUUID());
                        setConfirm(false);
                      }}
                    >
                      {match.phase === "waiting"
                        ? "Cancel invitation"
                        : "Confirm resignation"}
                    </Button>
                    <Button secondary onPress={() => setConfirm(false)}>
                      Keep playing
                    </Button>
                  </Panel>
                ) : (
                  <Button
                    secondary
                    disabled={pending}
                    onPress={() => setConfirm(true)}
                  >
                    {match.phase === "waiting"
                      ? "Cancel invitation"
                      : "Resign match"}
                  </Button>
                ))}
            </>
          ) : (
            <Copy>Loading your match…</Copy>
          )}
          <Button
            secondary
            onPress={() => {
              void refresh();
            }}
          >
            Refresh match
          </Button>
          <Copy kind="small" color={colors.muted}>
            Leaving this screen keeps your match open. Moves need a connection.
          </Copy>
        </>
      )}
    </Screen>
  );
}
