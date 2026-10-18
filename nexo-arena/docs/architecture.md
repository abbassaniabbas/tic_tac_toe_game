# Architecture and Python audit

## Prototype audit

The original `../../tic_tac_toe.py` remains unchanged; its README is preserved in `python-reference.md`. Reusable ideas are the nine-cell board, eight winning lines, occupied-square checks, alternating turns and checking a win before declaring a draw. The browser expresses these as immutable TypeScript functions.

The Python agent stores Q-values for board/move pairs and updates after its move and the opponent response. It trains only as O against random X moves. Exploration drops to 5%; wins during exploratory training do not prove optimal play. Rotated/reflected boards have separate entries, the table is not saved, and there is no independent evaluation suite. Human games do not call `learn()`. Every startup synchronously retrains 30,000 games.

The browser avoids this training cost. Easy samples legal moves. Medium takes immediate wins, otherwise explores 20% of the time or blocks threats and favors center/corners. Hard uses minimax with a per-search position cache and depth-sensitive rewards. Exhaustive tests traverse every opponent continuation for both AI marks and starting marks.

## Application boundaries

```text
apps/web                 Next.js App Router, React and Tailwind
  components             Landing, setup, preferences and accessible board
  lib/messages.ts        English dictionary and locale boundary
  lib/preferences.ts     Validated local storage; optional feedback
  public                 Install manifest and original geometric icons
packages/game-engine     Pure TypeScript; no DOM, React or network imports
scripts                  Production preview and versioned offline shell
tests                    Desktop and phone Playwright scenarios
```

`GameState` owns board, starter, turn, moves, outcome and winning line. `playMove` rejects invalid indices, occupied cells, incorrect turns and terminal moves while preserving the prior state. The session reducer owns scores, configuration, round, undo, restart and rematch. Completed results increment once. AI undo removes a human move plus its response, or just the human move while thinking. An AI opening alone cannot be undone. Terminal games cannot be undone.

Restart discards the current round. Rematch keeps scores and the chosen starter. New game settings and Reset scores start fresh sessions. Lobby re-entry with unchanged settings keeps scores. Refresh restores settings/scores with a fresh board rather than recovering an interrupted game. These are casual local scores, not verified ranked records.

The UI schedules AI moves with a short timer. Effect cleanup cancels stale responses on undo, restart, configuration changes, lobby exit and modal opening. The board rejects human input while AI is thinking; the engine supplies a second validation boundary.

## Presentation and accessibility

Charcoal surfaces, controlled blue/violet accents, original SVG marks and self-hosted Manrope/Space Grotesk variable font subsets define the visual identity. Color tokens support light/dark themes. CSS animations avoid an animation dependency.

The board uses labeled buttons and a roving tab stop. Arrow keys navigate; Enter/Space place; Home/End move to the first/last square. `aria-disabled` leaves inactive cells inspectable. A live status announces turns/results. Native dialogs handle focus and Escape. Reduced motion follows system settings or a saved override. Sound/haptics are opt-in and unsupported feedback does not block play.

Visitor copy is centralized in `lib/messages.ts`; dynamic messages are included and scores use `Intl.NumberFormat`. Add typed dictionaries and a locale selection at the application boundary before exposing translation controls. Longer text, RTL layouts and additional font coverage need visual tests.

## Offline and performance

Phase 1 is a Next.js static export with no server, account or database. The production-only service worker precaches exact HTML/scripts/styles/font subsets/icons/manifest. Content-derived cache versions invalidate on builds; activation removes only obsolete `nexo-arena-*` caches. Navigation uses the network with cached-shell fallback; immutable build assets prefer cache. API and cross-origin requests are excluded.

Offline requires one successful production visit and cache installation, on HTTPS or localhost. Plain LAN HTTP can test gameplay but cannot establish production offline support. Dev mode intentionally does not install the service worker. Cache failure does not display “Offline play ready.”

## Expo and variants

The implemented Expo app imports `@nexo/engine` and renders native screens and an animated native board. AsyncStorage, Expo Audio, Haptics and SecureStore supply platform adapters. Expo Metro discovers the workspace packages with its default configuration. See [native architecture](mobile-architecture.md) and [mobile setup](../apps/mobile/README.md).

`RuleSet<State, Move>` separates variants. Ultimate owns nine sub-boards and next-board constraints. Blitz composes rules with a server-owned clock. Puzzles and Replay Lab consume validated move histories. Achievement/season/cosmetic systems sit above gameplay and do not alter classic rules.

References: [Next.js static export](https://nextjs.org/docs/app/guides/static-exports), [PWA guidance](https://nextjs.org/docs/app/guides/progressive-web-apps), [Playwright web-server configuration](https://playwright.dev/docs/test-webserver).
