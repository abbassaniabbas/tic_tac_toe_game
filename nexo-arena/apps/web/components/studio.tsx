"use client";
import { useState, useEffect } from "react";
import {
  analyzeClassic,
  type GameState,
  type UltimateState,
  type ReplayRecord,
} from "@nexo/engine";
import {
  COSMETICS,
  ACHIEVEMENTS,
  newRequestId,
  type Cosmetic,
} from "@nexo/online";
import { useAccount, useStudio, useSignatureMatch } from "@nexo/online/react";
import type { StudioStorage } from "@nexo/online/react";
import { Board } from "./board";
import { UltimateBoard } from "./ultimate-board";
export const webStudioStorage: StudioStorage = {
  getItem: async (key) => localStorage.getItem(key),
  setItem: async (key, value) => {
    localStorage.setItem(key, value);
  },
};
const newId = newRequestId;
const clock = (ms: number) =>
  `${Math.floor(Math.ceil(ms / 1000) / 60)}:${String(Math.ceil(ms / 1000) % 60).padStart(2, "0")}`;
function SignatureRoom({ id, leave }: { id: string; leave(): void }) {
  const [active, setActive] = useState(true);
  useEffect(() => {
    const update = () =>
      setActive(document.visibilityState === "visible" && navigator.onLine);
    update();
    document.addEventListener("visibilitychange", update);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  const { user } = useAccount(),
    room = useSignatureMatch(id, active),
    [confirm, setConfirm] = useState(false);
  const m = room.match,
    allowed =
      m?.phase === "active" &&
      m.players[m.game.turn] === user?.id &&
      !room.pending &&
      room.synced;
  return (
    <div className="studio-section">
      <button className="text-button" onClick={leave}>
        ← Studio rooms
      </button>
      {room.error && <p role="alert">{room.error}</p>}
      {m ? (
        <>
          <h3>
            {m.rulesVersion === "blitz-v1"
              ? "Blitz · 60 + 0"
              : "Ultimate · untimed"}{" "}
            · unrated
          </h3>
          <p role="status">
            {m.phase === "waiting"
              ? "Waiting for your friend"
              : m.phase === "active"
                ? `${m.game.turn} to move`
                : `${m.result ? (m.result === "draw" ? "Draw" : `${m.result} won`) : "Match closed"} · ${m.phase}`}
          </p>
          <p>
            {m.playerNames.X} (X) vs {m.playerNames.O ?? "A friend"} (O)
          </p>
          {room.clocks && (
            <div className="studio-clocks" aria-label="Server clocks">
              <strong>X {clock(room.clocks.X)}</strong>
              <strong>O {clock(room.clocks.O)}</strong>
            </div>
          )}
          {m.rulesVersion === "ultimate-v1" ? (
            <UltimateBoard
              game={m.game as UltimateState}
              disabled={!allowed}
              onMove={(move) => void room.act("move", newId(), move)}
            />
          ) : (
            <Board
              game={m.game as GameState}
              thinking={!allowed}
              onMove={(move) => void room.act("move", newId(), move)}
            />
          )}
          <p className="micro-copy">
            Server time decides Blitz deadlines. Clock display is an estimate.
            Leaving keeps accepted matches open.
          </p>
          {["waiting", "active"].includes(m.phase) && (
            <button
              className="button secondary"
              disabled={room.pending || !room.synced}
              onClick={() =>
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
            </button>
          )}
          <button className="text-button" onClick={() => void room.refresh()}>
            Refresh match
          </button>
        </>
      ) : (
        <p>Loading match…</p>
      )}
    </div>
  );
}
export function Studio({ initialInvite = "" }: { initialInvite?: string }) {
  const s = useStudio(webStudioStorage, newId, initialInvite),
    { user, api } = useAccount();
  const [tab, setTab] = useState<
    "ultimate" | "puzzle" | "replay" | "online" | "collection"
  >(initialInvite ? "online" : "ultimate");
  const analysis =
    s.position && !("boards" in s.position) ? analyzeClassic(s.position) : null;
  const accent = COSMETICS[s.color].color;
  return (
    <div
      className="studio"
      style={{ "--studio-accent": accent } as React.CSSProperties}
    >
      <p>One arena. More ways to think.</p>
      <div className="studio-tabs" role="group" aria-label="Studio sections">
        {(
          ["ultimate", "puzzle", "replay", "online", "collection"] as const
        ).map((t) => (
          <button
            className="button secondary"
            key={t}
            aria-pressed={tab === t}
            onClick={() => setTab(t)}
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
          </button>
        ))}
      </div>
      {s.error && <p role="alert">{s.error}</p>}
      {s.message && <p role="status">{s.message}</p>}
      {!s.ready ? (
        <p>Loading Studio…</p>
      ) : tab === "ultimate" ? (
        <section className="studio-section">
          <p className="eyebrow">LOCAL TWO-PLAYER · ULTIMATE</p>
          <h3>Nine boards. One win.</h3>
          <p>
            Win three small boards in a row. Your square sends the next player
            to that board. A closed destination allows any open board.
          </p>
          <p role="status">
            {s.ultimate.status === "playing"
              ? `${s.ultimate.turn} to move`
              : s.ultimate.winner
                ? `${s.ultimate.winner} won Ultimate`
                : "Ultimate draw"}
          </p>
          <UltimateBoard game={s.ultimate} onMove={s.ultimateMove} />
          <button className="button secondary" onClick={s.resetUltimate}>
            New Ultimate game
          </button>
        </section>
      ) : tab === "puzzle" ? (
        <section className="studio-section">
          <p className="eyebrow">{s.day} · UTC DAILY</p>
          <h3>{s.puzzle.title}</h3>
          <p>
            {s.puzzle.theme} Play {s.puzzle.solver}; the opponent replies with
            optimal Classic play.
          </p>
          <Board
            game={s.puzzleGame}
            thinking={s.puzzleGame.status !== "playing"}
            onMove={s.puzzleMove}
          />
          <p role="status">
            {s.puzzleGame.winner === s.puzzle.solver
              ? "Puzzle solved."
              : s.puzzleGame.status === "playing"
                ? "Find the forced win."
                : "Try another line."}
          </p>
          <div className="online-form-row">
            <button
              className="button secondary"
              disabled={s.puzzleGame.status !== "playing"}
              onClick={s.hint}
            >
              Show hint
            </button>
            <button className="button secondary" onClick={s.resetPuzzle}>
              Retry puzzle
            </button>
            <button
              className="button primary"
              disabled={
                s.pending || !user || s.puzzleGame.winner !== s.puzzle.solver
              }
              onClick={() => void s.verify()}
            >
              Verify daily solve
            </button>
          </div>
          <p className="micro-copy">
            Seven curated puzzles rotate on UTC dates. Offline practice is saved
            on this device. Sign in through Online to verify a solve.
          </p>
        </section>
      ) : tab === "replay" ? (
        <section className="studio-section">
          <h3>Every move, understood.</h3>
          <p>
            Review accepted moves or local practice. Branches are a sandbox and
            never change the saved match.
          </p>
          {s.records.length === 0 ? (
            <p>Finish a Classic or Ultimate game to add a replay.</p>
          ) : (
            <div className="studio-records">
              {s.records.map((r: ReplayRecord) => (
                <button
                  className="button secondary"
                  key={r.id}
                  disabled={s.pending}
                  onClick={() => s.selectReplay(r)}
                >
                  {r.source === "server" ? "Online" : "Local"} ·{" "}
                  {r.rule.replace("-v1", "")} · {r.moves.length} moves ·{" "}
                  {r.result ?? "open"}
                </button>
              ))}
            </div>
          )}
          {s.replay && s.position && (
            <>
              <p className="eyebrow">
                {s.replay.source === "server"
                  ? "ACCEPTED SERVER MOVES"
                  : "LOCAL PRACTICE"}{" "}
                ·{" "}
                {s.branching
                  ? "SANDBOX BRANCH"
                  : `MOVE ${s.step}/${s.replay.moves.length}`}
              </p>
              {"boards" in s.position ? (
                <UltimateBoard game={s.position} onMove={s.branchMove} />
              ) : (
                <Board
                  game={s.position}
                  thinking={s.position.status !== "playing"}
                  onMove={s.branchMove}
                />
              )}
              <div className="online-form-row">
                <button
                  className="button secondary"
                  onClick={() => s.navigate(0)}
                >
                  First
                </button>
                <button
                  className="button secondary"
                  disabled={!s.step}
                  onClick={() => s.navigate(s.step - 1)}
                >
                  Previous
                </button>
                <button
                  className="button secondary"
                  disabled={s.step === s.replay.moves.length}
                  onClick={() => s.navigate(s.step + 1)}
                >
                  Next
                </button>
                <button
                  className="button secondary"
                  onClick={() => s.navigate(s.replay!.moves.length)}
                >
                  Last
                </button>
                <button className="text-button" onClick={s.resetBranch}>
                  Reset branch
                </button>
              </div>
              {analysis && (
                <p>
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
                </p>
              )}
              {"boards" in s.position && (
                <p className="micro-copy">
                  Ultimate review shows routing and board claims. Exact analysis
                  is available for Classic and Blitz positions.
                </p>
              )}
            </>
          )}
        </section>
      ) : tab === "online" ? (
        <section className="studio-section">
          <h3>Blitz & Ultimate rooms</h3>
          <p>
            Blitz gives each player 60 seconds, without increment. Ultimate uses
            nine boards without a clock. Both are private, unrated games.
          </p>
          {!api || !user ? (
            <p>
              Sign in through Online to use shared rooms. Offline Ultimate and
              puzzles are available now.
            </p>
          ) : (
            <>
              <div className="online-form-row">
                <button
                  className="button primary"
                  disabled={s.pending}
                  onClick={() => void s.create("blitz-v1")}
                >
                  Create Blitz room
                </button>
                <button
                  className="button secondary"
                  disabled={s.pending}
                  onClick={() => void s.create("ultimate-v1")}
                >
                  Create Ultimate room
                </button>
              </div>
              {s.created && (
                <label>
                  Studio invitation
                  <input
                    readOnly
                    value={`${window.location.origin}/?studioInvite=${s.created}`}
                    onFocus={(e) => e.target.select()}
                  />
                </label>
              )}
              <label>
                Studio invitation link or code
                <input
                  value={s.invite}
                  onChange={(e) => s.setInvite(e.target.value)}
                />
              </label>
              <button
                className="button secondary"
                disabled={s.pending || !s.invite.trim()}
                onClick={() => void s.join()}
              >
                Join Studio room
              </button>
              {s.matchId ? (
                <SignatureRoom
                  id={s.matchId}
                  leave={() => {
                    s.setMatchId(null);
                    void s.refresh();
                  }}
                />
              ) : (
                s.online.map((m) => (
                  <button
                    className="button secondary"
                    key={m.matchId}
                    onClick={() => s.setMatchId(m.matchId)}
                  >
                    {m.rulesVersion.replace("-v1", "")} · {m.phase} ·{" "}
                    {m.playerNames.X} vs {m.playerNames.O ?? "waiting"}
                  </button>
                ))
              )}
            </>
          )}
          <button
            className="text-button"
            disabled={s.pending || !user}
            onClick={() => void s.refresh()}
          >
            Refresh online Studio
          </button>
        </section>
      ) : (
        <section className="studio-section">
          <h3>Your collection</h3>
          <p>
            Achievements come from accepted server results and verified daily
            solves. Local practice does not award them.
          </p>
          {Object.entries(ACHIEVEMENTS).map(([code, title]) => (
            <p key={code}>
              {s.extras?.achievements.some((a) => a.code === code) ? "✓" : "○"}{" "}
              {title}
            </p>
          ))}
          <h4>Signature board palettes</h4>
          {(Object.keys(COSMETICS) as Cosmetic[]).map((c) => {
            const theme = COSMETICS[c],
              unlocked =
                !theme.requires ||
                s.extras?.achievements.some((a) => a.code === theme.requires);
            return (
              <button
                className="button secondary"
                key={c}
                disabled={s.pending || !unlocked}
                aria-pressed={s.color === c}
                onClick={() => void s.setColor(c)}
              >
                {theme.name}
                {unlocked ? "" : ` · ${ACHIEVEMENTS[theme.requires!]}`}
              </button>
            );
          })}
          <p className="micro-copy">
            Palette changes affect Studio marks only. Blue and Silver are
            available offline.
          </p>
          <button
            className="text-button"
            disabled={s.pending || !user}
            onClick={() => void s.refresh()}
          >
            Refresh collection
          </button>
        </section>
      )}
    </div>
  );
}
