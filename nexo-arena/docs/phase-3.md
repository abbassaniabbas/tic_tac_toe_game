# Phase 3: accounts and private online matches

Phase 3 implements the identity and private-match steps in the roadmap. `@nexo/online` connects the existing Next.js website and native Expo screens to one Supabase backend. AI/local guest games continue without an account or a backend configuration.

This page describes the Phase 3 delivery. [Phase 4](phase-4.md) adds ranked Classic, and [Phase 5](phase-5.md) adds Signature Studio to the same backend. Current clients require all three migrations.

## Delivered

- Email code sign-in, session restoration, local sign-out and account deletion.
- Protected profiles with display name, optional unique lowercase handle, locale and optional two-letter region.
- Private invitations with 192-bit tokens, SHA-256 digests, ten-minute join expiry and one guest per room. Host plays X.
- Server-approved classic moves, immutable results, revision checks, idempotent commands and accepted-move logs.
- Open rooms for resuming games across devices, separate participant-only online history and retained anonymous history after account deletion.
- Realtime update notifications plus authoritative refetch and five-second polling to recover missed updates. Native subscriptions and auth refresh follow navigation/app lifecycle.
- Native sessions in Expo SecureStore, split into small entries with an atomic manifest switch. Offline games/preferences remain in AsyncStorage. Browser sessions use the SDK's browser storage.

## Run the backend locally

Install Docker and the Supabase CLI. Run from `nexo-arena`:

```bash
supabase start
cp supabase/.env.example supabase/.env.local
openssl rand -hex 32
```

Paste the generated value into `INVITE_SIGNING_SECRET` in the ignored `supabase/.env.local`, then run:

```bash
supabase functions serve arena --env-file supabase/.env.local
```

`supabase start` applies the migration to a new local stack. When adding a migration to an existing local stack, use `supabase migration up --local`. Avoid `db reset` unless its data can be discarded.

| Service | Local address |
| --- | --- |
| API / Edge Function | `http://127.0.0.1:54341` |
| Database | port `54342` |
| Studio | `http://127.0.0.1:54343` |
| Local email inbox | `http://127.0.0.1:54344` |

Use the local API URL and **publishable key** from `supabase status`; a legacy `anon` key is also accepted. Keep admin/service-role keys server-side.

Copy `apps/web/.env.example` to `apps/web/.env.local`, fill its public URL/key, and run `npm run dev`. Copy `apps/mobile/.env.example` to `apps/mobile/.env`, fill its matching public URL/key, and run `npm run mobile`. Restart servers after changing variables. Production variables are baked into their respective builds.

On an Android emulator, use `http://10.0.2.2:54341`. The iOS simulator can use `http://127.0.0.1:54341`. A physical phone needs the computer's LAN IP and access to the backend port. Local HTTP is for development; use HTTPS for a hosted backend. Standalone mobile builds also need suitable platform transport settings for LAN HTTP; device behavior has not been verified here.

For local email tests, use two addresses such as `ada@example.test` and `bayo@example.test`. Read their codes in the local inbox; local email stays in that inbox. This implementation uses six-digit codes and `verifyOtp(type: 'email')`; it does not depend on redirect callbacks. The local templates show the token explicitly. On a hosted project, configure both **Magic Link** and **Confirm signup** templates to include `{{ .Token }}`, six-digit OTPs, expiry, resend limits and a working SMTP service before enabling sign-in.

To share browser links across platforms, set `EXPO_PUBLIC_WEB_URL` to the real HTTPS website. Native share otherwise provides a pasteable invitation code. The website opens invitations at `/?invite=TOKEN`, retaining the existing static hosting setup. Standalone native builds recognize `nexoarena://invite/TOKEN` (use the variant scheme for development/preview). Verified Universal/App Links still require a real domain and association files.

## Architecture and access

```text
Web / native account UI
    → Supabase Auth (email OTP, refresh)
    → arena Edge Function (auth.getUser validates the bearer token)
    → shared @nexo/engine validates the next game
    → service-only SQL command locks and atomically commits
    → RLS-filtered Realtime notification / private snapshot fetch
```

`supabase/functions/arena/core.ts` imports the same TypeScript engine as both clients. The request never supplies a trusted board or winner. SQL locks the player and match, verifies membership, phase, turn, revision and occupancy, and appends a move with the new snapshot in one transaction. Concurrent guests/moves and duplicate requests cannot double-commit. A receipt returns the original successful response for a repeated request ID; reusing that ID for different input is rejected.

`profiles`, `online_matches` and `online_moves` have RLS. Profile reads and permitted edits are owner-only; match/move reads require participation. Clients have no direct match or move write permission and cannot call privileged command RPCs. Invite digests and receipts live in an unexposed private schema. Definer functions fix their search paths and revoke public/anonymous/authenticated execution.

The function's `verify_jwt = false` disables the gateway's legacy JWT-key check; **every POST still validates its bearer token with Supabase Auth**. This supports modern publishable keys. No identity is trusted from the body. Realtime uses Postgres Changes filtered by match ID and the same table SELECT policy; it is not an unrestricted broadcast channel. Events only trigger an authenticated fetch. Snapshots are reconstructed and validated against the engine; old revisions are ignored. Polling remains a recovery path if the channel fails.

Keep `INVITE_SIGNING_SECRET` stable. It derives retryable invitation tokens without storing plaintext tokens. If omitted, the server service-role key is the fallback, so rotating that key affects invitation retry consistency. Configure the separate signing secret for hosted use.

Creating rooms is limited to three current waiting rooms and twenty creations per hour per profile. Invalid tokens reveal no match data. This private-match phase has no public matchmaking, presence adjudication, disconnect forfeit clock, Elo, leaderboard or ranked result claims. A network disconnect leaves the match open for resumption.

Deletion removes the profile, detaches participant IDs, anonymizes names/move authors and abandons open matches before removing the Auth user. Opponents retain anonymous accepted-match history. Private retry snapshots containing the deleted player are retired; retries against those closed matches cannot append moves. Profile removal immediately revokes data access; the Auth deletion step is retryable if the remote operation fails. Sign-out affects this device only. Guest game history remains local and is never uploaded as a verified result.

## Verification

```bash
npm run lint
npm run typecheck
npm test
npm run test:backend                 # embedded PostgreSQL; no Docker required
npm run test:mobile
# Optional real concurrency check:
docker pull postgres:17-alpine        # once, if the image is not present
npm run test:postgres                # isolated container; removed after the run
# With Deno installed:
cd supabase/functions/arena
deno task check
```

`test:postgres` uses only an already installed `postgres:17-alpine` image, a random local-only port, temporary credentials and a fresh test database. It does not reset any existing application database. See [actual Phase 3 results](phase-3-verification.md) for tested scope and remaining full-stack/device checks.

## Hosted deployment

Use a real Supabase project when ready: link that project, review/apply this migration, deploy `arena`, configure its stable signing secret and Auth templates/SMTP, and put only the public URL/publishable key into the web/mobile build environments. Keep development, preview and production variables separate. The existing Vercel static export can remain; Supabase serves the authenticated backend independently. Rebuild each client after setting its public variables.

Run the two-account checklist in the verification report against the configured backend before release. No hosted project, signing credentials or store submission was created during this local implementation.

References: [Supabase native Auth](https://supabase.com/docs/guides/auth/quickstarts/react-native), [email OTP](https://supabase.com/docs/guides/auth/auth-email-passwordless), [Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes), [database functions](https://supabase.com/docs/guides/database/functions), [local CLI configuration](https://supabase.com/docs/guides/local-development/cli/config).
