# Phase 1 verification

Verified on 10 October 2026. Environment: macOS arm64, Node 24.21.0, npm 11.19.0, Next.js 16.4.0, Vitest 4.1.11 and Playwright 1.64.0. Browser tests used Playwright Chromium 156 and the production static export.

| Check | Actual result |
| --- | --- |
| `npm run lint` | Passed; no lint errors or warnings |
| `npm run typecheck` | Passed for engine and web application |
| `npm test` | 41 tests passed; 1 test file |
| `npm run build` | Passed; static `/` and not-found page generated |
| `npm run test:e2e` | 10 tests passed: 5 desktop + 5 Pixel 7 viewport scenarios; final run 20.5 seconds |
| Offline shell | Generated 28 precached assets with a content-versioned cache; 1,050 KiB total before transfer compression |
| Visual inspection | Desktop 1440×1024, phone 390×844, tablet 820×1180; dark and light layouts checked |
| Overflow check | No horizontal document overflow at inspected viewports |
| Python preservation | `git diff -- tic_tac_toe.py` empty |
| Whitespace validation | `git diff --check` passed |

The unit suite covers all eight winning combinations for each mark, draws, invalid/occupied/out-of-turn moves, immutability, terminal transitions, all AI difficulties, undo, restart, new configuration and score-preserving rematch. Hard AI is exhaustively checked against every reachable opponent continuation for both AI marks and either starting mark; it never loses in those traversals.

Browser scenarios cover local wins and draws, terminal input guards, scoring/rematches/restarts, undo/turn restoration, playing O with the AI first, new game configuration, keyboard navigation, dialog focus return, theme/reduced-motion controls, mobile sizing, score persistence and a real offline page reload followed by a move. Initial browser runs exposed a dialog focus-return issue, now fixed. The terminal-input test was adjusted to dispatch a click to an aria-disabled square because a normal Playwright click correctly refuses disabled controls.

The first Turbopack build was blocked by the environment's internal-port restriction. Automatic permission review for that build timed out. The production script now uses Next.js's supported webpack compiler and passes without that permission. Playwright's browser download initially required network permission and retried slow transfers; it subsequently completed. Local preview/browser runs used permission to open local ports and launch Chromium. For this verification, downloaded browsers were kept in `/private/tmp/nexo-playwright`, so the final command was `PLAYWRIGHT_BROWSERS_PATH=/private/tmp/nexo-playwright npm run test:e2e`. A regular installation can use the README commands without that environment override.

Phone testing used browser emulation, not a physical handset. Safari/iOS, Android installation, real vibration/audio output, constrained-device performance and a live Vercel deployment have not been verified. HTTPS installation and physical-device checks are deployment follow-ups; this report does not claim those passed.
