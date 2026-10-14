# Beget hosting and S3 (Next only)

## Deployment to regular Beget hosting

Build the Vite application with `npm ci && npm run build`. Upload the *contents* of `dist/` to the domain's document root. Vite copies `public/.htaccess` into `dist/.htaccess` for Apache SPA routes. Check that the purchased hosting supports .htaccess and mod_rewrite; if the server uses nginx exclusively, configure fallback in the hosting panel/support.

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for the **new, separate** Supabase project at build time. Never ship the old production project's credentials to the Next build. After deploying, configure allowed authentication redirect URLs in the new Supabase project.

## Beget S3 design (not enabled yet)

Do not place S3 access keys in Vite environment variables, browser bundles, or GitHub commits.

Planned secure flow:
1. Browser authenticates with Supabase.
2. Browser requests a short-lived upload/download URL from a Supabase Edge Function.
3. Function verifies JWT, board membership, teacher/student permissions, MIME, size, and ownership using server-side data (not trusted client claims).
4. Function signs S3 request with Beget credentials in server-side secrets and returns a short-expiry presigned URL.
5. Browser transfers the binary directly to Beget S3. Store only object metadata and keys in PostgreSQL; downloads require authorization each time.
6. Delete/cleanup and storage quotas must follow board permissions and expiration policy.

Use private buckets. Configure narrow CORS for the new domain and localhost during development. Require HTTPS. Add short expiry and content limits; do not let users choose arbitrary key prefixes. Keep existing asset storage until the full permission and migration tests pass.

## Release gates
- Separate Supabase project verified
- Auth, roles, invisible-admin behavior, drawing realtime tested
- Protected upload/download tested in two accounts
- Static host SPA routing tested
- Backup and restore strategy agreed before public launch
