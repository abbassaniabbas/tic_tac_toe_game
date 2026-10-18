# Phase 6: release preparation

**Status: in progress.** Web and native development builds now use Supabase project `pukomenvobfltawmjpko`. All three migrations are applied, the server invitation secret is configured, and `arena` version 1 is active. Five read-only hosted checks pass. Email-code sign-in now works after the publisher corrected the SMTP password. The hosted browser app loaded the profile/ranked status, created/opened/cancelled a private room, and restored the account session after reload. Two publisher-controlled accounts completed a private Classic match with synchronized moves, reload/rejoin recovery, matching history and accepted-server replay. Complete multiplayer/service/device verification, security fixes, a public website domain, signed apps and store release remain pending. See [actual verification](phase-6-verification.md) and [SMTP setup](smtp-setup.md).

## Delivered locally

- Public `/privacy`, `/support` and `/delete-account` pages, linked from the arena. The deletion page uses the existing email sign-in and account deletion flow when a backend is configured. The default offline release explains that online services are unavailable.
- Shared privacy information in native Settings. A configured `EXPO_PUBLIC_WEB_URL` also opens the website's support page.
- Offline caching for these public information pages. Clean HTML routes work in the local preview and Vercel configuration.
- Release input checks, five regression cases, and an EAS production pre-install check. These reject missing publisher metadata, provisional app identifiers, local production endpoints and public administrative keys without printing their values.
- Seven real-service integration cases and an optional local HTTP latency probe. They are prepared and typechecked; the local stack could not start, so these cases have not passed.
- A GitHub Actions workflow for application checks, disposable Supabase integration and the dependency audit. It has not run on GitHub.
- A compatible Xcode `uuid` dependency override and Expo System UI module. Other dependency advisories remain open.

## Build the offline website

The current ignored web/native environment files contain the supplied public backend configuration; the web offline-release flag is empty. They contain no administrative credentials. For a separate offline guest build on a fresh checkout, copy `apps/web/.env.example` and set:

```dotenv
NEXT_PUBLIC_SUPPORT_EMAIL=abbassani94@gmail.com
NEXO_OFFLINE_RELEASE=1
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

From `nexo-arena`:

```bash
npm run release:check -- --target=web --offline
NEXO_BUILD_CACHE=0 npm run release:web
npm run preview
```

Open `http://localhost:4173`. `apps/web/out` is the static artifact. The cache flag only reduces local build disk usage. The release wrapper loads the same production web environment files as Next.js; it checks input shape, not endpoint ownership or service availability.

For Vercel, use root directory `nexo-arena`, framework **Other**, install `npm ci`, build `npm run release:web`, output `apps/web/out`, and Node 24. Set the public contact and offline flag in Vercel's build environment; ignored local files are not deployment configuration. Verify the resulting HTTPS site and offline installation on real phones. Hosting account/domain selection and deployment remain pending.

## Exercise the actual local services

Docker needs sufficient free space for the Supabase images and its writable disk. The attempted download exhausted the machine's available 4.4 GiB; free additional space outside this task before trying again. Existing user volumes and unrelated images were preserved. [Supabase's local development guide](https://supabase.com/docs/guides/local-development) describes the Docker services.

```bash
supabase start --exclude studio,postgres-meta,storage-api,imgproxy,logflare,vector,supavisor
```

Create the ignored `supabase/.env.local` from its example and give `INVITE_SIGNING_SECRET` a securely generated stable value. In another terminal:

```bash
supabase functions serve arena --env-file supabase/.env.local
```

Then:

```bash
npm run test:integration
npm run test:load
```

The runner obtains credentials privately from local CLI status and refuses non-loopback API, mail and database addresses. Tests create two unique local email accounts, retrieve real codes from Mailpit, and call the deployed Edge handler using the actual SDK. They cover session refresh/restoration, profile RLS, Realtime notification, Classic idempotency/replays, ranked settlement, Ultimate routing, Blitz timeout, puzzle awards and account deletion. Cleanup targets the recorded test accounts. A disposable local stack is recommended because an interrupted run can leave fixtures.

The Blitz case waits for an actual clock debit and then advances its fixture's SQL deadline to exercise timeout without a minute-long test. The optional probe sends 40 authenticated status requests at concurrency five and reports aggregate p50/p95 times. It has no production capacity threshold; neither integration cases nor probe ran successfully here. Mailpit is part of [Supabase local testing](https://supabase.com/docs/guides/local-development/cli/testing-and-linting).

## Activate online builds later

The initial database/function deployment and email-code template configuration are complete. Run `npm run verify:hosted` for five public-only Auth, profile protection, function authentication and CORS probes. This does not create users or verify email delivery. Both apps' sign-in screens were checked with `NEXO_EXPECT_ONLINE=1`. Native exports clear Metro caches so changed public environment values are included. Hosted web sign-in, profile/ranked reads, private-room creation/cancellation, session restoration, and two-account Classic gameplay/history/replay now pass. Verify the remaining multiplayer/service/device cases. See [SMTP setup and diagnostics](smtp-setup.md).

1. For another staging/production project, Review/apply all three migrations, deploy `arena`, set the stable server signing secret, and configure email OTP templates/SMTP. Use [release operations](release-operations.md).
2. Complete the local service suite, then the two-account web/native staging checks, expiry/outage/resume checks and release load evaluation.
3. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in the web build environment. Clear `NEXO_OFFLINE_RELEASE`; run `npm run release:check -- --target=web` and `npm run release:web`.
4. Set matching `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, the actual HTTPS `EXPO_PUBLIC_WEB_URL`, controlled `APP_IDENTIFIER`, and real `EAS_PROJECT_ID` in EAS production. The production profile sets `APP_VARIANT=production` and its pre-install hook checks these fields. Preview builds remain available for testing.
5. Resolve dependency advisories or record a specific reviewed risk decision before publishing. Complete signed-device QA and [store preparation](store-submission.md).

Public configuration checks do not validate credentials, DNS, ownership, security acceptance or signing. Keep server/admin credentials out of client variables and source. Backend checks use `--target=backend` with `SUPABASE_PROJECT_REF` and `INVITE_SIGNING_SECRET` supplied in the process environment. `--target=mobile` checks native production inputs. The default all-target check also requires the two clients to use the same backend URL.

There are **no further numbered phases in the current six-phase plan**. Phase 6 remains open until its integration, security, hosting and signed-device gates are satisfied.
