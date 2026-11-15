-- Distinguish user-created pilot boards from migrated real Lektrus boards.
-- Existing boards stay non-pilot by default. Only new board creation sets this flag.
alter table boards add column if not exists is_pilot boolean not null default false;
