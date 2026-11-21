# Android update policy

The regular Android application checks the public endpoint
`GET /api/v1/mobile/android-update` before login on launch, when returning to
the workspace after a while, and on demand in Settings. Browser/PWA, iOS and
isolated offline QA builds do not use this APK prompt.

The server caches the official public GitHub releases for five minutes, ignores
drafts/prereleases and incomplete/foreign assets, and returns the exact tagged
APK URL, size, latest version and minimum supported version. Routine checks use
the small latest-release API response; if it fails, the public GitHub latest
download redirects are an independent fallback. HEAD requests verify that both
official assets exist at the same valid Android tag, without downloading the APK.
A release becomes visible automatically after the existing permanent-signing and
login-smoke publication job succeeds.

Temporary GitHub fetch failures retain the last verified release and are
retried after one minute. On a cold start during an outage, the catalog can
offer the checked-in, previously verified signed release (1.0.4710) until the
live catalog recovers. Requests wait at most five seconds for the shared
refresh, which continues in the background if necessary. A successful empty catalog invalidates that fallback;
it does not advertise a release the live catalog no longer lists.

- Ordinary releases: leave `LEKTRUS_ANDROID_MINIMUM_VERSION` at its default
  `1.0.0`. The prompt can be deferred for 24 hours for that exact release.
- Breaking releases: only **after** a compatible signed APK is published, set
  the Amvera server environment variable `LEKTRUS_ANDROID_MINIMUM_VERSION` to
  the earliest compatible version (e.g. `1.0.4670`). An older updater-aware
  client cannot dismiss the prompt. Revert the variable to relax the policy.
  A minimum beyond the latest published APK is ignored to prevent lockout.
- Failure to reach the release service does not prevent app startup; check
  again on resume or manually. A successful mandatory gate is not bypassed
  by a subsequent transient request failure. Foreground checks do not replace
  or reload an active lesson.
- Downloads open the exact official HTTPS release asset in Android's browser;
  the user confirms installation via Android. No silent install, temporary
  signing key or Play Protect bypass is used.

Versions shipped before this updater cannot display an update dialog. They
must install the first updater-aware APK manually. This is a client UX gate,
not a replacement for backward-compatible server protocols or server-side
authorization.
