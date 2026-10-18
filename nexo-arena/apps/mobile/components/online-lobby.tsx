import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Share,
  Switch,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import * as Crypto from "expo-crypto";
import {
  onlineStatus,
  validEmail,
  validHandle,
  type OnlineMatch,
  type Profile,
} from "@nexo/online";
import { useAccount } from "@nexo/online/react";
import { useArena } from "../lib/arena-provider";
import { invitationLink } from "../lib/online";
import { Button, Copy, Panel } from "./ui";
import { RankedPanel } from "./ranked-panel";
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const { colors } = useArena();
  return (
    <View style={{ gap: 8 }}>
      <Copy kind="small" color={colors.muted}>
        {label}
      </Copy>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
        style={{
          color: colors.text,
          backgroundColor: colors.raised,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 12,
          minHeight: 52,
          paddingHorizontal: 14,
          paddingVertical: 12,
          fontFamily: "Manrope",
          fontSize: 15,
        }}
        {...props}
      />
    </View>
  );
}
function ProfileEditor({ profile }: { profile: Profile }) {
  const { api, reloadProfile } = useAccount();
  const [name, setName] = useState(profile.display_name);
  const [handle, setHandle] = useState(profile.handle ?? "");
  const [region, setRegion] = useState(profile.region ?? "");
  const [locale, setLocale] = useState(profile.locale);
  const [visible, setVisible] = useState(profile.leaderboard_visible ?? false);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const lock = useRef(false);
  async function save() {
    if (lock.current || !api) return;
    lock.current = true;
    setPending(true);
    try {
      if (
        !name.trim() ||
        (handle && !validHandle(handle)) ||
        !/^([A-Z]{2})?$/.test(region) ||
        !/^([a-z]{2})(-[A-Z]{2})?$/.test(locale)
      )
        throw new Error(
          "Enter a name, a handle of 3–20 lowercase letters, numbers or underscores, and a valid locale (such as en or en-NG).",
        );
      await api.saveProfile({
        display_name: name.trim(),
        handle: handle || null,
        region: region || null,
        locale,
        leaderboard_visible: visible,
      });
      await reloadProfile();
      setMessage("Profile saved.");
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Could not save your profile.",
      );
    } finally {
      lock.current = false;
      setPending(false);
    }
  }
  return (
    <Panel>
      <Field
        label="Display name"
        maxLength={24}
        value={name}
        onChangeText={setName}
      />
      <Field
        label="Handle"
        maxLength={20}
        value={handle}
        onChangeText={(v) => setHandle(v.toLowerCase())}
      />
      <Field
        label="Region (optional)"
        maxLength={2}
        value={region}
        placeholder="NG"
        onChangeText={(v) => setRegion(v.toUpperCase())}
      />
      <Field
        label="Locale"
        maxLength={5}
        value={locale}
        onChangeText={setLocale}
      />
      <Copy kind="small">
        Show my handle and region on ranked leaderboards after 10 rated games
      </Copy>
      <Switch
        accessibilityLabel="Public leaderboard visibility"
        value={visible}
        onValueChange={setVisible}
      />
      <Button
        disabled={pending}
        onPress={() => {
          void save();
        }}
      >
        Save profile
      </Button>
      <Copy kind="small">{message}</Copy>
    </Panel>
  );
}
export function OnlineLobby({
  initialInvite = "",
}: {
  initialInvite?: string;
}) {
  const { client, api, user, ready, profile, error, reloadProfile, signOut } =
    useAccount();
  const { colors } = useArena();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [invite, setInvite] = useState(initialInvite);
  const [created, setCreated] = useState<{
    token: string;
    matchId: string;
  } | null>(null);
  const [history, setHistory] = useState<OnlineMatch[]>([]);
  const [rooms, setRooms] = useState<OnlineMatch[]>([]);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const lock = useRef(false);
  const createRequest = useRef<string | null>(null);
  const userId = user?.id;
  useEffect(() => {
    setCreated(null);
    setHistory([]);
    setRooms([]);
    setDeleting(false);
    setEditing(false);
    createRequest.current = null;
  }, [userId]);
  useFocusEffect(
    useCallback(() => {
      if (!api || !userId) return;
      let alive = true;
      Promise.all([api.history(), api.rooms()])
        .then(([value, live]) => {
          if (alive) {
            setHistory(value);
            setRooms(live);
          }
        })
        .catch(() => {
          if (alive)
            setMessage(
              "Online history could not be loaded. Reopen this screen to retry.",
            );
        });
      return () => {
        alive = false;
      };
    }, [api, userId]),
  );
  async function run(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    setMessage("");
    try {
      await action();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Please try again.");
    } finally {
      lock.current = false;
      setPending(false);
    }
  }
  if (!ready) return <Copy>Restoring your account…</Copy>;
  if (!client || !api)
    return (
      <Panel>
        <Copy kind="title">Play together.</Copy>
        <Copy color={colors.muted}>
          Online play is unavailable in this build. Challenge the AI or play a
          friend on this device.
        </Copy>
        <Button onPress={() => router.replace("/")}>Play offline →</Button>
      </Panel>
    );
  if (!user)
    return (
      <Panel>
        <Copy kind="title">Your next rival.</Copy>
        <Copy color={colors.muted}>
          Sign in to invite a friend and keep your online matches across
          devices.
        </Copy>
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          editable={!sent && !pending}
          keyboardType="email-address"
          autoComplete="email"
        />
        {sent && (
          <>
            <Field
              label="Sign-in code"
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              maxLength={10}
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
            />
            <Copy kind="small">Check your email for your sign-in code.</Copy>
            <Button
              secondary
              disabled={pending}
              onPress={() => {
                setSent(false);
                setCode("");
              }}
            >
              Use another email / resend
            </Button>
          </>
        )}
        <Button
          disabled={pending}
          onPress={() => {
            void run(async () => {
              if (!validEmail(email.trim()))
                throw new Error("Enter a valid email address.");
              if (sent) {
                if (!/^\d{6,10}$/.test(code.trim()))
                  throw new Error("Enter the 6–10 digit code from your email.");
                const { error } = await client.auth.verifyOtp({
                  email: email.trim(),
                  token: code.trim(),
                  type: "email",
                });
                if (error)
                  throw new Error(
                    "The code is invalid or expired. Request a new one.",
                  );
              } else {
                const { error } = await client.auth.signInWithOtp({
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
          {pending
            ? "Please wait…"
            : sent
              ? "Verify code"
              : "Send sign-in code"}
        </Button>
        {message && <Copy color={colors.violet}>{message}</Copy>}
      </Panel>
    );
  return (
    <>
      <Copy kind="title">Welcome, {profile?.display_name ?? "Player"}.</Copy>
      <RankedPanel />
      <Copy color={colors.muted}>
        Unrated private matches. Shared across devices. The host plays X.
      </Copy>
      {error && (
        <Panel>
          <Copy color={colors.violet}>{error}</Copy>
          <Button
            secondary
            disabled={pending}
            onPress={() => {
              void run(reloadProfile);
            }}
          >
            Retry profile
          </Button>
        </Panel>
      )}
      <Button
        disabled={pending}
        onPress={() => {
          void run(async () => {
            createRequest.current ??= Crypto.randomUUID();
            const result = await api.createRoom(createRequest.current);
            setCreated({ token: result.invite, matchId: result.match.matchId });
            setInvite(result.invite);
            setRooms((old) => [
              result.match,
              ...old.filter((m) => m.matchId !== result.match.matchId),
            ]);
            createRequest.current = null;
          });
        }}
      >
        Create invitation
      </Button>
      {created && (
        <Panel>
          <Copy kind="label" color={colors.blue}>
            YOUR INVITATION
          </Copy>
          <Field
            label="Invitation link or code"
            value={invitationLink(created.token)}
            editable={false}
            multiline
          />
          <Copy kind="small">
            Expires in 10 minutes. Share with one friend.
          </Copy>
          <Button
            secondary
            disabled={pending}
            onPress={() => {
              void run(async () => {
                await Share.share({ message: invitationLink(created.token) });
              });
            }}
          >
            Share invitation
          </Button>
          <Button
            onPress={() => router.push(`/online-match/${created.matchId}`)}
          >
            Open room →
          </Button>
        </Panel>
      )}
      <Panel>
        <Field
          label="Invitation code or link"
          value={invite}
          onChangeText={setInvite}
          placeholder="Paste an invitation"
        />
        <Button
          secondary
          disabled={pending || !invite.trim()}
          onPress={() => {
            void run(async () => {
              let token = invite.trim();
              try {
                const url = new URL(token);
                token =
                  url.searchParams.get("invite") ??
                  url.pathname.split("/").pop() ??
                  "";
              } catch {}
              if (!/^[a-f0-9]{48}$/.test(token))
                throw new Error("Enter a valid invitation code or link.");
              const match = await api.join(token, Crypto.randomUUID());
              router.push(`/online-match/${match.matchId}`);
            });
          }}
        >
          Join invitation
        </Button>
      </Panel>
      <Copy kind="title">Open rooms</Copy>
      {!rooms.length ? (
        <Copy color={colors.muted}>No open rooms.</Copy>
      ) : (
        rooms.map((match) => (
          <Button
            key={match.matchId}
            secondary
            onPress={() => router.push(`/online-match/${match.matchId}`)}
          >
            {onlineStatus(match, user.id)} →
          </Button>
        ))
      )}
      <Copy kind="title">Online history</Copy>
      {!history.length ? (
        <Copy color={colors.muted}>No completed online matches yet.</Copy>
      ) : (
        history.map((match) => (
          <Button
            key={match.matchId}
            secondary
            onPress={() => router.push(`/online-match/${match.matchId}`)}
          >
            {onlineStatus(match, user.id)} ·{" "}
            {new Date(match.updatedAt).toLocaleDateString()} →
          </Button>
        ))
      )}
      <Button secondary disabled={pending} onPress={() => setEditing(!editing)}>
        {editing ? "Close profile" : "Edit profile"}
      </Button>
      {editing && profile && <ProfileEditor profile={profile} />}
      <Button
        secondary
        disabled={pending}
        onPress={() => {
          void run(signOut);
        }}
      >
        Sign out
      </Button>
      <Button
        secondary
        disabled={pending}
        onPress={() => setDeleting(!deleting)}
      >
        Delete account
      </Button>
      {deleting && (
        <Panel>
          <Copy>
            Delete your account and profile permanently? Accepted matches remain
            anonymously in your opponents’ histories. Offline games stay on this
            device.
          </Copy>
          <Button
            disabled={pending}
            onPress={() => {
              void run(async () => {
                await api.deleteAccount();
                setDeleting(false);
              });
            }}
          >
            Permanently delete account
          </Button>
          <Button secondary onPress={() => setDeleting(false)}>
            Cancel
          </Button>
        </Panel>
      )}
      {message && <Copy color={colors.violet}>{message}</Copy>}
    </>
  );
}
