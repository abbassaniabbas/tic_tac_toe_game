"use client";
import { useEffect, useState } from "react";
import { useAccount, useLeaderboard, useMatchmaking } from "@nexo/online/react";
export function RankedPanel({ onOpen }: { onOpen(id: string): void }) {
  const { profile } = useAccount();
  const [active, setActive] = useState(true);
  const [regional, setRegional] = useState(false);
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
  const { queue, pending, error, enter, cancel, refresh } =
    useMatchmaking(active);
  const board = useLeaderboard(
    regional ? (profile?.region ?? null) : null,
    active,
  );
  const waiting = queue?.status === "waiting";
  return (
    <section className="ranked-panel" aria-label="Ranked Classic">
      <div className="ranked-heading">
        <div>
          <p className="eyebrow">CLASSIC · UNTIMED</p>
          <h3>Find your next rival.</h3>
        </div>
        {queue && (
          <div className="ranked-rating">
            <strong>{queue.rating.value}</strong>
            <span>
              Elo ·{" "}
              {queue.rating.provisional
                ? `${queue.rating.games}/10 placements`
                : `${queue.rating.games} rated games`}
            </span>
          </div>
        )}
      </div>
      <p>
        Match with a player near your rating. We prefer your selected region for
        15 seconds, then widen the search globally.
      </p>
      {!active ? (
        <p role="status">Reconnect and return to this window to search.</p>
      ) : !queue && !error ? (
        <p role="status">Loading ranked play…</p>
      ) : queue?.match ? (
        <button
          className="button primary"
          onClick={() => onOpen(queue.match!.matchId)}
        >
          Open ranked match →
        </button>
      ) : waiting ? (
        <div className="online-form-row">
          <p role="status">Searching for an opponent…</p>
          <button
            className="button secondary"
            disabled={pending}
            onClick={() => void cancel()}
          >
            Cancel search
          </button>
        </div>
      ) : (
        <>
          <button
            className="button primary"
            disabled={pending || !queue || !active}
            onClick={() => void enter(crypto.randomUUID())}
          >
            {pending ? "Starting search…" : "Find ranked match"}
          </button>
          {queue?.status === "expired" && (
            <p>Your search expired. Start a new search when you’re ready.</p>
          )}
        </>
      )}
      {error && <p role="alert">{error}</p>}
      <button
        className="text-button"
        disabled={pending || !active}
        onClick={() => void refresh()}
      >
        Refresh ranked play
      </button>
      <p className="micro-copy">
        Leaving the lobby cancels an unmatched search. An accepted match stays
        open. Resignation counts as a rated loss.
      </p>
      <div className="ranked-heading">
        <h4>Leaderboard</h4>
        <div className="online-form-row">
          <button
            className="text-button"
            aria-pressed={!regional}
            onClick={() => setRegional(false)}
          >
            Global
          </button>
          <button
            className="text-button"
            aria-pressed={regional}
            disabled={!profile?.region}
            onClick={() => setRegional(true)}
          >
            {profile?.region ?? "Region"}
          </button>
        </div>
      </div>
      <p className="micro-copy">
        Public handles appear after 10 rated games and opt-in through Edit
        profile. Top 50 players · Classic open season.
      </p>
      {board.error ? (
        <p role="alert">{board.error}</p>
      ) : board.entries === null ? (
        <p role="status">Loading leaderboard…</p>
      ) : board.entries.length === 0 ? (
        <p>No eligible players yet.</p>
      ) : (
        <ol className="ranked-leaderboard">
          {board.entries.map((entry) => (
            <li key={entry.handle}>
              <span>
                <strong>{entry.rank.toString().padStart(2, "0")}</strong> @
                {entry.handle}
                <small>
                  {entry.region ?? "Global"} · {entry.games} games
                </small>
              </span>
              <b>{entry.rating}</b>
            </li>
          ))}
        </ol>
      )}
      <button
        className="text-button"
        onClick={board.refresh}
        disabled={!active}
      >
        Refresh leaderboard
      </button>
    </section>
  );
}
