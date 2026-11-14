"""Migration is tested between two disposable PostgreSQL databases."""
import os
from urllib.parse import urlsplit, urlunsplit
from uuid import UUID, uuid4

import asyncpg
import bcrypt
import pytest

from import_supabase_core import run as run_import

OWNER = UUID("00000000-0000-4000-8000-000000000101")
STUDENT = UUID("00000000-0000-4000-8000-000000000102")
BOARD = UUID("00000000-0000-4000-8000-000000000103")
SESSION = UUID("00000000-0000-4000-8000-000000000104")
ASSIGNMENT = UUID("00000000-0000-4000-8000-000000000105")
SCHEDULE = UUID("00000000-0000-4000-8000-000000000106")
LESSON = UUID("00000000-0000-4000-8000-000000000107")
DOCUMENT = '{"version":1,"title":"Урок","items":[{"id":"a","kind":"text"}],"ink":[]}'

@pytest.mark.asyncio
async def test_lossless_core_import_to_empty_database(monkeypatch):
    target_dsn = os.environ["DATABASE_URL"]
    parts = urlsplit(target_dsn)
    source_dsn = urlunsplit((parts.scheme,parts.netloc,
                            "/lektrus_source_ci",parts.query,parts.fragment))
    admin = await asyncpg.connect(target_dsn)
    await admin.execute("CREATE DATABASE lektrus_source_ci")
    await admin.close()

    source = await asyncpg.connect(source_dsn)
    await source.execute("""
        CREATE SCHEMA auth;
        CREATE TABLE auth.users (
            id uuid primary key, email text,
            encrypted_password text, email_confirmed_at timestamptz,
            created_at timestamptz not null default now(),
            is_anonymous boolean not null default false
        );
        CREATE TABLE public.profiles(
            id uuid primary key,display_name text,first_name text,last_name text,
            account_role text,teacher_status text,
            subscription_plan text,subscription_until timestamptz
        );
        CREATE TABLE public.app_admins(user_id uuid primary key);
        CREATE TABLE public.boards(
            id uuid primary key,owner_id uuid,title text,
            created_at timestamptz not null default now(),
            updated_at timestamptz not null default now(),deleted_at timestamptz
        );
        CREATE TABLE public.board_members(
            board_id uuid,user_id uuid,role text,added_at timestamptz not null default now()
        );
        CREATE TABLE public.board_documents(
            board_id uuid,document jsonb,version bigint,
            updated_at timestamptz not null default now(),updated_by uuid
        );
        CREATE TABLE public.board_invites (
            id uuid primary key,board_id uuid,email text,role text,
            created_at timestamptz not null default now()
        );
        CREATE TABLE public.student_profiles(
            teacher_id uuid,student_id uuid,note text,tags text[],
            updated_at timestamptz not null default now()
        );
        CREATE TABLE public.student_sessions(
            id uuid,teacher_id uuid,student_id uuid,board_id uuid,date timestamptz,
            duration_minutes integer,topic text,homework text,result text,
            created_at timestamptz not null default now(),
            updated_at timestamptz not null default now()
        );
        CREATE TABLE public.assignments(
            id uuid,teacher_id uuid,student_id uuid,board_id uuid,title text,
            description text,due_at timestamptz,max_score integer,
            created_at timestamptz not null default now()
        );
        CREATE TABLE public.submissions(
            assignment_id uuid,student_id uuid,content text,submitted_at timestamptz,
            score numeric,feedback text,reviewed_at timestamptz
        );
        CREATE TABLE public.scheduled_lessons(
            id uuid,teacher_id uuid,student_id uuid,board_id uuid,title text,
            starts_at timestamptz,duration_minutes integer,recurrence text,
            recurrence_group_id uuid,note text,status text,
            created_at timestamptz not null default now()
        );
        CREATE TABLE public.live_lessons(
            id uuid,teacher_id uuid,student_id uuid,board_id uuid,topic text,
            started_at timestamptz,ended_at timestamptz,result text,homework text,
            created_at timestamptz not null default now(),schedule_id uuid
        );
    """)
    password = bcrypt.hashpw(b"migrated-password", bcrypt.gensalt(rounds=4)).decode()
    for uid,email,role in [(OWNER,"teacher@test.invalid","teacher"),
                           (STUDENT,"pupil@test.invalid","student")]:
        await source.execute(
            """INSERT INTO auth.users(id,email,encrypted_password,email_confirmed_at)
               VALUES($1,$2,$3,now())""",uid,email,password
        )
        await source.execute(
            """INSERT INTO public.profiles(id,display_name,first_name,last_name,
                      account_role,teacher_status,subscription_plan)
               VALUES($1,$2,$3,$4,$5,$6,'free')""",
            uid,"Учитель" if uid==OWNER else "Ученик",
            "Имя","Фамилия",role,"approved" if role=="teacher" else "none"
        )
    await source.execute(
        "INSERT INTO public.boards(id,owner_id,title) VALUES($1,$2,$3)",
        BOARD,OWNER,"Урок"
    )
    await source.execute(
        "INSERT INTO public.board_members(board_id,user_id,role) VALUES($1,$2,'editor')",
        BOARD,STUDENT
    )
    await source.execute(
        """INSERT INTO public.board_documents(board_id,document,version,updated_by)
           VALUES($1,$2::jsonb,5,$3)""",BOARD,DOCUMENT,STUDENT
    )
    invite_id = uuid4()
    await source.execute(
        """INSERT INTO public.board_invites(id,board_id,email,role)
           VALUES($1,$2,'future@test.invalid','viewer')""",invite_id,BOARD
    )
    await source.execute(
        """INSERT INTO public.student_profiles(teacher_id,student_id,note,tags)
           VALUES($1,$2,'Сильная математика',ARRAY['алгебра','геометрия'])""",OWNER,STUDENT
    )
    await source.execute(
        """INSERT INTO public.student_sessions
           (id,teacher_id,student_id,board_id,date,duration_minutes,topic,homework,result)
           VALUES($1,$2,$3,$4,now(),45,'Алгебра','№ 5','Освоено')""",
        SESSION,OWNER,STUDENT,BOARD
    )
    await source.execute(
        """INSERT INTO public.assignments
           (id,teacher_id,student_id,board_id,title,description,due_at,max_score)
           VALUES($1,$2,$3,$4,'Домашняя работа','Параграф 4',now()+interval '3 days',20)""",
        ASSIGNMENT,OWNER,STUDENT,BOARD
    )
    await source.execute(
        """INSERT INTO public.submissions(assignment_id,student_id,content,score,feedback,reviewed_at)
           VALUES($1,$2,'Решение',18,'Хорошо',now())""",ASSIGNMENT,STUDENT
    )
    await source.execute(
        """INSERT INTO public.scheduled_lessons
           (id,teacher_id,student_id,board_id,title,starts_at,duration_minutes,
            recurrence,recurrence_group_id,note,status)
           VALUES($1,$2,$3,$4,'Повторение',now()+interval '2 days',60,
                  'weekly',$5,'Принести тетрадь','planned')""",
        SCHEDULE,OWNER,STUDENT,BOARD,uuid4()
    )
    await source.execute(
        """INSERT INTO public.live_lessons
           (id,teacher_id,student_id,board_id,topic,started_at,ended_at,result,homework,schedule_id)
           VALUES($1,$2,$3,$4,'Дроби',now()-interval '1 hour',now(),
                  'Понял тему','№ 12',$5)""",
        LESSON,OWNER,STUDENT,BOARD,SCHEDULE
    )
    await source.close()

    target = await asyncpg.connect(target_dsn)
    await target.execute(
        "TRUNCATE account_sessions,board_documents,board_members,boards,account_users CASCADE"
    )
    await target.close()

    monkeypatch.setenv("LEKTRUS_SOURCE_DATABASE_URL",source_dsn)
    monkeypatch.setenv("LEKTRUS_TEST_INSECURE_SOURCE","1")
    await run_import(apply=False)
    target = await asyncpg.connect(target_dsn)
    assert await target.fetchval("SELECT count(*) FROM account_users")==0
    await target.close()

    await run_import(apply=True)
    target = await asyncpg.connect(target_dsn)
    try:
        rows = await target.fetch("SELECT * FROM account_users ORDER BY email")
        assert len(rows)==2
        assert all(bcrypt.checkpw(b"migrated-password",
                                  row["password_hash"].encode()) for row in rows)
        assert {r["account_role"] for r in rows}=={"teacher","student"}
        assert {r["id"] for r in rows}=={OWNER,STUDENT}
        assert await target.fetchval("SELECT count(*) FROM board_members")==1
        assert await target.fetchval("SELECT count(*) FROM student_profiles")==1
        assert await target.fetchval("SELECT count(*) FROM student_sessions")==1
        assert await target.fetchval("SELECT count(*) FROM assignments")==1
        assert await target.fetchval("SELECT count(*) FROM submissions")==1
        assert await target.fetchval("SELECT count(*) FROM scheduled_lessons")==1
        assert await target.fetchval("SELECT count(*) FROM live_lessons")==1
        profile = await target.fetchrow("SELECT note,tags FROM student_profiles")
        assert profile["note"] == "Сильная математика"
        assert profile["tags"] == ["алгебра","геометрия"]
        assignment = await target.fetchrow("SELECT title,max_score FROM assignments")
        assert assignment["title"] == "Домашняя работа" and assignment["max_score"] == 20
        submission = await target.fetchrow("SELECT content,score FROM submissions")
        assert submission["content"] == "Решение" and float(submission["score"]) == 18
        schedule = await target.fetchrow("SELECT title,recurrence FROM scheduled_lessons")
        assert schedule["title"] == "Повторение" and schedule["recurrence"] == "weekly"
        lesson = await target.fetchrow("SELECT topic,schedule_id FROM live_lessons")
        assert lesson["topic"] == "Дроби" and lesson["schedule_id"] == SCHEDULE
        invite = await target.fetchrow(
            "SELECT id,board_id,email,role FROM board_invites"
        )
        assert invite["id"] == invite_id
        assert invite["board_id"] == BOARD
        assert invite["email"] == "future@test.invalid"
        assert invite["role"] == "viewer"
        doc = await target.fetchrow(
            "SELECT version,updated_by,document::text AS document FROM board_documents"
        )
        assert doc["version"]==5 and doc["updated_by"]==STUDENT
        assert '"kind": "text"' in doc["document"]
    finally:
        await target.close()
    with pytest.raises(RuntimeError,match="nonempty"):
        await run_import(apply=True)
