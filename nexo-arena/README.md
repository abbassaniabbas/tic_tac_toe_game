# NEXO Arena

A polished browser and native Android/iOS tic-tac-toe arena with instant guest play, three AI difficulties, two-player games on one device and optional shared Supabase accounts, private matches and ranked Classic play. Built with Next.js, React, TypeScript and Tailwind CSS. The original Python prototype is preserved at the repository root.

## Run locally

Use Node.js 22.13+ (Node 24 used for verification).

```bash
cd nexo-arena
npm ci
npm run dev
```

Open `http://localhost:3000`. Choose mode, difficulty, mark and starter, then enter the arena. Play now starts immediately with the selected settings. Arrow keys navigate; Enter/Space play. Undo is available during active games. Rematch keeps scores. New game settings and Reset scores start a fresh session. Preferences include light/dark, reduced motion, optional sound and haptics. Local scores and settings persist on the device.

## Native Android and iOS

```bash
npm run mobile
```

Native screens share the existing game engine and support offline AI/local games, saved sessions, history/review, settings, audio and haptics. See the [mobile README](apps/mobile/README.md) for iPhone/Android testing, installable APKs, EAS builds and TestFlight, [mobile architecture](docs/mobile-architecture.md), and [actual mobile verification](docs/mobile-verification.md).

## Phase 3: accounts and private online matches

Email-code sign-in, protected profiles, invitations, authoritative classic matches, open rooms, online history and account deletion are implemented for the website and native apps. Online features activate when their public Supabase URL/key are configured. Follow the [local setup guide](docs/phase-3.md) and read the [actual Phase 3 verification](docs/phase-3-verification.md); full Auth/Realtime service integration and device builds still need verification.

## Phase 4: ranked matchmaking and leaderboards

Ranked untimed Classic now has transactional public pairing, server-owned Elo, ten-game placements and global/regional leaderboards with explicit profile opt-in. Both apps show accepted rating changes; private games remain unrated. Follow the [Phase 4 guide](docs/phase-4.md) and [actual verification](docs/phase-4-verification.md). These features need the configured backend; the default offline preview does not simulate opponents or rankings.

## Phase 5: Signature Studio

Open **Explore Studio →** on the web setup screen or the native **Studio** tab. Play saved local Ultimate, solve the UTC daily puzzle, review and branch replays, create private server-timed Blitz/Ultimate rooms, and select earned Studio palettes. Online accepted results and verified solves award achievements; local practice remains offline and unrated. Follow the [Phase 5 guide](docs/phase-5.md) and [actual verification](docs/phase-5-verification.md). Apply all three Supabase migrations for online Studio features.

## Phase 6: release preparation

Privacy, support and browser account deletion pages, offline caching, release guards, EAS checks and CI are prepared. Both apps now use the supplied Supabase project: three migrations and the authenticated arena function are deployed, and five read-only hosted probes pass. [SMTP email-code sign-in](docs/smtp-setup.md), hosted browser profile/ranked reads, private-room creation/cancellation, session restoration, and a two-account Classic match with history/server replay are verified. Full multiplayer/service/device checks, dependency fixes, website hosting and signing remain open. See the [release guide](docs/phase-6.md), [actual verification](docs/phase-6-verification.md), [operations](docs/release-operations.md) and [store checklist](docs/store-submission.md).

The [delivery roadmap](docs/roadmap.md) is now in Phase 6. **No further numbered phases remain in this plan; Phase 6 is still in progress.**

## Production and offline

```bash
npm run build
npm run preview
```

Open `http://localhost:4173`. Wait for “Offline play ready” after a first online production visit. Subsequent AI/local play and local Studio work offline. Install via your browser; on iPhone use Safari → Share → Add to Home Screen. Dev mode has no service worker. Refresh restores Classic scores/settings with a fresh board; Studio keeps its current Ultimate/puzzle progress. No account, Python training, remote font or backend is required for local play.

## Test on a phone

Connect both devices to the same Wi-Fi. Servers listen on all interfaces. Find your computer's LAN IP in network settings and open `http://YOUR_LAN_IP:3000` or production preview `http://YOUR_LAN_IP:4173`. Allow the local server through your firewall if needed. Stop with Ctrl+C.

LAN HTTP tests gameplay/layout. Installation and offline caching require HTTPS or localhost; use a Vercel HTTPS deployment for those phone tests. Audio/vibration depend on browser support.

## Automated checks

```bash
npm run lint
npm run typecheck
npm test
npm run test:backend
npm run test:postgres
npm run test:web
npm run test:mobile
npm run test:release
# With the public hosted configuration set:
npm run verify:hosted
npm run build
npx playwright install chromium
npm run test:e2e
```

Playwright starts the production preview. Set `NEXO_EXPECT_ONLINE=1` when checking builds with backend configuration. Tests cover game rules, replays, clock/telemetry SQL, RLS, concurrency and client lifecycle; browser cases include offline play and information routes. See [Phase 6 verification](docs/phase-6-verification.md). `npm run verify:hosted` performs five public-only probes; it does not prove email delivery or gameplay. `test:integration` and `test:load` require the local service stack. The high dependency audit remains an unresolved gate.

## Structure

`apps/web` owns presentation and browser adapters. `packages/game-engine` contains framework-independent rules/AI/session state shared by web and Expo mobile. `packages/shared` provides shared messages, native persistence validation, palettes and extension contracts. `packages/online` shares the Supabase client, response validation, account state and reconnection logic. `supabase` owns the migration, email templates and authenticated Edge Function. CSS provides animations without an extra library; local font subsets support offline play. Production precaching is generated by `scripts/build-sw.mjs`.

Icons, font subsets and font licenses are checked in. To regenerate them after changing the SVG or font packages, run `node scripts/generate-icons.mjs` from this directory.

Read the [architecture and Python audit](docs/architecture.md), [preserved Python README](docs/python-reference.md), and [delivery roadmap](docs/roadmap.md). Native apps, local history, accounts, private matches, ranked Classic and Signature Studio are implemented locally. Release preparation is underway.

## Deploy to Vercel

1. Push the repository to your Git provider and import it in Vercel.
2. Set Root Directory to `nexo-arena` so npm resolves the workspace packages.
3. Select the **Other** framework preset for this static export. Install: `npm ci`. Build: `npm run release:web`. Output: `apps/web/out`.
4. Select Node 24.x. Set `NEXT_PUBLIC_SUPPORT_EMAIL` to `abbassani94@gmail.com`. For an offline guest release, set `NEXO_OFFLINE_RELEASE=1` and leave both public Supabase variables empty. For online play, clear the offline flag and set the public Supabase URL/key after the integration gates pass. These values belong in Vercel's build environment, not an ignored local file.
5. Deploy, open the HTTPS URL, then verify gameplay, installation and offline reload on your phone.

`vercel.json` supplies build/output settings and noncached service-worker headers. This static setup runs the post-build offline-shell generator. A future server release can remove `output: 'export'`, switch to the Next.js preset and revise caching to exclude authenticated data. See Vercel's [build settings](https://vercel.com/docs/builds/configure-a-build) and [monorepo guide](https://vercel.com/docs/monorepos).
