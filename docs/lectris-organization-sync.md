# Lectris: organization sync (dedicated Supabase only)

This feature prepares shared metadata for **subjects, groups and board associations**.
It does not change how canvas drawing, realtime collaboration or board documents are saved.

## Safety first

**Do not run `supabase/lectris_organization_v1.sql` against the original
OnlineRepetitor/Tuqo Supabase project.** Lectris currently uses the same backend
credentials when a working `.env` is copied from the old project. Such a
setup is intentionally in **local-only** mode for organization metadata.

Enable this feature only after you have created a **separate Supabase project**
for Lectris, installed the complete Lectris base schema in that project, and
verified that authentication, board creation and access work there.

## Deployment steps

1. Create a dedicated Lectris Supabase project. Do not reuse the production
   project's URL, anon key or service role key.
2. Deploy the existing application's required SQL schema to this **new**
   project (see `supabase/setup.sql` and other applicable versioned
   migrations). Verify that `public.boards`, `public.can_access_board(uuid)`
   and `public.is_board_owner(uuid)` are present.
3. Run `supabase/lectris_organization_v1.sql` in **the new project's**
   SQL Editor. It creates two tables with row-level security:
   - `lectris_categories`: teacher-owned subject/group names;
   - `lectris_board_organization`: subject/group assigned to a board.
4. In the new Lectris environment, supply:

   ```dotenv
   VITE_SUPABASE_URL=https://YOUR_NEW_PROJECT_REF.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR_NEW_PROJECT_PUBLISHABLE_OR_ANON_KEY
   VITE_LECTRIS_ORG_SYNC=true
   VITE_LECTRIS_ISOLATED_SUPABASE_REF=YOUR_NEW_PROJECT_REF
   ```

   `VITE_LECTRIS_ISOLATED_SUPABASE_REF` must **exactly match** the
   `*.supabase.co` hostname's project ref. Only browser-safe anon/publishable
   keys belong in Vite env files. **Never** place a Supabase service-role or
   secret key in frontend environment variables.
5. Restart the local Vite server. The home screen will report the real state:
   synced, local-only or an error with the count of queued operations.

## Access rules

- A signed-in user can see only their own list of empty subjects/groups.
- A signed-in board member can read that board's subject and group.
- **Only the board owner** can assign or change board organization.
- Categories and associations do not change board permissions.
- All writes go through Supabase auth and RLS. No service-role keys or
  unauthenticated writes are used.

## Offline behavior and migration

Local edits are kept in the browser first, with pending operations queued
until the dedicated server is reachable. Retry from the workspace if the
server reports an error. The server uses last-successful-write semantics for
board associations; avoid concurrent offline edits of the same board until
conflict resolution is implemented.

Local-only data created *before* organization sync was enabled is not
automatically uploaded. This avoids overwriting newer shared metadata.
When the isolated backend is configured, teachers can click
**Перенести локальные метки** in the Lectris workspace. This queues owned-board
associations only and uses insert-ignore semantics: existing cloud
associations win. Empty subject/group labels and non-owned boards are skipped.
Local-only category names are also queued for an insert-ignore import.

After import, click **Повторить синхронизацию** if the status reports an
error. The local data is kept until successfully delivered.

The original online whiteboard and existing Supabase project remain untouched.
