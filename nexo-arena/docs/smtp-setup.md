# SMTP setup for initial testing

**Current status (11 October 2026):** The publisher updated the SMTP password after Google rejected authentication with `535 5.7.8`. The next sign-in request succeeded, and the publisher confirmed sign-in. The authenticated web app loaded the profile and ranked status, created/opened/cancelled a private room, and restored the session after a reload. A second publisher-controlled account also signed in and completed a private Classic match with the first. The six-digit/ten-minute code configuration and templates remain applied. Production deliverability and installed-device checks remain open.

The initial template update failed while the default mail provider was enabled. Custom SMTP allows application email delivery; the default provider restricts recipients to project team members. [Supabase SMTP guidance](https://supabase.com/docs/guides/auth/auth-smtp).

1. Sign in to Google as `abbassani94@gmail.com`. Enable **2-Step Verification**, then open [App Passwords](https://myaccount.google.com/apppasswords) and create one named **NEXO Arena SMTP**. Some account policies hide this option. [Google's app-password instructions](https://support.google.com/accounts/answer/185833?hl=en).
2. Open [this project's SMTP settings](https://supabase.com/dashboard/project/pukomenvobfltawmjpko/auth/smtp), enable custom SMTP, and enter:

| Field        | Value                             |
| ------------ | --------------------------------- |
| Sender email | abbassani94@gmail.com             |
| Sender name  | NEXO Arena                        |
| Host         | smtp.gmail.com                    |
| Port         | 587                               |
| Username     | abbassani94@gmail.com             |
| Password     | The generated Google app password |

Use TLS/STARTTLS if a transport selector appears. These are [Google's SMTP settings](https://support.google.com/mail/answer/7104828?hl=en-en). Enter the app password only in Supabase; keep it out of chat, app environment files and Git.

3. Save the SMTP configuration. The repository's email-code templates and expiry are now applied. After resolving the delivery error below, request a code through **Online** at `http://localhost:4173`, enter the received code directly in the app, and verify sign-in. Gmail is the initial testing option here; complete production sender/deliverability checks before public launch.

## Resolve the previous authentication error

The supplied log confirmed SMTP authentication failed. The publisher subsequently reported the password updated, and the app's next email request succeeded. If this authentication error recurs, create a fresh app password while signed in as `abbassani94@gmail.com` at [Google App Passwords](https://myaccount.google.com/apppasswords), then enter it directly in this project's SMTP **Password** field without the display spaces. Confirm the **Username** and **Sender email** are both `abbassani94@gmail.com`, then save. Use the generated app password rather than the ordinary Google account password. Google requires 2-Step Verification for app passwords and revokes them after an account password change. [Google's instructions](https://support.google.com/accounts/answer/185833?hl=en).

The publisher must enter and save this credential directly in Supabase. After saving, report that the SMTP password was updated so the sign-in request can be tested again. Do not paste the app password into chat.

Open [Auth Logs](https://supabase.com/dashboard/project/pukomenvobfltawmjpko/logs/auth-logs), select the latest failed `POST /otp` request, and inspect its `error` message. The public HTTP 500 response does not identify the cause. Supabase recommends checking Auth logs to distinguish SMTP, database and template errors. [Supabase's 500-error guide](https://supabase.com/docs/guides/troubleshooting/resolving-500-status-authentication-errors-7bU5U8).

- If the error reports authentication failure, re-enter the Google **app password** directly in Supabase and save. Confirm the sender email and SMTP username match the Google account used to generate it.
- If it reports DNS/connection failure, check for spaces or typos in `smtp.gmail.com` and verify port `587` for TLS/STARTTLS against the provider settings.
- If it reports provider rate limiting, wait for the provider's stated retry window before requesting another code.
- If it reports a template error, inspect the saved template. The repository uses the supported `{{ .Token }}` variable with closed HTML tags.

Share only the error message when asking for help, rather than full log metadata. No Google password, app password or SMTP credential was entered, extracted or printed by this task. The first two sign-in requests failed; the third was accepted after the publisher updated the password, and the publisher completed sign-in directly in the app. The absent `[auth.email.smtp]` block in `config.toml` preserves the dashboard's SMTP configuration during CLI sync.
