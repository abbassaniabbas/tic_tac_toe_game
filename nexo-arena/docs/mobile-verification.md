# Phase 2 verification · 10 October 2026

## Actual automated results

Verified on macOS ARM64, Node 24.21.0. Expo 57.0.27, RN 0.86.3, React 19.2.3 and TypeScript 5.9.3 are installed. At the time of Phase 2 verification, the project had no backend or authenticated service. [Phase 3 verification](phase-3-verification.md) records the subsequent backend and account work.

| Check | Result | Scope |
| --- | --- | --- |
| `npm run lint` | PASS, no warnings | Web, mobile, engine, shared modules and test/config files |
| `npm run typecheck` | PASS | All four workspaces |
| `npm test` | 53 PASS | Existing 41 engine tests plus 12 native persistence/history/contract tests |
| `npm run test:mobile` | 7 PASS, 2 suites | Native square controls, disabled/terminal input, accessible choices, AI cancellation/resume, rapid-tap guard, AsyncStorage hydration/save |
| `npx expo-doctor` | 21/21 PASS | Expo dependencies, native module deduplication and project health |
| `npm run mobile` | PASS | Expo Go development server started on port 8081; no physical client connected |
| `npm run mobile:export` | PASS | Android and iOS Hermes bundles, 38 bundled assets; **not signed native binaries** |
| `npm run build` | PASS | Existing Next.js static export and generated offline service worker |
| `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e` | 10 PASS | Existing desktop/Pixel 7 browser regressions including offline reload |
| `npm run export:web --workspace=@nexo/mobile` | PASS | Separate native-component web preview, 12 static routes |
| `PLAYWRIGHT_CHANNEL=chrome npm run test:mobile-ui` | 4 PASS | Native-component preview at 320×568 and 768×1024; **not iOS/Android device tests** |
| `npx expo config --type introspect --json` | PASS | Native config plugin resolution; production scheme/IDs/assets; no microphone/Face ID/background audio capability requested |

The phone/tablet preview scenarios cover local victory, result navigation, rematch scores, tabs, history review, persistent player name/theme, board recovery on reload, Hard AI reply and undo. Local game/result/review interactions also passed with network access disabled after loading the app. Screenshots of the phone home/game/result/settings and tablet history were inspected. This browser preview verifies shared React Native presentation/interaction behavior; it does not prove physical safe-area insets, native gestures, hardware feedback or OS lifecycle behavior.

Shared tests check validated move replay on restore, corrupt storage recovery, bounded/deduplicated history, terminal recording exactly once, AI-perspective statistics, unfinished/undone rounds and serialized storage writes recovering after a failure. The existing exhaustive Hard AI tests traverse every opponent continuation for both marks and starters. Both apps call those same engine functions.

Expo's initially detected duplicate React/worklets/reanimated dependencies were removed using compatible root overrides and npm deduplication. Initial browser runs needed the installed Chrome channel because the updated Playwright expected a different downloaded browser revision. Web/native-preview artifact directories are separate to avoid concurrent test cleanup collisions. Final results above passed after these fixes.

## Native configuration checked

- Default production identifier `com.nexoarena.game` is **provisional**. Development/preview add `.dev`/`.preview`; store ownership must be supplied by the user.
- Original geometric brand is reused for app/adaptive icons, splash and the native home header.
- Production deep-link scheme `nexoarena`; variant schemes configured. Invite token validation and the unconnected-online message are implemented. Actual OS link launching still needs a device build.
- Config introspection resolves without a made-up EAS project ID or signing credentials.
- Audio background playback/recording and microphone permission are disabled. Unused Android external-storage permissions are blocked. SecureStore biometric permission is disabled because no biometric auth is offered.
- EAS profiles prepare Android APK/AAB, physical iOS development/preview/store builds, simulator builds and interactive production submission. Production build numbering is remotely managed.

## Unresolved checks and limitations

1. **Native installation and binary builds:** this machine has no available iOS simulator runtime and no Android SDK/ADB. `xcrun simctl list devices available` showed only unavailable runtimes. No Android APK/AAB or iOS IPA was compiled, signed, installed or submitted. EAS builds require the owner's real Expo project and signing setup; physical iOS/TestFlight also require appropriate Apple accounts. Metro export is not native compilation.
2. **Device behavior:** physical touch feel, audio/silent-switch behavior, vibration, VoiceOver/TalkBack, Dynamic Type, OS back/edge gestures, actual notch/home-indicator layouts and background/resume must be checked on devices. AI timer cancellation/resume was exercised with automated hook tests, and storage hydration/recovery was exercised with AsyncStorage tests and browser reloads.
3. **Online/auth:** authentication, synced history, cross-device multiplayer/rankings and reconnection are not applicable to the current app. Shared interfaces and a native secure token adapter are prepared, with no claim of a working service. Universal/App Links require an owned domain and association files.
4. **Dependencies:** `npm audit` reports 71 affected dependency entries: 56 high and 15 moderate, with no critical findings. These include upstream `braces`, `node-forge`, `decode-uri-component`, `sprintf-js` and `uuid` advisories propagating through Expo/RN/Metro/Jest tooling and some runtime dependencies. This is not 71 distinct exploits. Audit suggestions include incompatible Expo/RN downgrades and major test/router changes; no blanket forced update was applied. Review patched SDK-compatible releases and audit the eventual signed release before public distribution. The audit is an unresolved dependency issue, not a passing security check.

## Device acceptance checklist

Use an EAS **preview** build for standalone offline checks; a development client/Expo Go needs Metro to initially load code.

- On iPhone and Android, complete AI games at all difficulties as X and O with both starters; verify turns, wins/draws and rematches.
- Rapidly tap empty/occupied squares during AI thinking; verify only one human turn is accepted. Undo a pending/answered AI move; restart and reset session scores.
- Background while AI is thinking, wait, reopen and confirm exactly one AI response. Relaunch during a human turn and after a completed match; confirm the saved board, score and history.
- Toggle airplane mode in the installed preview, then play, review history, change preferences and relaunch. Game assets must remain available.
- Check a small phone, a notched iPhone, Android gesture navigation and a tablet. Scroll all controls into view, inspect safe areas and test Android back / iOS back gestures. Close confirmation dialogs with Android back.
- Enable OS reduced motion and the app setting separately; check board/results/navigation. Use VoiceOver/TalkBack to hear square positions, state and turns. Try large system text.
- Test sound on/off, iPhone silent mode, haptics on/off, and background audio stopping. Hardware support can vary.
- Change name/theme and relaunch. Complete a draw and AI win/loss; verify history statistics from the human perspective. Review moves and confirm clear-history/reset-score behavior.
- Open a correctly formed and malformed native invitation link. Confirm it shows the current offline-only status and does not pretend to join a match.
- Verify development/preview/production names, identifiers, icon, splash, signing and install links; then complete store-specific privacy and beta review information with your own accounts.

Commands and signing instructions are in [the mobile README](../apps/mobile/README.md); implementation boundaries are in [mobile architecture](mobile-architecture.md).
