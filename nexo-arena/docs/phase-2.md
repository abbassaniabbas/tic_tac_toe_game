# Future online arena proposal

This proposal was written before online implementation. Phases 3 and 4 implemented accounts, private Classic rooms, ranked pairing, Elo and opt-in leaderboards locally. [Phase 5](phase-5.md) now implements Ultimate, server-timed private Blitz, puzzles, participant-only Replay Lab, achievements and palettes; see [verification](phase-5-verification.md). Measured latency routing, ranked disconnect adjudication and public replays remain proposals. Native apps and local history were delivered in Phase 2. The [current delivery roadmap](roadmap.md) tracks remaining release work; the proposed model below is historical.

## Delivery order

1. **Identity:** Supabase Auth, protected profiles, handles, locale, self-selected region, account deletion and RLS allow/deny tests. Preserve guest AI/local play.
2. **Private matches:** invitations, atomic join, authoritative move validation, private realtime channels and reconnection. Gate on race/duplicate-request/illegal-move/disconnect tests.
3. **History and replays:** append-only accepted moves, deterministic replay validation and profile-controlled history visibility.
4. **Matchmaking and ratings:** transactional pairing, region/latency-aware queues, provisional Elo ratings separated by rule set/time control, versioned algorithms, anti-abuse limits and materialized leaderboards. Gate on load and idempotency tests.
5. **Signature modes:** separate Ultimate engine, authoritative Blitz clocks, curated daily puzzles and a full Replay Lab. Extend the existing native UI using the shared engine. Achievements/seasons/cosmetics follow verified match telemetry.

## Proposed data model

| Table | Main fields | Invariants |
| --- | --- | --- |
| `profiles` | auth UUID, handle, avatar reference, locale, region, timestamps | Owner edits permitted columns; ratings excluded |
| `rooms` | UUID, owner, invite digest, expiry, rules version, capacity, state | Participants read; server joins atomically |
| `matches` | UUID, room, rules version, board snapshot, turn, status, revision, result, server timestamps | Participant reads; authoritative writes only |
| `match_players` | match, user, mark, connection state, last seen | Unique user/mark per match; membership controls access |
| `moves` | match, ply, player, payload, request UUID, accepted time, revision | Unique match/ply and match/request; append-only |
| `queue_entries` | user, rule set, region, rating band, joined/expiry times | One active entry per user/rule set; atomic pairing |
| `ratings` | user, rule set, clock bucket, season, rating, games | Server writes once per verified ranked result |
| `rating_events` | match, user, old/new rating, algorithm version | Unique match/user; auditable and idempotent |

Expire unused rooms and queue entries. Do not expose invitation digests, auth details or private membership/history on public leaderboards. Use opted-in handles and coarse self-selected regions.

## Match protocol

```text
waiting → active → completed
waiting → cancelled / expired
active → reconnecting → active
active / reconnecting → forfeited / abandoned
```

Outcomes are stored separately: X win, O win, draw, forfeit or cancellation reason. Rematch creates a new match after both players agree. Presence is advisory and cannot decide a result. Proposed reconnect grace: 45 seconds, implemented as a versioned server policy and reviewed for ranked fairness. Define double-disconnect adjudication before ranked launch.

Each command includes `{matchId, expectedRevision, requestId, move}`. An authenticated server loads and locks the match, checks membership/phase/turn/revision/deadline/legal move, then atomically appends the move and updates the snapshot. Repeated request IDs return the original result; stale revisions return a fresh snapshot. Concurrent commands cannot both take the same turn. Replays verify snapshots from the accepted move log. Clients cannot choose official outcomes, timestamps or ratings.

Use the TypeScript engine in a server endpoint or Edge Function backed by an atomic database operation. Broadcast committed snapshots only. Reconnect fetches the current revision and resubscribes; discard older events. Blitz uses server deadlines; browser clocks are presentation only.

## Access and security rules

- Enable RLS for every exposed table. Profile writes require `auth.uid() = id` and permitted columns; user-editable metadata must not determine privileges.
- Match/room/move reads require membership or an explicit public-replay policy. Clients cannot directly write boards, outcomes, moves, queues or ratings.
- Authorize private Realtime topics by membership. Knowing a room UUID is not subscription permission.
- Privileged Supabase keys stay in server environment variables. Limit privileged operations to authenticated, rate-limited commands with least database privilege and fixed search paths.
- Use high-entropy expiring invite tokens, store digests, limit join attempts and avoid revealing private participant details on failure.
- Test anonymous/owner/other-user access, replay tampering, duplicate results/rating writes, stale revisions, simultaneous moves and reconnect/deadline boundaries.
- Monitor command latency, reconnect frequency and rejected commands before public matchmaking.

Supabase documents [row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security), [private realtime authorization](https://supabase.com/docs/guides/realtime/authorization) and [database broadcasts](https://supabase.com/docs/guides/realtime/subscribing-to-database-changes). These require the authoritative validation protocol above.

## Extension contracts

Version every `RuleSet<State, Move>` identifier on matches. Ultimate uses `UltimateState` and `{board, cell}` moves. Blitz wraps a rules adapter with server-owned deadlines/remaining time/increments. Puzzle content stores rule-set ID, validated initial state, solution tree and publication date. Replay Lab consumes accepted move events and reproducible position analysis. Achievement events refer to verified matches; cosmetic selections affect rendering only. Seasons scope ratings/leaderboards without changing classic move validation.
