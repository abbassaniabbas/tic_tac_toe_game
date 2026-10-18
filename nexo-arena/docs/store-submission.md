# Store submission draft

No store account, signed binary or submission has been created. Complete this checklist using the actual production build and the publisher's accounts.

## Listing draft

**Name:** NEXO Arena

**Short description:** Play tic-tac-toe, explore Ultimate and sharpen your strategy.

**Description draft:** Play Classic against three AI levels or a friend on one device. Explore Ultimate, daily strategy puzzles and saved match reviews. Choose accessible preferences, sound and haptics. Local games work offline. With a configured online service, sign in by email to invite friends, play ranked Classic, try private Blitz and Ultimate rooms, and earn verified Studio palettes.

Trim the listing to the features enabled and verified in the submitted build. Capture screenshots from the actual standalone app on required phone/tablet sizes. Do not use browser preview screenshots as evidence of native behavior.

**Support contact:** abbassani94@gmail.com

**Required publisher values:** controlled production package/bundle identifier, Expo project ID, website domain, legal publisher identity, store records, appropriate content rating, privacy/support URLs and review account/instructions. The current `com.nexoarena.game` identifier is provisional.

Once hosted, configure `/privacy`, `/support` and `/delete-account` on the real HTTPS website. Account creation/deletion must be tested with the deployed service. Apple's [account deletion guidance](https://developer.apple.com/support/offering-account-deletion-in-your-app/) and Google's [account deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en) describe in-app and website expectations. The implementation provides an in-app flow and browser flow; those links are not a substitute for a functioning hosted service.

## Privacy and data inventory for publisher review

| Area                     | Current implementation to inspect in the production build                                                                                         |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local guest data         | Settings, practice progress and Classic history remain on the device; not uploaded as verified results                                            |
| Optional online identity | Email, display name, optional handle, selected language/region                                                                                    |
| Online gameplay          | Accepted moves, results, ratings, validated puzzle proofs, achievements and cosmetic choice                                                       |
| Public visibility        | Leaderboard opt-in defaults off; enabled entries expose handle, selected region and ranked statistics                                             |
| Retention/deletion       | Private profile/collection/solves removed; retained opponent match history anonymized; local guest data needs separate clearing                   |
| Hosting/authentication   | Supabase service logs may contain connection metadata; publisher must determine actual configured retention and processing                        |
| SDKs                     | Supabase, SecureStore, AsyncStorage, audio/haptics and Expo/React Native dependencies; inspect their final bundled privacy manifests and behavior |
| Permissions              | Source blocks microphone/storage recording requests and requests no camera or precise location; inspect final merged production permissions       |
| Tracking/ads             | No advertising or analytics SDK is intentionally included; verify dependencies and production configuration before making store declarations      |

Complete Apple App Privacy and Google Data Safety answers from the verified binary and deployed services. This inventory is a draft, not a completed legal disclosure. The publisher must review the notice, retention settings and SDK declarations. See Apple's [App Store review guidance](https://developer.apple.com/app-store/review/) and Google's [Data Safety guidance](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en).

## Binary and device gates

1. Configure production public backend/website values, controlled `APP_IDENTIFIER` and real `EAS_PROJECT_ID` in EAS production. See the [mobile README](../apps/mobile/README.md). The production pre-install hook validates these inputs.
2. Build signed Android AAB and iOS IPA using the publisher's accounts. Generate an internal APK/preview iOS build first for device QA. Review production manifests, included SDK privacy manifests, backup rules, transport restrictions, and stable invitation schemes.
3. Test clean install/update, account login/deletion, cross-platform matches, secure session recovery, offline launch, safe areas, tablet layout, VoiceOver/TalkBack and reduced motion on physical devices.
4. Complete store screenshots, descriptions, content ratings, privacy/deletion/support links and review access instructions. Verify the existing encryption declaration against the final app and answer export questions using the publisher's actual configuration.
5. Upload to internal testing/TestFlight, investigate crashes and review feedback, then use staged public rollout after the integration/security gates pass.

JavaScript exports and generated native projects do not establish signing, installation, platform compliance or store approval. Universal/App Links still need the actual domain and association files; pasteable codes and configured native schemes are the current invitation paths.
