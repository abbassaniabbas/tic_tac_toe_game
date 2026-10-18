# Release operations

Use separate staging and production projects. This runbook has not been executed against a hosted project.

## Before enabling accounts

1. Run local application/database/release suites and real Supabase service integration on a machine with sufficient disk space. Review the dependency audit and its unresolved gates.
2. Provision staging Supabase and verify its project identity before linking the CLI. Review the three versioned migrations and database backups. Apply migrations to the intended project; never reset a production database.
3. Set a securely generated stable `INVITE_SIGNING_SECRET` as an Edge Function secret. Deploy `arena`. The gateway JWT check is disabled intentionally, while every POST calls Auth to validate its bearer token. Confirm unauthenticated and forged requests fail.
4. Configure a real SMTP service, signup and magic-link email templates containing the six-digit token, expiry/resend limits, and the actual website URL. Test deliverability with two controlled accounts. Set appropriate project rate limits and confirm they allow the intended usage.
5. Check RLS and Realtime publication/subscription behavior using those accounts. Verify participants can resume accepted games while unrelated users cannot read them or write results, ratings, awards or cosmetics directly.

Use [Supabase deployment guidance](https://supabase.com/docs/guides/deployment) and [email OTP configuration](https://supabase.com/docs/guides/auth/auth-email-passwordless) for the service setup. Public keys go in client build environments; admin keys and invitation secrets remain server-side.

## Release QA

- Play web → native and native → web Classic, ranked, Ultimate and Blitz games. Confirm duplicate requests settle once and old revisions cannot overwrite new snapshots.
- Exercise actual token expiry/refresh, sign-out, process restart, poor connectivity, Realtime interruption, backgrounding and recovery. Clients must fetch accepted state before accepting more moves.
- Verify account deletion from native Settings and the browser deletion page. Check profile/collection/solve removal, anonymized opponent history, closed open matches and revoked access. Separately clear guest device data.
- Complete the verification/device checklists from earlier phases: safe areas, small screens/tablets, VoiceOver/TalkBack, text scaling, reduced motion, touch controls, audio/haptics, links and airplane-mode local play.
- Benchmark staging queue/move latency and concurrent pairing against an explicit launch traffic target. The small local status probe is only a baseline. Decide and validate untimed ranked stalling/disconnect behavior before public ranked launch. Blitz timeout settles on access; there is no background adjudication scheduler.
- Validate the actual HTTPS site's installation, service worker updates, offline information pages and support email. Confirm API responses and authenticated data are excluded from precaching.

## Rollout and recovery

1. Record the database migration version, function revision, client commit/build identifiers and public environment targets. Back up production and rehearse restore on staging before migration.
2. Apply reviewed additive migrations before the function/client versions that require them. Keep prior clients compatible during staged rollout. Publish clients after staging QA and the release gates are satisfied.
3. Release a small controlled cohort first. Observe aggregate command errors, authentication failures, queue age, move latency, Realtime recovery and rating settlement. Do not log OTPs, authorization headers, refresh tokens, invite codes or full private game/profile payloads.
4. Define thresholds and an on-call owner before public launch. No scheduled monitoring or alerts have been provisioned by this repository.
5. For a client regression, restore the last verified static artifact or store build through its release channel. For a function regression, redeploy the compatible previous revision. Do not casually reverse database migrations; use a reviewed forward repair or the rehearsed restoration procedure.
6. Re-test sign-in, one accepted game, deletion, and offline local play after recovery. Retain anonymized incident evidence and update the verification record.

Store rollout additionally requires the publisher accounts, signed binaries and [submission checklist](store-submission.md). Configuration validation alone is not an authorization, credential test or proof of a live service.
