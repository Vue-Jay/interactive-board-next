create table if not exists board_templates (
    id uuid primary key,
    owner_id uuid not null references account_users(id) on delete cascade,
    title text not null check (length(title) between 1 and 120),
    description text not null default '',
    category text not null default '',
    document jsonb not null,
    assets jsonb not null default '[]',
    use_count integer not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index if not exists board_templates_owner_idx on board_templates(owner_id, updated_at desc);
