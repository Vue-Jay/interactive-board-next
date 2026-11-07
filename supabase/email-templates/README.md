# Lektrus signup confirmation

In Supabase Dashboard, open **Authentication → Email Templates → Confirm signup**.
Paste `confirm-signup.html` into the message body and set the subject to the text in
`confirm-signup-subject.txt`.

The button uses Supabase's `{{ .ConfirmationURL }}`. The app sends a redirect URL
when a registration starts, so add the app's deployed HTTPS URL to **Authentication
→ URL Configuration → Redirect URLs**. Add the exact local development URL too
when testing from `npm run dev` (including the LAN address used by another device).
For native builds, also allow:

```text
ru.lektrus.board://auth/confirmed
```

The native app opens this link through Android/iOS app linking, completes the
confirmation session, and signs the user in. Web and installed web apps return to
the same Lektrus site and complete sign-in there.
