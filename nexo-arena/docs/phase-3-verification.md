# Phase 3 verification · 10 October 2026

## Scope

Local implementation of shared Supabase accounts and private classic online matches for Next.js, Android and iOS. The full Supabase Auth/PostgREST/Realtime/Edge stack was **not** started: free disk space fell below 1 GB after Docker startup. An existing PostgreSQL 17 image was used for real database and concurrency checks instead. No hosted project or production account was connected.

## Completed checks

| Check | Result |
| --- | --- |
| ESLint | Pass, no warnings |
| Workspace TypeScript | Pass: engine, shared, online, web and mobile |
| Shared Vitest suite | 65 passed: rules/AI, persistence, snapshot validation, configuration and secure session storage |
| Backend with embedded PostgreSQL | 15 passed; actual migration/RLS/functions, serialized connection |
| Backend with PostgreSQL 17 Docker | Same 15 passed; separate connections for race/duplicate checks |
| Native Jest / React Native Testing Library | 11 passed; offline controls, AI/provider lifecycle, account code form, online tap guards and subscription cleanup |
| Next.js production build | Pass; static export and 30-asset offline shell |
| Expo Android / iOS export | Pass; Hermes bundles include the new native routes |
| Expo native web-preview export | Pass; 15 routes |
| Chrome web Playwright | 14 passed across desktop/mobile |
| Chrome native-preview Playwright | 6 passed across 320×568 phone and 768×1024 tablet |
| Deno Edge entry point | Typecheck passed with Deno 2.9.6, Supabase SDK 2.117.3; dependencies locked |
| Supabase configuration | Parsed by installed CLI; status reports the full stack is absent |

The browser suites were rerun sequentially with one worker after simultaneous suites caused resource-related timeouts. The new web test's ambiguous Play-now selector and incorrect board role were corrected. Final results use the rebuilt artifacts.

## What the backend tests establish

- Anonymous and nonmember denial, private profiles and participant-only matches/history/open rooms.
- Denial of direct client match writes, private invite reads and privileged RPC execution.
- Stable invitations, idempotent create/join/move, request-ID conflict detection and ten-minute expiry.
- A real concurrent join admits one guest; duplicate moves commit once; conflicting same-revision moves admit one command.
- Turn/occupancy/revision/terminal checks, canonical engine wins/draws and disregard of forged client game states.
- Private history, cancellation/resignation, room limits and account anonymization/access revocation, including retirement of cached retry responses containing the deleted player.

Auth is substituted with fixture identities in handler/database tests. The fixture `auth.users`/`auth.uid()` models database identity and enables real PostgreSQL RLS evaluation; it does not verify actual JWTs, email delivery or Auth administration over HTTP. Native account tests mock the SDK calls. Deno checks the actual server entry point, whose production authentication uses `auth.getUser(token)`.

## Remaining integration and release checks

After enough disk space is available, start the full stack using [the setup guide](phase-3.md), configure the public client URL/key, and verify:

1. New and returning accounts receive six-digit codes in the local inbox. Invalid/expired codes and resend limits behave correctly. Restart restores a session; sign-out removes it.
2. Web account A creates a room; native account B joins and completes both a win and a draw. Names, turns, outcomes and history agree on both devices. Native-created invitations also work on web.
3. A third account and anonymous clients cannot fetch or subscribe to those rows or call privileged RPCs. Only permitted profile fields can be edited; handles remain unique.
4. Disconnect/reconnect and background/foreground each client. Subscriptions recover, stale updates are ignored, open rooms remain resumable, and input waits for a fresh snapshot.
5. Two real HTTP joins and conflicting moves behave like the concurrent database checks. Retry the same successful request ID without duplicating moves or rooms.
6. Expiry, cancellation, resignation, profile edits and deletion work through the deployed Edge Function. Deleted users lose access immediately; opponents retain anonymous history.
7. On actual Android/iPhone builds, verify SecureStore refresh/sign-out, clipboard/share, keyboard, deep links and device lifecycle. Verify hosted HTTPS endpoints and any required development transport settings.

Physical-device tests, signed APK/AAB/IPA builds, TestFlight, verified domain links, hosted SMTP and deployment remain outstanding. Expo Hermes exports are compilation checks, not signed installable apps. Matchmaking, Elo, leaderboards and signature modes are outside this phase.

The existing npm audit still reports 71 affected dependency entries (56 high, 15 moderate) after installing the online client/test tools; see the Phase 2 dependency note. Incompatible forced dependency upgrades were not applied.

## Reproduce

From `nexo-arena`:

```bash
npm run lint
npm run typecheck
npm test
npm run test:backend
npm run test:postgres
npm run test:mobile
npm run build
npm run mobile:export
npm run export:web --workspace=@nexo/mobile
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e -- --workers=1
PLAYWRIGHT_CHANNEL=chrome npm run test:mobile-ui -- --workers=1
```

`test:postgres` requires Docker and an already installed `postgres:17-alpine` image; it creates and removes only its own local test container/data. Without Docker, `test:backend` uses embedded PostgreSQL. Deno can be installed separately; run `deno task check` in `supabase/functions/arena`.
