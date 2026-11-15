-- Native Lektrus education data: students, assignments, schedule and lessons.
-- User and board IDs are preserved when importing from Supabase.
create table if not exists student_profiles (
  teacher_id uuid not null references account_users(id) on delete cascade,
  student_id uuid not null references account_users(id) on delete cascade,
  note text not null default '',
  tags text[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (teacher_id, student_id)
);
create index if not exists student_profiles_teacher_idx
  on student_profiles(teacher_id, student_id);

create table if not exists student_sessions (
  id uuid primary key,
  teacher_id uuid not null references account_users(id) on delete cascade,
  student_id uuid not null references account_users(id) on delete cascade,
  board_id uuid references boards(id) on delete set null,
  date timestamptz not null,
  duration_minutes integer not null default 0
    check (duration_minutes between 0 and 1440),
  topic text not null default '',
  homework text not null default '',
  result text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists student_sessions_teacher_student_date_idx
  on student_sessions(teacher_id, student_id, date desc);

create table if not exists assignments (
  id uuid primary key,
  teacher_id uuid not null references account_users(id) on delete cascade,
  student_id uuid not null references account_users(id) on delete cascade,
  board_id uuid references boards(id) on delete set null,
  title text not null check (char_length(title) between 1 and 200),
  description text not null default '',
  due_at timestamptz,
  max_score integer not null default 100 check (max_score between 1 and 10000),
  created_at timestamptz not null default now()
);
create index if not exists assignments_teacher_created_idx
  on assignments(teacher_id, created_at desc);
create index if not exists assignments_student_due_idx
  on assignments(student_id, due_at);

create table if not exists submissions (
  assignment_id uuid not null references assignments(id) on delete cascade,
  student_id uuid not null references account_users(id) on delete cascade,
  content text not null default '',
  submitted_at timestamptz not null default now(),
  score numeric,
  feedback text not null default '',
  reviewed_at timestamptz,
  primary key (assignment_id, student_id),
  check (score is null or score >= 0)
);
create index if not exists submissions_student_idx
  on submissions(student_id, submitted_at desc);

create table if not exists scheduled_lessons (
  id uuid primary key,
  teacher_id uuid not null references account_users(id) on delete cascade,
  student_id uuid not null references account_users(id) on delete cascade,
  board_id uuid references boards(id) on delete set null,
  title text not null default 'Занятие',
  starts_at timestamptz not null,
  duration_minutes integer not null default 60
    check (duration_minutes between 15 and 480),
  recurrence text not null default 'none'
    check (recurrence in ('none','weekly')),
  recurrence_group_id uuid,
  note text not null default '',
  status text not null default 'planned'
    check (status in ('planned','completed','cancelled')),
  created_at timestamptz not null default now()
);
create index if not exists scheduled_lessons_teacher_time_idx
  on scheduled_lessons(teacher_id, starts_at);
create index if not exists scheduled_lessons_student_time_idx
  on scheduled_lessons(student_id, starts_at);
create index if not exists scheduled_lessons_group_idx
  on scheduled_lessons(recurrence_group_id);

create table if not exists live_lessons (
  id uuid primary key,
  teacher_id uuid not null references account_users(id) on delete cascade,
  student_id uuid not null references account_users(id) on delete cascade,
  board_id uuid not null references boards(id) on delete cascade,
  topic text not null default '',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  result text not null default '',
  homework text not null default '',
  schedule_id uuid references scheduled_lessons(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index if not exists one_active_lesson_per_board
  on live_lessons(board_id) where ended_at is null;
create index if not exists live_lessons_schedule_idx
  on live_lessons(schedule_id);
create index if not exists live_lessons_teacher_started_idx
  on live_lessons(teacher_id, started_at desc);
