# NEXO Arena

A premium browser and native mobile evolution of the original Python tic-tac-toe learning-agent project.

The cross-platform app lives in [nexo-arena](nexo-arena/README.md). It includes a Next.js browser UI, shared TypeScript engine, Easy/Medium/Hard AI, local multiplayer, accessible controls, production offline support, native Expo Android/iOS screens, shared Supabase accounts, private matches and ranked Classic with Elo and opt-in leaderboards. Signature Studio adds Ultimate, server-timed Blitz, daily puzzles, Replay Lab, verified achievements and board palettes.

```bash
cd nexo-arena
npm ci
npm run dev
```

Open `http://localhost:3000`. See the [application README](nexo-arena/README.md) for phone testing, automated checks and Vercel deployment, the [architecture audit](nexo-arena/docs/architecture.md) for design decisions, and the [mobile README](nexo-arena/apps/mobile/README.md) for Expo, APK and TestFlight instructions. The [Phase 3 guide](nexo-arena/docs/phase-3.md) covers local backend setup; the [verification report](nexo-arena/docs/phase-3-verification.md) distinguishes tested code from pending full-stack/device checks.

The original [tic_tac_toe.py](tic_tac_toe.py) is preserved unchanged as an experimental Q-learning reference. Run it with `python3 tic_tac_toe.py`. Its original README is preserved in [python-reference.md](nexo-arena/docs/python-reference.md).

See the [Phase 5 guide](nexo-arena/docs/phase-5.md), [Phase 6 release guide](nexo-arena/docs/phase-6.md), [current verification](nexo-arena/docs/phase-6-verification.md) and [roadmap](nexo-arena/docs/roadmap.md). Phase 6 is in progress: Supabase migrations and the arena function are deployed, both apps have public configuration, 200 local cases and five read-only hosted probes pass. [SMTP email-code sign-in](nexo-arena/docs/smtp-setup.md), hosted browser profile/ranked reads, private-room creation/cancellation, session restoration, and a two-account Classic match with history/server replay are verified. Full multiplayer/service/device checks, dependency fixes, frontend hosting and signed-device testing remain open. No further numbered phases remain in this plan.
