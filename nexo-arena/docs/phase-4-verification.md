# Phase 4 verification · 10 October 2026

## Scope

Local implementation of shared ranked untimed Classic matchmaking, Elo placements and opted-in global/regional leaderboards for Next.js and native Expo Android/iOS. No hosted backend, production user data, signing service or store account was connected.

## Completed checks

| Check | Result |
| --- | --- |
| ESLint | Pass, no warnings |
| Workspace TypeScript | Pass: engine, shared, online, web and native; includes the new web component tests |
| Shared Vitest | 71 passed, including 6 new ranked response/leaderboard/privacy contract tests |
| Embedded PostgreSQL backend | 29 passed: both migrations, real SQL/RLS/functions and the actual HTTP handler with a test Auth adapter |
| PostgreSQL 17 Docker backend | Same 29 passed; separate connections for concurrent pairing, moves and terminal settlement |
| Web component tests | 3 passed: real account/queue hooks and UI with an explicit mocked SDK transport |
| Native Jest / React Native Testing Library | 16 passed, including 5 ranked UI/queue lifecycle checks |
| Next.js production export | Pass; 30-asset offline shell generated |
| Android / iOS Hermes exports | Pass; ranked lobby, profile consent and rating summaries included |
| Expo native browser-preview export | Pass, 15 routes |
| Web Playwright | 14 passed on desktop/mobile; rebuilt production export |
| Native-preview Playwright | 6 passed on 320×568 phone and 768×1024 tablet; rebuilt preview |
| Deno Edge entry point | Typecheck passed using Deno 2.9.6 and the cached Supabase SDK |

**139 distinct automated test cases passed.** The 29 backend cases run on two database engines are counted once. Browser suites ran sequentially with one worker. Hermes exports prove JavaScript/assets bundle; they are not installable APK/IPA builds.

## What Phase 4 tests establish

- Atomic pair creation without invite tokens; both participants restore the same active match; no duplicate ranked match on retry.
- Idempotent cancellation, stale-ticket rejection, server expiry and region/skill widening based on server time.
- A burst of 12 concurrent entrants creates six distinct matches without pairing an identity twice. On PostgreSQL these requests use independent connections; embedded PostgreSQL serializes them.
- Verified played wins, draws and resignations settle both rating rows and exactly two accepted events. Concurrent duplicate resignations settle once.
- A forced failure in the second player's rating update rolls back the first rating update, events and terminal match result.
- Private matches never affect Elo; fourth results against the same pair within an hour are retained but excluded from rating updates.
- Owner-only queue/rating reads, denied direct rating writes and denied client access to privileged queue RPCs/private leaderboard tables.
- Leaderboards require consent and placement completion, expose handles/coarse regions only, honor regional ranking, and reflect handle/region changes and opt-out.
- Deletion clears a player's queue/ratings/projection, voids active ranked games, and anonymizes retained completed rating events.
- UI receives server values, supports search/cancel/open match and displays accepted rating changes. Profile visibility starts disabled and requires explicit opt-in.
- Queue hooks reject duplicate taps, preserve tickets for ambiguous retries, cancel unmatched searches on background/unmount, ignore late responses and restore accepted matches.
- Existing offline games, settings, history, keyboard controls, desktop/mobile layouts and unconfigured-online behavior still pass.

## Remaining verification

The full Supabase Auth/PostgREST/Realtime/Edge stack has **not** been started or exercised together. Disk space repeatedly exhausted during development; only generated project build/transform caches were cleared. The existing PostgreSQL Docker image allowed genuine SQL and concurrency tests without downloading the full stack.

Backend Auth uses fixture identities and a minimal test `auth` schema. Web/native component transport is explicitly mocked. These tests do not prove actual OTP delivery, SDK token refresh, PostgREST schema exposure or Realtime wire behavior. The default preview is deliberately unconfigured and makes no claim of live ranked play.

Before public launch, verify two real local accounts across web/native against the complete Supabase stack, outages/reconnects, privacy updates, and profile deletion during in-flight commands. Measure queue throughput, lock contention and response latency at the intended scale; the 12-client burst is a correctness check, not a production benchmark. Measured latency routing and a ranked disconnect/stalling policy are still required release decisions. Signed builds, physical Android/iPhone testing and store submission remain pending.

No new runtime dependency was added for Phase 4. The already installed JSDOM version was declared directly for reproducible web component testing. The inherited dependency audit from Phase 3 was not resolved or rerun in this phase.

## Reproduce

From `nexo-arena`:

```bash
npm run lint
npm run typecheck
npm test
npm run test:backend
npm run test:postgres
npm run test:web
npm run test:mobile
npm run build
npm run mobile:export
npm run export:web --workspace=@nexo/mobile
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e -- --workers=1
PLAYWRIGHT_CHANNEL=chrome npm run test:mobile-ui -- --workers=1
```

`test:postgres` requires Docker and an existing `postgres:17-alpine` image; it removes only its own isolated test container/volume. Deno entry checking: run `deno task check` inside `supabase/functions/arena`. See [local setup](phase-4.md) and the [remaining phases](roadmap.md).
