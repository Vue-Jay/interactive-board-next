create table if not exists global_interface_layout (
    singleton boolean primary key default true check (singleton),
    layout jsonb not null,
    updated_at timestamptz not null default now()
);
