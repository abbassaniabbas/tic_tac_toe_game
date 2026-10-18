# Phase 5: Signature Studio

The website and native Android/iOS app now share Ultimate rules, UTC daily puzzles, Replay Lab, private server-timed Blitz rooms, achievements and board palettes. Open **Explore Studio →** on the web arena setup screen or the **Studio** native tab.

## Play locally

- **Ultimate:** two players on one device. Win three small boards in a row. Your square chooses the next required board; a closed destination permits any open board. The nine-board overview selects a board, and an enlarged board provides accessible move targets. Current moves survive reopening. Ultimate has no AI opponent in this delivery.
- **Daily puzzle:** seven curated, exhaustively checked forced-win Classic positions rotate by UTC date. Play X against deterministic optimal replies. Hints and retries are available. Daily progress is stored on this device; a new UTC day resets it. The seven-day cycle is explicit, rather than an unlimited publication feed.
- **Replay Lab:** completed local Classic and Ultimate games can be reconstructed move by move. First/Previous/Next/Last controls show the original position. Playing a square creates a sandbox branch; navigation or Reset branch returns to the saved line. Classic/Blitz positions show exact perfect-play win/draw/loss and best squares. Ultimate review shows routing and claims without claiming exact strategic analysis.
- **Collection:** Arena blue and Silver are free offline Studio palettes. Achievements and the two earned palettes require server verification.

Web offline use requires a first production visit until the offline shell is ready. Native standalone builds bundle these assets; Expo development clients still need Metro. Local Studio storage is separate from account tokens and existing casual settings/history. Up to 50 Studio replays are retained; native Replay Lab also reads the existing 200-match Classic history. Local saves are always labeled local practice, even if a modified save claims server provenance.

## Local backend setup

Follow [Phase 3 setup](phase-3.md) for Docker, the Supabase CLI, local email codes, the invitation signing secret, and public URL/key configuration. Current clients require **all three migrations**, in filename order:

1. `20261010000100_online_arena.sql`
2. `20261010000200_ranked_arena.sql`
3. `20261010000300_signature_studio.sql`

For an existing local database, apply the new migration from `nexo-arena`:

```bash
supabase migration up --local
supabase functions serve arena --env-file supabase/.env.local
```

Starting a new local stack applies its migrations. Restart the function server after code changes. Restart/rebuild the clients after changing their public backend configuration. No additional runtime dependency or external project is needed for Phase 5.

Sign in through **Online** with two distinct local test accounts. In Studio → **Blitz & rooms**, create a Blitz or Ultimate room. Share or paste the invitation into the second client. The host is X and guest O. Invitations expire after ten minutes; creating rooms is limited to three unexpired waiting rooms and twenty per hour. Accepted games remain resumable through the Studio room list. Resign/cancel requires the confirmation button; leaving the screen keeps accepted matches open.

Web invitations use `/?studioInvite=TOKEN`. Native sharing supplies a pasteable token; standalone navigation can use `nexoarena://studio?studioInvite=TOKEN` with the appropriate development/preview scheme. Verified Universal/App Links still require a real domain and device testing.

## Blitz deadlines and online rules

`blitz-v1` uses Classic rules and **60 seconds per player, zero increment**. X's clock starts when the guest joins. SQL locks the match and reads `clock_timestamp()` after acquiring the lock. A move deducts only the moving player's elapsed server time. A command arriving at or beyond its remaining deadline records a timeout instead of accepting a move. Invalid moves, disconnection, backgrounding and navigation do not pause the server clock.

Clients use the returned server timestamp and a monotonic local timer to estimate the display. They never decide timeout winners. Foreground active rooms poll once per second and refetch after Realtime notifications; browser visibility/network state and native focus/AppState stop subscriptions and display updates. Resuming requires a fresh authoritative snapshot before moves are enabled. Late callbacks and older revisions cannot restore stale state; moves are not optimistic.

Timeout settlement is **lazy**: authorized fetch/move/end commands materialize an expired deadline. If both clients close, the database may retain an active row until the next authorized command. The deadline continues to run, and reopening settles it using server time. There is no background deadline scheduler in this phase.

`ultimate-v1` uses the same immutable engine in web, native and the authenticated Edge handler, with no clock. Both Signature modes are **private and unrated**. They never alter the untimed `classic-open-v1` Elo season or its leaderboards.

## Verified collection and replays

| Achievement | Accepted evidence |
| --- | --- |
| First verified win | A server-confirmed Classic, Ultimate or Blitz win |
| Ultimate winner | A server-confirmed Ultimate win |
| Blitz winner | A server-confirmed Blitz win |
| Ten ranked games | At least ten settled rated Classic results |
| Daily strategist | A verified solve for the current server UTC date |

Resignation and Blitz timeout wins count as accepted wins. Repeated commands cannot award a badge twice. Awards are prospective from this migration; earlier wins are not backfilled. An existing player with ten rated games receives that badge at their next settled ranked result. Achievements prove accepted protocol results, not identity verification or collusion resistance.

**Victory violet** requires First verified win. **Strategy mint** requires Daily strategist. Server checks enforce palette selection; direct client writes to cosmetics, clocks, accepted moves, solves and achievements are denied. Palettes affect Studio marks only. Collection refresh retrieves updated earned state.

For a daily solve, the Edge handler verifies the published puzzle ID, full seed/history, every deterministic opponent reply and the solver's win. SQL additionally enforces today's UTC date and one solve per player/day. Hints are allowed; offline play itself grants no server award. A solve practiced before UTC midnight must be verified before that date expires.

Online Replay Lab requests the participant-only **accepted move log**, checks it against the stored snapshot, then reconstructs it with the engine. A server label appears only after this validation. Branches cannot change accepted moves, results, ratings or achievements. Partial terminal histories from resignation/timeout remain reviewable.

All new public tables use membership/owner RLS and SELECT-only client grants. Invitation digests and command receipts remain private; privileged RPCs require the service role. Account deletion abandons open Signature games, stops their clocks, anonymizes retained names/authors, retires affected receipts and removes the deleted player's solves/achievements/cosmetic profile.

## Main files

- `packages/game-engine/src/ultimate.ts`, `strategy.ts`: versioned rules, exact Classic analysis, puzzle proofs and replay reconstruction.
- `packages/online/src/signature.ts`, `studio.tsx`, `client.ts`: validation, shared Studio state, persistence and authoritative room lifecycle.
- `apps/web/components/studio.tsx`, `ultimate-board.tsx`: accessible browser Studio.
- `apps/mobile/app/(tabs)/studio.tsx`, `components/ultimate-board.tsx`: native screens and touch controls.
- `supabase/migrations/20261010000300_signature_studio.sql`: server clocks, accepted logs, private achievements and cosmetics.
- `supabase/functions/arena/core.ts`: authenticated variants, puzzle verification, collection and replay actions.

See [actual verification](phase-5-verification.md) and the [remaining release phase](roadmap.md). Full Supabase service integration, signed binaries and physical-device verification remain Phase 6 gates.
