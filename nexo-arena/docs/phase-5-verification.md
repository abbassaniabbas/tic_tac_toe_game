# Phase 5 verification · 10 October 2026

## Scope

Local implementation of Signature Studio on the Next.js website and native Expo Android/iOS app. This phase adds versioned Ultimate, private server-timed Blitz, a curated UTC puzzle rotation, deterministic Replay Lab, verified achievements and Studio palettes. No hosted backend or signing/store account was connected.

## Completed checks

| Check | Result |
| --- | --- |
| ESLint | Pass, no warnings |
| Workspace TypeScript | Pass: engine, shared, online, web and native |
| Shared Vitest | 100 passed, including Ultimate, all seven puzzle proofs, replay reconstruction, clock/telemetry decoding and Studio persistence |
| Embedded PostgreSQL backend | 39 passed against all three migrations, real SQL/RLS and the actual HTTP handler with test Auth identities |
| PostgreSQL 17 Docker backend | Same 39 passed using independent connections for concurrency |
| Web component tests | 7 passed; real Studio/account hooks, local storage and explicitly mocked online SDK transport |
| Native Jest / React Native Testing Library | 20 passed, including native Studio and Blitz background/resume guards |
| Next.js production export | Pass; 30-asset offline shell generated |
| Android / iOS Hermes exports | Pass, including Studio; JavaScript/assets only |
| Expo native browser-preview export | Pass, 17 routes |
| Web Playwright | 18 passed across desktop/mobile against the rebuilt production export |
| Native-preview Playwright | 8 passed on 320×568 phone and 768×1024 tablet against the rebuilt native preview |
| Deno Edge entry point | Typecheck passed with the cached Deno runtime and Supabase SDK |

**192 automated test cases passed.** The 39 backend cases run on two database engines are counted once. Browser suites ran sequentially with one worker. Hermes exports are not signed/installable APK or IPA builds, and React Native web preview checks are not physical-device tests.

## Evidence established

- Ultimate enforces required-board routing, releases closed destinations, rejects occupied/closed/out-of-turn/terminal moves, evaluates every meta winning line and draws, and reconstructs immutable history.
- All seven published puzzles have a forced win under exact Classic analysis. Solves must preserve the seed and deterministic replies. Invalid/incomplete proofs, wrong IDs and valid proofs for an expired UTC date are rejected. Repeated valid solves award once.
- Private versioned invitations are idempotent and participant-only. Forged client game/result/clock input cannot determine accepted state.
- Blitz deducts actual SQL server elapsed time. An expired deadline rejects a late move, records the correct timeout winner and grants its verified win badges. Concurrent duplicate timed moves produce one accepted log entry.
- Server replay reads enforce participation and return ordered accepted logs. A log/snapshot mismatch fails validation. Signature games do not create Classic Elo rows.
- Cosmetic unlocks require accepted evidence. Clients cannot directly change clocks, achievements, solves or cosmetic fields and cannot read another player's private telemetry.
- Ten settled ranked results award the milestone once, with its accepted tenth-match evidence; an eleventh result and retried resignations do not duplicate the award.
- Deletion abandons open Signature games, stops clocks, anonymizes retained names/authors and removes private telemetry. Existing Classic/ranked deletion checks still pass.
- Client clock estimates are clamped, timeout payloads are checked against the losing side, and background/resume stops subscriptions, ignores old callbacks and requires fresh authoritative clocks before moves.
- Local storage validates engine histories and downgrades claimed server provenance to local practice. Replay branches preserve the saved moves.
- Web/native Studio supports accessible board selection, persisted Ultimate moves, optimal offline puzzle replies, local replay analysis and locked/free palettes. Existing Classic, AI, settings, history, keyboard/dialog and offline behavior remains passing.

The production Studio modal was also visually inspected at desktop size and 320-pixel phone width; its enlarged playable board and reset control fit the phone without horizontal overflow.

## Verification limits and retries

The complete Supabase Auth/PostgREST/Realtime/Edge stack has **not** been exercised together. Database tests use fixture identities and a minimal test `auth` schema; online component transport is explicitly mocked. These checks establish SQL/protocol/client correctness without proving OTP delivery, SDK session refresh, actual Realtime wire behavior or two real cross-platform accounts. The default preview has no backend configured and offers local play.

Blitz uses access-triggered timeout settlement, not a background scheduler. The seven-puzzle cycle is finite and explicit. Achievements establish accepted results; they do not establish identity verification or collusion resistance. No public Ultimate/Blitz matchmaking, separate variant ratings or Ultimate AI opponent is included.

Disk exhaustion interrupted an initial web build and one native test process after its assertions passed. Only generated project caches were cleared. Successful final checks used `NEXO_BUILD_CACHE=0` for the web build and `--no-cache` for Jest. Normal build caching remains the default. An initial Replay Lab browser test selected the existing setup dialog instead of returning to the lobby; its navigation was corrected and the full 18-test suite passed.

Full service integration, network outages/resume across two real accounts, physical Android/iPhone accessibility/safe-area/link checks, signed binaries, public load/monitoring checks, deployment and store preparation remain Phase 6 gates. No new runtime dependency was added for Phase 5. The inherited dependency audit remains a release item.

## Reproduce

From `nexo-arena`:

```bash
npm run lint
npm run typecheck
npm test
npm run test:backend
npm run test:postgres
npm run test:web
npm run test --workspace=@nexo/mobile -- --no-cache
NEXO_BUILD_CACHE=0 npm run build
npm run mobile:export
npm run export:web --workspace=@nexo/mobile
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e -- --workers=1
PLAYWRIGHT_CHANNEL=chrome npm run test:mobile-ui -- --workers=1
```

`test:postgres` requires Docker and the local `postgres:17-alpine` image; it removes only its own test container/volume. Use installed Chromium without `PLAYWRIGHT_CHANNEL` when appropriate. Run `deno task check` inside `supabase/functions/arena` for the Edge entry point. See [Phase 5 setup](phase-5.md) and the [remaining release phase](roadmap.md).
