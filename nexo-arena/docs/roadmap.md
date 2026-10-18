# NEXO Arena delivery roadmap

The original briefs explicitly specified Phases 1 and 2. Subsequent phases are planning groups based on their multiplayer and signature-mode roadmap. These groups can be split as scope grows; they are not a fixed original six-phase specification.

| Phase | Scope                                                                                                                       | Current status                                                                                                                                     |
| ----- | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Premium browser game, shared Classic rules/AI, accessible controls, offline PWA                                             | Implemented and locally verified                                                                                                                   |
| 2     | Native Expo Android/iOS app, persistence, settings, local history/review, build configuration                               | Implemented; signed builds and physical-device checks pending                                                                                      |
| 3     | Shared accounts, protected profiles, private invitations, authoritative matches, reconnection, online history               | Implemented; hosted two-account browser Classic match/recovery/history verified; full service/device integration pending                           |
| 4     | Public ranked matchmaking, Classic Elo, placements, global/regional opt-in leaderboards                                     | Implemented locally; full service/device integration and production load validation pending                                                        |
| 5     | Ultimate, server-timed Blitz, curated strategy puzzles, Replay Lab; achievements and cosmetics backed by verified telemetry | Implemented and locally verified; full service/device integration pending                                                                          |
| 6     | Full service integration, release QA, deployment, signed Android/iOS builds and store preparation                           | In progress; offline release checks, public information pages, CI and integration harness prepared; service/security/hosting/signing gates pending |

**Phase 6 is underway. No further numbered phases remain in this plan.** Pending verification from earlier phases remains release work. The hosted backend is deployed and a two-account browser Classic match, reload/rejoin recovery, history and server replay are verified. Public frontend publication and complete release verification remain pending.

Phase 5 delivers versioned Ultimate and Blitz protocols, a seven-puzzle UTC rotation, exact Classic analysis, accepted-log replay validation and evidence-backed achievements/cosmetics. Ultimate and Blitz are private and unrated; untimed Classic Elo stays separate. Blitz deadlines use server time and settle on authorized access, with no background deadline scheduler. Offline practice and replay branches grant no server telemetry.

Phase 6 must exercise real email OTP, refresh/session expiry, Auth/PostgREST/Edge/Realtime integration, two distinct accounts across web and native clients, outages/resume, signing, safe areas, accessibility and installation. Public matchmaking needs latency/throughput benchmarks, monitoring and ranked disconnect/stalling policy before launch. Deployment and store publishing use the user's real services and credentials.

See [Phase 3 setup](phase-3.md), [Phase 4 implementation](phase-4.md), [Phase 5 implementation](phase-5.md), [Phase 6 release guide](phase-6.md) and [actual release verification](phase-6-verification.md).
