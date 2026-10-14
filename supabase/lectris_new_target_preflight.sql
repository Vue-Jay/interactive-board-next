-- Lectris PRE-RESTORE target audit. READ-ONLY.
-- May be run ONLY against the NEW dedicated Supabase database.
-- Prints counts and nonsecret configuration. No ALTER, INSERT, UPDATE or DELETE.
select 'postgres_version' as check_name, current_setting('server_version') as result
union all select 'auth_users', (select count(*)::text from auth.users)
union all select 'auth_identities', (select count(*)::text from auth.identities)
union all select 'storage_buckets', (select count(*)::text from storage.buckets)
union all select 'storage_objects', (select count(*)::text from storage.objects)
union all select 'public_tables', (select count(*)::text from pg_tables where schemaname = 'public')
union all select 'extensions', (select coalesce(string_agg(extname, ', ' order by extname), '<none>') from pg_extension)
union all select 'vault_secret_rows',
  (select case when to_regclass('vault.secrets') is null then 'vault.secrets not installed' else 'vault.secrets table exists; inspect old project use before restore' end)
order by check_name;
-- Querying pg_tables exposes only table names and not any rows.
select 'public_table' as item, tablename as name from pg_tables where schemaname = 'public' order by tablename;
-- For Supabase Auth column compatibility; names only, no private user data.
select 'auth.users.column' as item, column_name || ' : ' || data_type as name
from information_schema.columns where table_schema = 'auth' and table_name = 'users'
order by ordinal_position;
