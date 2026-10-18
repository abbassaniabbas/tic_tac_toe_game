# NEXO Arena · Android & iOS

A native Expo app extending the existing NEXO Arena web game. React Native views, touch controls, SVG marks, native navigation, audio and haptics; no WebView. Both applications import `@nexo/engine` for every move, outcome, AI decision and session score.

Includes Easy/Medium/Hard AI, local two-player games, mark/starter selection, undo, restart, rematches, animated marks/winning lines/results, dark/light/system themes, sound mute, haptics, reduced motion, local player name, current-game recovery, the latest 200 completed matches, statistics and move-by-move history review. All assets are bundled; installed preview/production builds work offline. Development builds need Metro to load their JavaScript.

## Start locally

From the repository's `nexo-arena` directory:

```bash
npm ci
npm run mobile
```

Requirements: Node 22.13+ (verified with Node 24), Expo SDK 57, React Native 0.86.3 and React 19.2.3. These versions are pinned to Expo's compatibility map. A single root npm lockfile covers every workspace. Metro's default Expo monorepo support resolves the shared packages.

### Test on your iPhone

1. Install Expo Go from the App Store. It must support SDK 57.
2. Connect the iPhone and computer to the same Wi-Fi.
3. From `nexo-arena/apps/mobile`, run `npx expo start --go`.
4. Scan the terminal's QR code with the iPhone Camera and open in Expo Go.
5. If LAN networking is blocked, try `npx expo start --go --tunnel` (requires internet and Expo's tunnel dependency).

Expo Go is a quick development option. If its available version does not support this SDK, use an EAS development build below. SDK 57 requires iOS 16.4+. Expo Go uses its own app icon/splash and scheme; verify the standalone app's branding and links in a development/preview build.

### Test on Android

Install a compatible Expo Go from Google Play, run `npx expo start --go` in `apps/mobile`, then scan the QR code from Expo Go. Android 7+ is required. For an Android emulator, install Android Studio and an emulator first, launch it, then run `npm run mobile:android` from `nexo-arena`.

For the iOS simulator, install a supported Xcode and iOS runtime, then run `npm run mobile:ios`. Native local SDK 57 builds require Xcode 26.4+. The current machine has Xcode 26.4, an iOS 18.5 simulator runtime and partial Android tooling. CocoaPods and a complete validated Android SDK/NDK/JDK build setup remain pending. See the [current release verification](../../docs/phase-6-verification.md).

## EAS setup

Run these commands **inside `nexo-arena/apps/mobile`**:

```bash
npx eas-cli@latest login
npx eas-cli@latest init
```

Use your own Expo account/project. Because `app.config.ts` is dynamic, EAS may ask you to add the real project UUID manually. Set `EAS_PROJECT_ID` to that UUID and `APP_IDENTIFIER` to an identifier you control, such as your organization's reverse-domain identifier. The checked-in `com.nexoarena.game` is provisional. These values are public metadata, not credentials.

Copy `.env.example` to `.env` for local development. For cloud builds, configure `EAS_PROJECT_ID` and `APP_IDENTIFIER` as plaintext EAS environment variables in **development**, **preview** and **production** environments, or replace the public defaults in `app.config.ts` with your real project metadata. Do not rely on an ignored local `.env` file being uploaded. The build profiles select `APP_VARIANT` automatically. Do not embed signing credentials, backend administrative keys or server secrets in source or `EXPO_PUBLIC_*` variables.

| Profile                 | Output / use                                                                  |
| ----------------------- | ----------------------------------------------------------------------------- |
| `development`           | Internal Android APK / physical iOS development client; loads JS from Metro   |
| `development-simulator` | iOS simulator development client                                              |
| `preview`               | Internal standalone Android APK / signed physical iOS app; bundled offline JS |
| `preview-simulator`     | Standalone iOS simulator preview                                              |
| `production`            | Android AAB / iOS store build; remote build numbers increment automatically   |

Development uses identifiers ending `.dev`, preview `.preview`, and production the base identifier. Schemes are `nexoarena-dev`, `nexoarena-preview` and `nexoarena`. Keep the production identifier stable after store registration.

### Installable Android APK

```bash
npx eas-cli@latest build --platform android --profile preview
```

EAS will offer to manage Android signing with your authorization. Download the resulting APK from the build page to your Android phone, allow installation from that source, then install. This preview APK includes JavaScript and assets; it works without Metro and can be tested in airplane mode. An AAB is for Google Play, not direct installation:

```bash
npx eas-cli@latest build --platform android --profile production
```

### Native development clients

```bash
npx eas-cli@latest build --platform android --profile development
# Or, for a registered physical iPhone:
npx eas-cli@latest device:create
npx eas-cli@latest build --platform ios --profile development
npx expo start --dev-client
```

Install the build using the EAS link and open its Metro QR code. Physical iOS signing requires an eligible Apple Developer account and provisioned device. For a simulator use `development-simulator` or `preview-simulator`, then install the resulting simulator app using EAS or Xcode's simulator tools.

### Prepare TestFlight

1. Set your controlled production bundle identifier and real Expo project ID.
2. Sign in with your Apple Developer account and create the matching App Store Connect app.
3. Build and submit from `apps/mobile`:

```bash
npx eas-cli@latest build --platform ios --profile production
npx eas-cli@latest submit --platform ios --profile production
```

4. Supply your real Apple/App Store Connect credentials when EAS prompts. Credentials are not included in this repository.
5. Wait for Apple's processing, complete export-compliance/app privacy/test information as applicable, then add TestFlight testers and install using Apple's TestFlight app. External testing may require Apple's beta review.

`eas.json` prepares the build profiles and an interactive production submission profile. No paid account, signing credential, store record or successful binary build is assumed. Android APK/AAB and iOS IPA/TestFlight builds were **not generated** in this environment.

## Accounts, invitations and online play

Phase 3 adds native email-code sign-in, protected profiles, shared private matches, online history, reconnection and account deletion. Offline guest play remains available without configuration. See the [Phase 3 setup guide](../../docs/phase-3.md) and [actual verification](../../docs/phase-3-verification.md).

Phase 4 adds ranked untimed Classic matchmaking, Elo placements, accepted rating changes and global/regional leaderboards with an explicit profile opt-in. Backgrounding/navigation cancels an unmatched queue ticket; accepted matches remain resumable. See [Phase 4 setup](../../docs/phase-4.md), [verification](../../docs/phase-4-verification.md) and the [remaining phases](../../docs/roadmap.md). Full backend service/device integration still needs verification.

Phase 5 adds a native **Studio** tab: persisted local Ultimate, daily strategy puzzles, Replay Lab with sandbox branches and exact Classic analysis, private online Ultimate/60-second Blitz rooms, verified achievements and Studio palettes. Apply all three migrations. Native room subscriptions stop on background/navigation and require a fresh server snapshot on resume; Blitz deadlines continue on the server. Studio tokens can be pasted or shared. See [Phase 5 guide](../../docs/phase-5.md) and [verification](../../docs/phase-5-verification.md).

Phase 6 adds shared privacy information in Settings and a production EAS pre-install hook. Production requires a controlled identifier, real Expo project UUID, production variant, HTTPS website and public backend configuration. Run `npm run release:check -- --target=mobile` from the monorepo with those values in the process environment before building. Development/preview builds can still test offline. Signed binaries, real service/device integration and store submission remain pending; see [Phase 6](../../docs/phase-6.md) and [store preparation](../../docs/store-submission.md).

Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to the same backend used by the website. Set `EXPO_PUBLIC_WEB_URL` to your actual HTTPS web deployment for browser invitations and support. It is optional during development and required by the production release check. Include these public values separately in each EAS development/preview/production environment; rebuild after changes. Never use a secret or service-role key in a client build.

Production recognizes `nexoarena://invite/TOKEN`, where TOKEN is the 48-character invitation returned by the backend. Use variant schemes for development/preview. Pasteable invitation codes work in every client. Universal/App Links require a real domain and association files and remain unconfigured.

`lib/online.tsx` adapts the shared SDK to Expo SecureStore and AppState. Large SDK sessions are chunked with an atomic manifest; token storage does not use AsyncStorage. Native match subscriptions stop when navigating away or backgrounding; reconnection fetches the authoritative board before accepting moves.

## Verification

```bash
# From nexo-arena:
npm run typecheck
npm run lint
npm test
npm run test:mobile
npm run mobile:export
npm run build
npx playwright install chromium
npm run test:e2e
# Optional native-component web preview checks (not native-device tests):
npm run export:web --workspace=@nexo/mobile
npm run test:mobile-ui
# From apps/mobile:
npx expo-doctor
```

Native exports produce Android/iOS Hermes bundles under `dist-native`; they check JavaScript/assets, not signing or installation. Export scripts clear Metro transforms to include changed public variables. Use `NEXO_EXPECT_ONLINE=1 npm run test:mobile-ui` for a configured native web preview. The current ignored development `.env` uses the supplied Supabase project. [SMTP email-code sign-in](../../docs/smtp-setup.md) is verified in the browser app; installed native sign-in and device integration remain pending.

See [architecture](../../docs/mobile-architecture.md) and [actual verification and device checklist](../../docs/mobile-verification.md). Font licenses are in `assets/fonts`. Icons are derived from the existing geometric brand; `node scripts/generate-mobile-assets.mjs` regenerates them from the monorepo root. The small WAV effects were synthesized for this project.
