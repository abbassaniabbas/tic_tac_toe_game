"use client";
import { useEffect, useState, useRef } from "react";
import { useAccount, useOnlineMatch } from "@nexo/online/react";
import {
  validEmail,
  validHandle,
  onlineStatus,
  ratingSummary,
  type Profile,
  type OnlineMatch,
} from "@nexo/online";
import { Board } from "./board";
import { RankedPanel } from "./ranked-panel";
function ProfileEditor({ profile }: { profile: Profile }) {
  const { api, reloadProfile } = useAccount();
  const [name, setName] = useState(profile.display_name);
  const [handle, setHandle] = useState(profile.handle ?? "");
  const [region, setRegion] = useState(profile.region ?? "");
  const [locale, setLocale] = useState(profile.locale);
  const [visible, setVisible] = useState(profile.leaderboard_visible ?? false);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  return (
    <form
      className="online-form"
      onSubmit={async (event) => {
        event.preventDefault();
        if (pendingRef.current) return;
        if (
          !name.trim() ||
          name.trim().length > 24 ||
          /[\u0000-\u001f]/.test(name) ||
          (handle && !validHandle(handle)) ||
          (region && !/^[A-Z]{2}$/.test(region)) ||
          !/^[a-z]{2}(-[A-Z]{2})?$/.test(locale)
        ) {
          setMessage(
            "Use a name, a 3–20 character lowercase handle, a two-letter region and a valid locale.",
          );
          return;
        }
        pendingRef.current = true;
        setPending(true);
        try {
          await api?.saveProfile({
            display_name: name.trim(),
            handle: handle || null,
            locale,
            region: region || null,
            leaderboard_visible: visible,
          });
          await reloadProfile();
          setMessage("Profile saved.");
        } catch (e) {
          setMessage(e instanceof Error ? e.message : "Save failed.");
        } finally {
          pendingRef.current = false;
          setPending(false);
        }
      }}
    >
      <label>
        Display name
        <input
          value={name}
          maxLength={24}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label>
        Handle
        <input
          value={handle}
          maxLength={20}
          placeholder="your_handle"
          autoCapitalize="none"
          onChange={(e) => setHandle(e.target.value.toLowerCase())}
        />
      </label>
      <div className="online-form-row">
        <label>
          Region (optional)
          <input
            value={region}
            maxLength={2}
            placeholder="NG"
            onChange={(e) => setRegion(e.target.value.toUpperCase())}
          />
        </label>
        <label>
          Locale
          <input
            value={locale}
            maxLength={5}
            onChange={(e) => setLocale(e.target.value)}
          />
        </label>
      </div>
      <label className="leaderboard-consent">
        <input
          type="checkbox"
          checked={visible}
          onChange={(e) => setVisible(e.target.checked)}
        />
        Show my handle and region on ranked leaderboards after 10 rated games
      </label>
      <button className="button secondary" disabled={pending}>
        Save profile
      </button>
      <p role="status">{message}</p>
    </form>
  );
}
function ConnectedBoard({ id, onLeave }: { id: string; onLeave(): void }) {
  const { user } = useAccount();
  const { match, connection, error, pending, synchronized, act, refresh } =
    useOnlineMatch(id);
  const [confirm, setConfirm] = useState(false);
  const myTurn =
    match?.phase === "active" && match.players[match.game.turn] === user?.id;
  return (
    <div className="online-match">
      <div className="online-form-row">
        <button className="text-button" onClick={onLeave}>
          ← Rooms & history
        </button>
        <span className="eyebrow">
          {connection === "live"
            ? "Connected"
            : connection === "reconnecting"
              ? "Reconnecting"
              : "Connecting"}
        </span>
      </div>
      {error && <p role="alert">{error}</p>}
      {match ? (
        <>
          <h3 role="status" aria-live="polite">
            {onlineStatus(match, user!.id)}
          </h3>
          <p>
            {match.playerNames.X ?? "Deleted player"} (X) vs{" "}
            {match.playerNames.O ?? "A friend"} (O)
          </p>
          <p className="micro-copy">{ratingSummary(match, user!.id)}</p>
          <Board
            game={match.game}
            thinking={!myTurn || pending || !synchronized}
            onMove={(square) => {
              void act("move", crypto.randomUUID(), square);
            }}
          />
          {match.phase === "waiting" && (
            <p>Share your invitation. It expires in 10 minutes.</p>
          )}
          {["waiting", "active"].includes(match.phase) && (
            <>
              {confirm ? (
                <div className="online-form-row">
                  <button
                    className="button secondary"
                    disabled={pending}
                    onClick={() => {
                      void act("end", crypto.randomUUID());
                      setConfirm(false);
                    }}
                  >
                    {match.phase === "waiting"
                      ? "Cancel invitation"
                      : "Confirm resignation"}
                  </button>
                  <button
                    className="text-button"
                    onClick={() => setConfirm(false)}
                  >
                    Keep playing
                  </button>
                </div>
              ) : (
                <button
                  className="text-button"
                  onClick={() => setConfirm(true)}
                >
                  {match.phase === "waiting"
                    ? "Cancel invitation"
                    : "Resign match"}
                </button>
              )}
            </>
          )}
          <button
            className="text-button"
            onClick={() => {
              void refresh();
            }}
          >
            Refresh match
          </button>
        </>
      ) : (
        <p role="status">Loading your match…</p>
      )}
      <p className="micro-copy">
        Leaving this screen keeps your match open. Moves need a connection.
      </p>
    </div>
  );
}
export function OnlinePanel({
  initialInvite = "",
}: {
  initialInvite?: string;
}) {
  const { client, api, user, ready, profile, error, reloadProfile, signOut } =
    useAccount();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [invite, setInvite] = useState(initialInvite);
  const [created, setCreated] = useState("");
  const [matchId, setMatchId] = useState<string | null>(null);
  const [history, setHistory] = useState<OnlineMatch[]>([]);
  const [rooms, setRooms] = useState<OnlineMatch[]>([]);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const createRequest = useRef<string | null>(null);
  const pendingRef = useRef(false);
  useEffect(() => {
    if (!user || !api) {
      setMatchId(null);
      setHistory([]);
      setRooms([]);
      createRequest.current = null;
      setCreated("");
      return;
    }
    let alive = true;
    Promise.all([api.history(), api.rooms()])
      .then(([matches, live]) => {
        if (alive) {
          setHistory(matches);
          setRooms(live);
        }
      })
      .catch(() => {
        if (alive)
          setMessage("History could not be loaded. Try reopening online play.");
      });
    return () => {
      alive = false;
    };
  }, [api, user, matchId, created]);
  async function run(action: () => Promise<void>) {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setMessage("");
    try {
      await action();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Please try again.");
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }
  if (!ready) return <p role="status">Restoring your account…</p>;
  if (!client || !api)
    return (
      <>
        <p>
          Online play is unavailable in this build. Challenge the AI or play a
          friend on this device.
        </p>
        <p className="micro-copy">
          Your offline games are ready whenever you are.
        </p>
      </>
    );
  if (!user)
    return (
      <form
        className="online-form"
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            if (!validEmail(email.trim()))
              throw new Error("Enter a valid email address.");
            if (sent) {
              const { error } = await client!.auth.verifyOtp({
                email: email.trim(),
                token: code.trim(),
                type: "email",
              });
              if (error)
                throw new Error(
                  "The code is invalid or expired. Request a new one.",
                );
            } else {
              const { error } = await client!.auth.signInWithOtp({
                email: email.trim(),
              });
              if (error)
                throw new Error(
                  "Could not send a code. Please try again shortly.",
                );
              setSent(true);
            }
          });
        }}
      >
        <p>
          Sign in to invite a friend and keep your online matches across
          devices.
        </p>
        <label>
          Email
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            disabled={sent}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        {sent && (
          <>
            <label>
              Sign-in code
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6,10}"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </label>
            <p>Check your email for your sign-in code.</p>
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setSent(false);
                setCode("");
              }}
            >
              Use another email or request a new code
            </button>
          </>
        )}
        <button className="button primary" disabled={pending}>
          {sent ? "Verify code" : "Send sign-in code"}
        </button>
        <p role="alert">{message}</p>
      </form>
    );
  if (matchId)
    return <ConnectedBoard id={matchId} onLeave={() => setMatchId(null)} />;
  return (
    <div className="online-form">
      <div className="online-form-row">
        <p>Welcome, {profile?.display_name ?? "Player"}.</p>
        <button
          className="text-button"
          onClick={() => {
            void run(signOut);
          }}
        >
          Sign out
        </button>
      </div>
      {error && (
        <p role="alert">
          {error}
          <button
            className="text-button"
            onClick={() => {
              void run(reloadProfile);
            }}
          >
            Retry
          </button>
        </p>
      )}
      <RankedPanel onOpen={setMatchId} />
      <p>
        Create an unrated private invitation or paste one from a friend. The
        host plays X.
      </p>
      <button
        className="button primary"
        disabled={pending}
        onClick={() => {
          void run(async () => {
            createRequest.current ??= crypto.randomUUID();
            const result = await api.createRoom(createRequest.current);
            setCreated(result.invite);
            setInvite(result.invite);
            createRequest.current = null;
          });
        }}
      >
        Create invitation
      </button>
      {created && (
        <div className="invite-card">
          <label>
            Invitation link
            <input
              readOnly
              value={`${window.location.origin}/?invite=${created}`}
              onFocus={(e) => e.target.select()}
            />
          </label>
          <div className="online-form-row">
            <button
              className="button secondary"
              onClick={() => {
                void run(async () => {
                  await navigator.clipboard.writeText(
                    `${window.location.origin}/?invite=${created}`,
                  );
                  setMessage("Invitation copied.");
                });
              }}
            >
              Copy invitation
            </button>
            <button
              className="button secondary"
              onClick={() => {
                void run(async () => {
                  const match = await api.join(created, crypto.randomUUID());
                  setMatchId(match.matchId);
                });
              }}
            >
              Open room
            </button>
          </div>
        </div>
      )}
      <label>
        Invitation code or link
        <input
          value={invite}
          onChange={(e) => setInvite(e.target.value.trim())}
          placeholder="Paste an invitation"
          autoCapitalize="none"
        />
      </label>
      <button
        className="button secondary"
        disabled={pending || !invite}
        onClick={() => {
          void run(async () => {
            let token = invite;
            try {
              const url = new URL(invite);
              token =
                url.searchParams.get("invite") ??
                url.pathname.split("/").pop() ??
                "";
            } catch {}
            const match = await api.join(token, crypto.randomUUID());
            setMatchId(match.matchId);
          });
        }}
      >
        Join invitation
      </button>
      <h3>Your open rooms</h3>
      {!rooms.length ? (
        <p>No open rooms.</p>
      ) : (
        rooms.map((match) => (
          <button
            className="history-row"
            key={match.matchId}
            onClick={() => setMatchId(match.matchId)}
          >
            {onlineStatus(match, user.id)} →
          </button>
        ))
      )}
      <h3>Your online match history</h3>
      {!history.length ? (
        <p>No completed online matches yet.</p>
      ) : (
        history.map((match) => (
          <button
            className="history-row"
            key={match.matchId}
            onClick={() => setMatchId(match.matchId)}
          >
            <span>{onlineStatus(match, user.id)}</span>
            <span>{new Date(match.updatedAt).toLocaleDateString()} →</span>
          </button>
        ))
      )}
      <button className="text-button" onClick={() => setEditing(!editing)}>
        {editing ? "Close profile" : "Edit profile"}
      </button>
      {editing && profile && <ProfileEditor profile={profile} />}
      <button className="text-button" onClick={() => setDeleting(!deleting)}>
        Delete account
      </button>
      {deleting && (
        <div className="invite-card">
          <p>
            Delete your account and profile permanently? Accepted matches remain
            anonymously in your opponents’ histories. Offline games stay on this
            device.
          </p>
          <button
            className="button secondary"
            disabled={pending}
            onClick={() => {
              void run(async () => {
                await api.deleteAccount();
                setDeleting(false);
              });
            }}
          >
            Permanently delete account
          </button>
          <button className="text-button" onClick={() => setDeleting(false)}>
            Cancel
          </button>
        </div>
      )}
      <p role="alert">{message}</p>
    </div>
  );
}
