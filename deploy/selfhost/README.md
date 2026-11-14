# Lektrus on one VPS: migration in progress

**Status:** pilot API and PostgreSQL validated by GitHub Actions, **NOT production-ready**.
This is not a drop-in replacement for Supabase. Never change the current Timeweb
frontend's Supabase URL until the full parity checklist is complete.

## What exists

- PostgreSQL 17 with tables for users, sessions, boards, memberships and documents.
- Password verification using bcrypt (compatible with the currently observed Lectrus
  Supabase Auth password hash format), 15-minute access JWT, single-use rotated refresh
  tokens, explicit logout revocation and server-side board access checks.
- New board creation, listing, document reads, document writes with optimistic version
  checks and WebSocket revision notifications (no full JSON document pushed over WS).
- Docker Compose with PostgreSQL and API on an internal-only Docker network, Caddy
  reverse proxy for HTTPS and static frontend hosting.
- An importer from Supabase Postgres to **a separate empty database**, read-only by
  default. Preserves user IDs, bcrypt password hashes, selected profile details and
  subscriptions, board IDs, ownership, memberships, document JSON and versions.
- Private Storage API for board files: authorized upload/read/HEAD/delete/list,
  streamed uploads up to 50 MB, SHA-256 metadata, conditional ETag reads,
  range downloads and protected SVG headers. The files live on a dedicated
  Docker volume, not in the website directory.
- Separate Storage importer: read-only manifest check by default, verified
  HTTP streaming from Supabase into private staging, one SQL transaction,
  SHA-256/byte-count checks, and refusal to overwrite target assets.
  The actual 59 source files have **not** been copied to a VPS yet.
- Integration tests with temporary PostgreSQL databases, synthetic private
  images, simulated HTTPS downloads and container build in CI.

## Current measurements (2026-11-14)

Supabase Lectrus contained: roughly 56 MB database, 9 boards, 7 stored board
documents, 2 accounts, 2 editor membership links, 59 Storage files totalling
22.55 MB. These are *storage sizes*, not the monthly egress measurement.
The specific high-egress endpoint has not yet been confirmed.

## Not yet implemented; do not cut over

- Public signup, email confirmation, password reset, anonymous guest sessions.
- **Actual copying** of the 59 production Storage objects and final integrity
  verification after a VPS is provisioned. Only a simulated import was tested.
- Supabase RPC compatibility for sharing, invites, templates, assignments,
  schedules, notifications, chat, history, trash, billing and school features.
- Supabase Realtime presence/broadcast protocol, multi-instance fan-out, and
  complete live two-client synchronization (pilot sends revision notices only).
- Remaining database tables and their histories, cron jobs, server policies,
  and any remote functions used by the existing Lektrus frontend.
- Full feature parity, security/penetration checks, account-to-account and
  mobile acceptance, backup and restore drills, load/traffic measurement.
- Domain provisioning and paid VPS rental.

## Pilot infrastructure

The prototype is intentionally single-worker, single-host and not public yet.

- `compose.yaml`: uses a pinned PostgreSQL image, builds the Python API and
  serves the site through Caddy. DB and API have no public port bindings.
- `compose.yaml` also mounts a private persistent `assetsdata` volume into
  `/srv/lektrus-assets`. Back it up **alongside PostgreSQL**: DB-only backups
  cannot restore images and PDFs.
- `Caddyfile`: HTTPS reverse proxy and SPA fallback. The `dist` directory
  must come from the production frontend build.
- `.env.example`: documentation only. Real secrets must live on the VPS outside
  GitHub and outside the public website directory.

Create independent, random 32+ byte JWT secret and a strong DB password.
Use a new HTTPS domain and HTTPS origin. Do **not** reuse an old Supabase
JWT signing secret or place any privileged key in `index.html`.

## Import gates

The importer requires `LEKTRUS_SOURCE_DATABASE_URL` and `DATABASE_URL`.
The source connection uses TLS and a repeatable-read, read-only snapshot.
Without `--apply`, it only preflights the data and prints aggregate counts.
With `--apply`, it refuses to use the same database for source/target and
refuses an already populated target. It inserts in one transaction and
verifies counts plus a canonical SHA-256 digest of every document.

The core importer does **not** copy binary files. Once it succeeds on a
staging PostgreSQL, `server/import_supabase_assets.py` validates the
`storage.objects` manifest. Without `--apply` it does not download or
write files. With `--apply` it additionally needs:

- `DATABASE_URL`: isolated self-hosted database containing imported accounts
  and boards; its `board_assets` table must be empty.
- `LEKTRUS_ASSETS_DIR`: **absolute** private asset-volume path.
- `LEKTRUS_SOURCE_STORAGE_URL`: canonical HTTPS origin of the source project.
- `LEKTRUS_SOURCE_STORAGE_API_KEY` and
  `LEKTRUS_SOURCE_STORAGE_ACCESS_TOKEN`: server-side, short-lived migration
  credentials with sufficient Storage read rights. **Never** put these in
  frontend env variables, GitHub, logs, or chat. If using a privileged key,
  revoke it after migration and never leave it on the public host.
- `LEKTRUS_SOURCE_PROJECT_REF` if source PostgreSQL uses a pooler host.

The separate importer verifies paths, file sizes and SHA-256, then stores
metadata in a single transaction on the isolated target. It does not modify
Supabase. It is not a continuously running bidirectional sync; a final
write freeze and delta import are still necessary.

History, comments, schedules, materials, and the rest of the platform are
**not** migrated yet; the source must remain intact and online.

Do not expose database credentials or password hashes in chat, files,
GitHub, browser JavaScript or logs. Before any real import, secure a verified
database backup and test restoring it to an isolated copy.

## Sequence to production

1. Check current Supabase monthly egress breakdown and measure network
   requests on the same scenarios with the browser. Budget target:
   <=250 GB/month, backed by measurements rather than assumption.
2. Provision a separate test VPS with a domain, trusted TLS, firewall and
   daily encrypted off-server backups; validate resource usage before
   deciding if 2 vCPU / 4 GB RAM is sufficient.
3. Complete the storage, authentication and existing RPC surfaces, history,
   roles and full WebSocket collaboration. Add server-side object permission
   parity (not just UI restrictions).
4. Import into a staging database, compare all counts/hashes, and test
   teacher and student login using unchanged passwords. Check every
   attachment, existing URL and activity history.
5. Test two simultaneous browsers, guest access, invitations, sharing,
   create/save/reload, conflicts, offline restore and multiple screen sizes.
6. Freeze writes for the final delta import, validate counts again, then
   update frontend configuration and DNS. Keep a tested rollback route.
7. Only when the self-hosted deployment passes all checks and is stable,
   withdraw production use of Supabase. Never delete the source first.

No paid infrastructure has been purchased or modified by this branch.
