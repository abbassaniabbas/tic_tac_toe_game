# Phase 4: ranked Classic matchmaking and Elo

Web, Android and iOS now share the same ranked queue, ratings and leaderboards through `@nexo/online` and the existing authenticated `arena` Edge Function. Offline guest play and unrated private invitations remain available.

## Local setup and use

Follow [Phase 3 local setup](phase-3.md). Start the local Supabase stack, apply the Phase 3 and 4 migrations, then serve `arena`. Current clients also require the [Phase 5 Studio migration](phase-5.md), for three migrations in total. Use `supabase migration up --local` to retain existing data; `supabase db reset` is only for disposable local databases. Configure the same public API URL/key in web and mobile builds. No new external project, secret or runtime dependency is required.

Sign in with two separate test accounts. Optionally set their two-letter regions through Edit profile. In Online, choose **Find ranked match**. Search/cancel/status come from the server; an accepted pair reveals **Open ranked match** to both players. Play through the existing authoritative board. Terminal screens show accepted Elo changes. Active ranked games can also be reopened through Rooms & history.

Edit profile includes a default-off public leaderboard switch. A handle and 10 rated games are required before appearing in Global or your region's leaderboard. Neither email, auth UUID, private display name nor history is published. Ranking data is readable by signed-in players; raw projection tables remain private.

The default preview has no configured backend, so it explains that online play is unavailable. It never invents opponents, player counts, ratings or leaderboard entries. Component tests use explicit fixtures; these fixtures are not shipped as an online experience.

## Queue policy

- One current ticket and one active ranked Classic match per identity through the server command path.
- Queue entries expire after 45 seconds without a server heartbeat. Foreground clients poll every 3 seconds. Background/navigation cancels an unmatched ticket on a best-effort basis; expiry covers failed cancellation. Accepted matches remain open.
- Prefer the selected region for 15 seconds, then admit global candidates. The older ticket's waiting time widens an initial 150 Elo band by 100 every 10 seconds, up to 600. Prefer same-region, then closest rating, then oldest entry. A missing region permits global search immediately.
- Region is self-selected and captured when entering. It is **not measured latency, location verification or regional server routing**. Change region before starting another search.
- Limit new tickets to 40 per account per hour; retries retain their UUID. Retired ticket commands cannot cancel a newer search. Poll/status do not consume new-ticket quota.

`arena_queue` acquires a transaction advisory lock before profile locks. Pairing, cancellation and account deletion share its lock order; pairing writes both queue records and the match atomically. Ordinary moves do not take this global queue lock. This is a simple local implementation, not a demonstrated large-scale queue service. PostgreSQL documents [transaction and row locking](https://www.postgresql.org/docs/17/explicit-locking.html).

## Ratings and seasons

`classic-open-v1` is an open season for `classic-v1`, **untimed** games. Initial Elo is 1500; the first 10 rated results are placements. No scheduled reset or rewards are implied.

```text
expected_X = 1 / (1 + 10^((rating_O - rating_X) / 400))
delta_X = round(32 * (score_X - expected_X))
score_X = 1 for an X win, 0.5 for a draw, 0 for an O win
delta_O = -delta_X
```

Deltas are clamped to keep both ratings nonnegative while preserving their sum. K=32 remains constant during and after placements. Resignation is a rated loss. Private games and abandoned games are unrated. Disconnecting never awards a win; untimed matches stay resumable, with no automatic timeout/stalling adjudication in this implementation.

A match-phase trigger locks the two rating rows in UUID order, updates both ratings/stats, inserts exactly two `elo32-v1` events and updates leaderboard projections in the same transaction as the final move or resignation. The unique match/mark event key and existing command receipts prevent duplicate settlement. Failed settlement rolls back the terminal move as well.

Only three results against the same opponent per season per hour affect Elo. Further results remain in history with `ratingStatus=void` and `repeat_pair_limit`. This limits repeated-pair farming; it is not identity verification, collusion detection or a complete anti-cheat system.

Global/regional lists contain the top 50 opted-in handles after placements, ordered by rating, game count and handle. Projections refresh on settlement and profile edits; read-time profile consent is checked again to avoid stale consent exposing a handle. Opt-out/deletion removes access immediately. This follows the existing [Supabase RLS model](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Main files

- `supabase/migrations/20261010000200_ranked_arena.sql`: season, queue, ratings, rating events, projection, locks and service-only RPCs.
- `supabase/functions/arena/core.ts`: authenticated queue and leaderboard actions; identity comes from Auth, never request input.
- `packages/online/src/model.ts`, `client.ts`, `react.tsx`: response validation, SDK methods, queue lifecycle and leaderboard retrieval.
- `apps/web/components/ranked-panel.tsx` and `apps/mobile/components/ranked-panel.tsx`: real ranked lobby controls.
- Existing profile editors and online boards: consent and accepted rating changes.

Clients have owner-only queue/rating SELECT policies, no direct writes, and no permission to call server RPCs. Rating events, queue-attempt logs and projections live in the unexposed private schema. Account deletion clears the queue, ratings and projection, voids active games and anonymizes retained events/history.

See [verification](phase-4-verification.md) for actual test coverage and [roadmap](roadmap.md) for remaining work.
