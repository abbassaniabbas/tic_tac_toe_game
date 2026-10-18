# Phase 6 verification

Recorded 11 October 2026. Includes the initial local preparation, hosted backend deployment and authenticated browser checks. Email-code sign-in and a complete private Classic match are verified with two publisher-controlled accounts. Frontend publication, complete multiplayer/device integration and signed-device/store checks remain pending.

## Passed

| Check                                                        | Result                                                  |
| ------------------------------------------------------------ | ------------------------------------------------------- |
| ESLint and TypeScript, including service integration sources | Passed                                                  |
| Shared engine, protocol and lifecycle tests                  | 100 passed                                              |
| Database/security/clock/telemetry cases                      | 39 passed in PGlite and again in isolated PostgreSQL 17 |
| Web component tests                                          | 7 passed                                                |
| Native component/storage/lifecycle tests                     | 21 passed, including six/eight-digit login              |
| Release checks and patched Xcode UUID compatibility          | 5 passed                                                |
| Production web browser cases                                 | 20 passed, desktop and mobile viewports                 |
| Native component web preview cases                           | 8 passed, small phone and tablet viewports              |
| Guarded offline web release                                  | Passed; support email appears in the exported page      |
| Next.js static export and service worker                     | Passed; 37 precached assets/public documents            |
| Android/iOS Hermes and native web exports                    | Passed after adding compatible Expo System UI           |
| Android/iOS native configuration generation                  | Passed; no compilation or signing                       |
| Workflow YAML and pinned action revisions                    | Locally validated; remote workflow unexecuted           |

**200 distinct automated cases passed across the current local suites.** The 39 database cases are counted once even though run on two engines. Real-service integration and the optional latency probe are excluded. Five additional public-only hosted probes pass.

The browser suite checks game controls, dialogs, persistence, Studio, offline reload, information routes and configured/unconfigured entry states. The connected web suite passed 20 cases and native preview passed eight using `NEXO_EXPECT_ONLINE=1`. These preview cases are not installed-device or native accessibility tests.

## Hosted connection update

The supplied public key validates against `https://pukomenvobfltawmjpko.supabase.co`. Existing CLI access permitted deployment without requesting administrative credentials. A dry run listed the three expected migrations; they were applied and their remote versions match local history. A fresh invitation secret was configured through the CLI and its temporary file removed. `arena` version 1 is ACTIVE; every POST validates its user's token.

`npm run verify:hosted` passes five read-only checks: email Auth returns 200, anonymous profile access returns 401/42501, unsigned and forged-token arena requests return 401/unauthorized, and browser preflight returns 204 with required CORS headers. These probes do not create users or send email. Subsequent authenticated browser and two-player Classic checks are recorded below; broader service/device verification remains open.

The initial Expo exports retained old environment transforms. Export scripts now use `--clear`; fresh Android/iOS Hermes and native web bundles contain the supplied public project reference. Web export, configured browser suites, 21 native tests, lint, TypeScript and five release tests pass.

The initial CLI Auth configuration push returned HTTP 400 because email-template modification requires custom SMTP or an upgraded plan. After the publisher reported SMTP configured, the supported CLI push succeeded. A second push reports `auth: up_to_date`, confirming the repository's confirmation and magic-link code templates, six-digit codes, ten-minute expiry and local redirect configuration match the hosted settings. Native input also accepts eight-digit codes.

SMTP settings and credentials were preserved: `config.toml` intentionally has no `[auth.email.smtp]` section. The official CLI 2.111.0 [Auth sync source](https://github.com/supabase/cli/blob/v2.111.0/apps/cli/src/legacy/commands/config/push/config-sync/auth.sync.ts) omits SMTP update fields when that section is absent. Raw CLI output was captured privately; SMTP passwords were not extracted or printed.

The updated app at `http://localhost:4173` was reloaded and its Online form used to request a code for the publisher's supplied email. The form showed “Could not send a code. Please try again shortly.” One direct public-key Auth request confirmed HTTP 500, “Error sending confirmation email.” Neither attempt established successful delivery or sign-in. Detailed provider diagnosis requires the latest `/otp` error in [Auth Logs](https://supabase.com/dashboard/project/pukomenvobfltawmjpko/logs/auth-logs). The in-app dashboard is signed out, and native computer-use permission is unavailable; the publisher was asked for only the error message. See [SMTP diagnostics](smtp-setup.md).

The publisher subsequently supplied the failed request's Auth log. Its SMTP error is `535 5.7.8 Username and Password not accepted`, confirming Google rejected SMTP authentication. The publisher was directed to generate an app password for the configured Google account and enter/save it directly in Supabase. Full log metadata and network addresses were not copied into repository documentation.

After the publisher reported the SMTP password updated, the next request through the existing app sign-in form succeeded. The publisher entered the code directly in the app and reported “signed in.” No SMTP credential or OTP was supplied to this task.

### Authenticated browser verification

The existing browser session visibly shows **Welcome, Player** and **Sign out**. The profile editor loaded the stored display name and locale; no profile values or leaderboard consent were changed. Ranked status loaded **1500 Elo**, **0/10 placements**, and an empty eligible leaderboard. A new unrated private invitation was created and opened; its waiting room reached **Connected**. Reloading the app restored sign-in without another code, and the same room was available and reopened. The test invitation was cancelled through its normal game action; the room showed **Invitation cancelled**, and the lobby then showed **No open rooms**. Its cancellation record remains in the backend; no account or permanent data deletion was performed.

These are manual checks against the hosted backend and are not added to the 200 local automated cases. A second publisher-controlled email was supplied; its code request was accepted in a separate `http://127.0.0.1:4173` origin, preserving the first account at `http://localhost:4173`. The publisher entered its code directly and confirmed sign-in. Both previews use the browser client; they are not an installed-native-device test.

### Two-account hosted Classic match

- Both origins retained distinct signed-in accounts. The host created a new unrated private invitation; the second account joined it. Both match screens reached **Connected**.
- Accepted moves were X at square 1, O at 4, X at 2, O at 5, and X at 3. The other account received each board/turn update without a manual match refresh. Occupied squares and the inactive player's controls were disabled.
- After the first two moves, the second account's page was reloaded and the host made move three while its match screen was closed. The second account restored sign-in, found the active room, and reopened the correct three-move board before continuing. This checks reload/rejoin recovery, not a simulated network outage or token expiry.
- The final boards matched: X occupied squares 1–3, O occupied 4–5. The host saw **You won**, the guest saw **Player won**, and both boards disabled further moves.
- Both account histories listed the completed match, with no open rooms. The match remained labelled private and unrated; no ranked matchmaking was entered.
- The host's Replay Lab listed **Online · classic · 5 moves · X**. It loaded **ACCEPTED SERVER MOVES**, reconstructed the final board at 5/5, and navigated to the empty position at 0/5 and back to 5/5. No replay branch was committed or played.

Live synchronization was observed with subscriptions connected and the existing five-second reconciliation polling enabled. This browser check does not isolate Realtime event transport from that fallback. No session token, OTP or invitation was copied into documentation. The completed private match remains in both accounts' histories as a test game. Actual token expiry/refresh, deliberate network outages, ranked settlement, hosted signature-mode gameplay and installed native-device verification remain open.

Automatic approval review rejected reading the stored CLI token from macOS Keychain because that credential access was not specifically authorized. No token was obtained or exposed. Supported CLI commands were used for subsequent work; no credential extraction workaround was used.

## Open gates

### Real Supabase integration

Supabase CLI 2.111.0 attempted to download/start the local stack. With 4.4 GiB initially available, image extraction exhausted space and Docker reported a read-only metadata filesystem. The services never reached a usable stack. Docker was restarted and only the five completed image downloads introduced by this attempt were removed; pre-existing images and volumes were preserved. About 2.3 GiB remained after recovery. The isolated PostgreSQL test suite subsequently passed.

`npm run test:integration` correctly fails with a local-services-unavailable message. Its seven cases, plus the optional 40-request latency probe, have **not run successfully**. CLI status mapping, local Mailpit OTP transport and the complete deployed Edge/Realtime integration harness still need the full run. The hosted manual Classic checks above cover a narrower browser flow. Cross-client web/native games, actual session expiry, background/resume during outages, signature modes, ranked settlement and hosted latency remain pending.

### Dependency audit

The final `npm audit --json` reports **63 affected dependency entries: 56 high and 7 moderate, no critical**. These entries include transitive parents and represent four underlying advisories, not 63 distinct flaws. The Xcode-only `uuid` override to 11.1.1 removed its reported advisory; the compatibility regression generates 100 valid unique project IDs.

Remaining roots:

| Dependency           | Severity | Advisory                                                                 |
| -------------------- | -------- | ------------------------------------------------------------------------ |
| braces               | High     | [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) |
| node-forge           | High     | [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv) |
| decode-uri-component | Moderate | [GHSA-vcc3-ghjq-m6fr](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr) |
| sprintf-js           | Moderate | [GHSA-hp3w-g68c-fv3c](https://github.com/advisories/GHSA-hp3w-g68c-fv3c) |

At verification, the available braces, node-forge and sprintf-js releases were still affected. The patched decode-uri-component release changes module format and cannot safely replace the CommonJS dependency used by query-string through a blind override. The audit's proposed forced Expo downgrade would leave SDK 57; it was not applied. Assess reachability, obtain compatible updates or document specific reviewed exceptions. The CI high-advisory gate currently fails; no green security result is claimed. Audit results can change and should be captured again for release.

### Native tooling and devices

Expo Doctor passed 21/21 before generating native directories. Its final run after prebuild passed **20/21**, with the CocoaPods tooling check failing; CocoaPods is unavailable. Both configuration prebuilds completed. Android's automatic appearance warning was resolved with SDK-compatible `expo-system-ui ~57.0.4`.

The machine has Xcode 26.4 and an available iOS 18.5 simulator runtime. Android platform tools/emulator and an Android 34 platform are present, but the complete SDK/NDK/JDK toolchain needed for this app was not validated; the default Java is 11. No simulator/emulator app was compiled or launched in this phase. No APK, AAB, IPA, TestFlight build, physical-device installation, native screen-reader review or signing result exists.

Generated Android configuration removes microphone/external storage permissions; iOS source configuration requests no camera, microphone or location usage. Final merged manifests, SDK privacy manifests and store disclosures must be inspected in the actual production binary.

### Hosting and publisher inputs

The authorized support email and public Supabase values are in ignored local web/native environments. The web online configuration check and connected build pass. A hosting domain/account, Expo project ID, controlled app identifier and signing/store accounts remain unspecified. Hosted migrations and function deployment occurred as recorded above; no frontend publication, signing, GitHub workflow run or store submission occurred.

Untimed ranked games currently remain open after a disconnect. A launch decision about ranked stalling/disconnect behavior and evidence of its fairness/load behavior are still required. No policy change was introduced during release preparation.

See [Phase 6 guide](phase-6.md), [release operations](release-operations.md), and [store checklist](store-submission.md) for the remaining actions.
