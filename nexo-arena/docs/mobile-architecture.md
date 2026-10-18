# Native application architecture

## Existing project remains the source of truth

`apps/web` remains a Next.js static export deployed with the existing `vercel.json`. The Python Q-learning prototype remains unchanged. Phase 2 adds `apps/mobile` without replacing the browser UI, route structure, production service worker or framework.

```text
apps/web                   Next.js browser presentation and browser storage/feedback
apps/mobile/app            Expo Router: arena/history/settings tabs, game/results/review/invite
apps/mobile/components     Native board, animated SVG marks, controls and configuration
apps/mobile/lib            AsyncStorage provider, AI lifecycle, audio/haptics, SecureStore adapter
apps/mobile/assets         Bundled icons, splash, TTF fonts/licenses and synthesized WAV effects
packages/game-engine       The existing pure TypeScript rules, minimax AI and session reducer
packages/shared            Dictionary, native state/persistence validation, palettes, backend contracts
```

Web and mobile import `@nexo/engine`. There is no second rule implementation. Native match history is reconstructed with `createGame` and `playMove` when loaded or reviewed. The web dictionary was moved to `@nexo/shared` and re-exported through its existing module path. Mobile uses the same color values and Manrope/Space Grotesk families; browser presentation is retained. Both use React 19.2.3 to match SDK 57; root overrides prevent duplicate React/native animation modules.

## State and storage

The existing session reducer handles legal moves, scores, undo, restart, rematch and configuration. `arenaReducer` adds local preferences, an interrupted session and a bounded collection of completed matches. History records the transition from playing to won/draw once, with a local ID, completion timestamp, configuration and the ordered moves. Rematches preserve session scores; configuration and score reset start fresh sessions. Abandoned rounds are not history entries. Completed terminal matches are immutable in the UI; undo is offered only during active play.

One versioned AsyncStorage record contains the session, preferences and latest 200 completed games. Writes are serialized so an older write cannot finish after a newer one. The provider waits for hydration before allowing play, saves on changes, and requests a save on background transitions. No platform can promise persistence after an immediate OS kill before a write completes. Storage failures are visible while play remains available. Corrupt moves are rejected by the shared engine, preferences are normalized, and invalid/duplicate history is dropped. Statistics describe locally saved games, with AI wins/losses from the human mark's perspective and local X/O wins separately. Clearing history clears those history statistics; session score is an independent reset.

Native sessions recover the current board on relaunch. The original browser behavior still restores scores/settings with a fresh board. This platform-specific persistence behavior does not change game outcomes or AI rules.

## Lifecycle and feedback

An AI effect runs only when the game screen is focused and the app is foregrounded. Cleanup cancels its timer on navigation, backgrounding, undo, restart and configuration changes. Returning to a pending AI turn schedules one response. The provider keeps an immediate state reference to reject repeated human presses during AI ownership before the next render. The engine validates occupied, terminal and invalid moves independently.

React Native Animated drives mark scale/fade, winning-line fade and result entry; reduced motion honors both the OS and a saved preference. Native buttons provide minimum touch targets, square names/disabled states, live turn announcements and selectable settings semantics. SafeAreaView and bottom insets protect content. Scrollable max-width layouts accommodate small phones and tablets. Native Stack/Tabs handle back navigation and transitions.

Expo Audio loads bundled move/result effects. Mute and background transitions pause playback. Expo Haptics is optional and unsupported feedback never blocks a move. No recording/background-audio capability is requested. Static font/audio assets and installed build JS are available offline; no backend or remote fonts are needed.

## Shared cross-platform services

Phase 2 shipped offline guest play and invitation placeholders. Phase 3 replaces those placeholders with the shared Supabase client and native account, invitation and online-match screens. Phase 4 extends the same service with ranked untimed Classic, atomic Elo and opt-in leaderboards. See [Phase 3](phase-3.md), [Phase 4](phase-4.md) and their verification reports for current limitations.

`@nexo/online` implements the common client, profile/account provider, authoritative snapshot validation, move/end commands, reconnection, queue lifecycle and leaderboard retrieval. `OnlineMatchTransport` remains a framework-independent extension contract. Commands carry expected revision and request UUID. The Edge Function validates with the engine and service-only SQL commits atomically. RLS limits data to participants/owners; only opted-in handles appear publicly.

`AuthTokenStore` uses chunked SecureStore on native, separate from casual AsyncStorage game data. Email-code sign-in avoids redirect callback dependence. AppState owns token-refresh lifecycle; focus/foreground guards clean up match subscriptions and unmatched queue tickets. Full Supabase Auth/Realtime service verification, verified Universal/App Links and push notifications remain pending. No server secrets, paid credentials or invented project IDs are shipped.

## Build boundary

Expo SDK 57's compatible RN 0.86.3/React 19.2.3 set is used. Expo's default Metro configuration discovers workspace packages. Expo Router owns native deep links. EAS profiles distinguish development clients, standalone APK previews, simulator previews, production AAB/IPA and interactive submission. EAS remote versioning increments production build numbers without editing the dynamic config. Identifiers are provisional until the owner supplies controlled metadata.

A Metro/Hermes export proves JS/assets bundle for both platforms. Native compilation, provisioning, installation and store submission require the owner’s SDK environment/accounts. See `mobile-verification.md` for precisely what was exercised.
