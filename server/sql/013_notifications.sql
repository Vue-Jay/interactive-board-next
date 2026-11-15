create table if not exists user_notifications (
 id uuid primary key, user_id uuid not null references account_users(id) on delete cascade,
 kind text not null check(kind in ('assignment','submission','review','lesson','material','comment')),
 title text not null, body text not null default '', href text not null default '',
 created_at timestamptz not null default now(), read_at timestamptz
);
create index if not exists user_notifications_list_idx on user_notifications(user_id,created_at desc);
create table if not exists user_notification_settings (
 user_id uuid primary key references account_users(id) on delete cascade,
 assignment boolean not null default true, submission boolean not null default true,
 review boolean not null default true, lesson boolean not null default true,
 material boolean not null default true, comment boolean not null default true,
 lesson_reminder boolean not null default true, assignment_reminder boolean not null default true
);
