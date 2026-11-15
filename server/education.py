"""Native education workflows for Lektrus: students, assignments and lessons."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal
from uuid import UUID, uuid4

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field


def teacher_only(user) -> None:
    if user["account_role"] != "teacher" or user["teacher_status"] != "approved":
        raise HTTPException(403, "Эта функция доступна только подтверждённому преподавателю.")


async def ensure_student_link(conn: asyncpg.Connection, teacher_id: UUID,
                              student_id: UUID, board_id: UUID | None = None) -> None:
    allowed = await conn.fetchval(
        """SELECT EXISTS(
             SELECT 1 FROM account_users u
             JOIN board_members bm ON bm.user_id=u.id
             JOIN boards b ON b.id=bm.board_id
            WHERE u.id=$2 AND u.account_role='student'
              AND b.owner_id=$1 AND b.deleted_at IS NULL
              AND ($3::uuid IS NULL OR b.id=$3)
         )""",
        teacher_id, student_id, board_id,
    )
    if not allowed:
        raise HTTPException(404, "Ученик не найден среди участников ваших досок.")


def iso(value):
    return value.isoformat() if value is not None else None


class StudentProfileInput(BaseModel):
    note: str | None = Field(default=None, max_length=20_000)
    tags: list[str] | None = Field(default=None, max_length=40)


class StudentSessionInput(BaseModel):
    id: UUID
    student_id: UUID
    board_id: UUID | None = None
    date: datetime
    duration_minutes: int = Field(ge=0, le=1440)
    topic: str = Field(default="", max_length=500)
    homework: str = Field(default="", max_length=20_000)
    result: str = Field(default="", max_length=20_000)


class AssignmentCreateInput(BaseModel):
    id: UUID
    student_id: UUID
    board_id: UUID | None = None
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=20_000)
    due_at: datetime | None = None
    max_score: int = Field(default=100, ge=1, le=10_000)


class AssignmentSubmitInput(BaseModel):
    content: str = Field(default="", max_length=100_000)


class AssignmentReviewInput(BaseModel):
    score: float | None = Field(default=None, ge=0)
    feedback: str = Field(default="", max_length=20_000)


class ScheduleItemInput(BaseModel):
    id: UUID
    student_id: UUID
    board_id: UUID | None = None
    title: str = Field(default="Занятие", max_length=200)
    starts_at: datetime
    duration_minutes: int = Field(default=60, ge=15, le=480)
    recurrence: Literal["none", "weekly"] = "none"
    recurrence_group_id: UUID | None = None
    note: str = Field(default="", max_length=20_000)
    status: Literal["planned"] = "planned"


class ScheduleBulkInput(BaseModel):
    items: list[ScheduleItemInput] = Field(min_length=1, max_length=24)


class SchedulePatchInput(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    starts_at: datetime | None = None
    duration_minutes: int | None = Field(default=None, ge=15, le=480)
    note: str | None = Field(default=None, max_length=20_000)
    status: Literal["planned", "completed", "cancelled"] | None = None


class LessonStartInput(BaseModel):
    student_id: UUID
    topic: str = Field(default="", max_length=500)
    schedule_id: UUID | None = None


class LessonFinishInput(BaseModel):
    result: str = Field(default="", max_length=20_000)
    homework: str = Field(default="", max_length=20_000)


def make_education_router(current_user, board_access) -> APIRouter:
    router = APIRouter()

    @router.get("/api/v1/students")
    async def list_students(request: Request, user=Depends(current_user)):
        teacher_only(user)
        async with request.app.state.pool.acquire() as conn:
            rows = await conn.fetch(
                """SELECT u.id,u.display_name,u.email,
                          max(b.updated_at) AS last_board_at,
                          array_agg(b.id::text ORDER BY b.updated_at DESC) AS board_ids,
                          array_agg(b.title ORDER BY b.updated_at DESC) AS board_titles,
                          coalesce(sp.note,'') AS note,
                          coalesce(sp.tags,'{}'::text[]) AS tags
                     FROM boards b
                     JOIN board_members bm ON bm.board_id=b.id
                     JOIN account_users u ON u.id=bm.user_id
                     LEFT JOIN student_profiles sp
                       ON sp.teacher_id=$1 AND sp.student_id=u.id
                    WHERE b.owner_id=$1 AND b.deleted_at IS NULL
                      AND u.account_role='student' AND u.guest_board_id IS NULL
                    GROUP BY u.id,u.display_name,u.email,sp.note,sp.tags
                    ORDER BY lower(u.display_name),u.id""",
                user["id"],
            )
        return [{
            "user_id": str(row["id"]),
            "name": row["display_name"],
            "email": row["email"],
            "board_ids": row["board_ids"] or [],
            "board_titles": row["board_titles"] or [],
            "last_board_at": iso(row["last_board_at"]),
            "note": row["note"],
            "tags": row["tags"] or [],
        } for row in rows]

    @router.put("/api/v1/students/{student_id}/profile")
    async def save_student_profile(
        student_id: UUID, data: StudentProfileInput, request: Request,
        user=Depends(current_user),
    ):
        teacher_only(user)
        if data.note is None and data.tags is None:
            raise HTTPException(422, "Не переданы данные профиля.")
        tags = data.tags
        if tags is not None:
            tags = list(dict.fromkeys(tag.strip() for tag in tags if tag.strip()))
            if any(len(tag) > 64 for tag in tags):
                raise HTTPException(422, "Слишком длинная метка.")
        async with request.app.state.pool.acquire() as conn:
            await ensure_student_link(conn, user["id"], student_id)
            await conn.execute(
                """INSERT INTO student_profiles(teacher_id,student_id,note,tags)
                   VALUES($1,$2,$3,$4)
                   ON CONFLICT(teacher_id,student_id) DO UPDATE SET
                     note=coalesce($5,student_profiles.note),
                     tags=coalesce($6,student_profiles.tags),
                     updated_at=now()""",
                user["id"], student_id, data.note or "", tags or [],
                data.note, tags,
            )
        return {"ok": True}

    @router.get("/api/v1/students/{student_id}/sessions")
    async def list_student_sessions(
        student_id: UUID, request: Request, user=Depends(current_user)
    ):
        teacher_only(user)
        async with request.app.state.pool.acquire() as conn:
            await ensure_student_link(conn, user["id"], student_id)
            rows = await conn.fetch(
                """SELECT s.id,s.student_id,s.board_id,s.date,s.duration_minutes,
                          s.topic,s.homework,s.result,b.title AS board_title
                     FROM student_sessions s
                     LEFT JOIN boards b ON b.id=s.board_id
                    WHERE s.teacher_id=$1 AND s.student_id=$2
                    ORDER BY s.date DESC,s.created_at DESC LIMIT 500""",
                user["id"], student_id,
            )
        return [{
            "id": str(row["id"]), "student_id": str(row["student_id"]),
            "board_id": str(row["board_id"]) if row["board_id"] else None,
            "board_title": row["board_title"] or "Без доски",
            "date": iso(row["date"]), "duration_minutes": row["duration_minutes"],
            "topic": row["topic"], "homework": row["homework"], "result": row["result"],
        } for row in rows]

    @router.put("/api/v1/student-sessions/{session_id}")
    async def save_student_session(
        session_id: UUID, data: StudentSessionInput, request: Request,
        user=Depends(current_user),
    ):
        teacher_only(user)
        if session_id != data.id:
            raise HTTPException(422, "ID занятия не совпадает.")
        async with request.app.state.pool.acquire() as conn:
            async with conn.transaction():
                await ensure_student_link(conn, user["id"], data.student_id, data.board_id)
                existing = await conn.fetchrow(
                    "SELECT teacher_id FROM student_sessions WHERE id=$1 FOR UPDATE",
                    session_id,
                )
                if existing and existing["teacher_id"] != user["id"]:
                    raise HTTPException(404, "Запись занятия не найдена.")
                await conn.execute(
                    """INSERT INTO student_sessions
                       (id,teacher_id,student_id,board_id,date,duration_minutes,topic,homework,result)
                       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
                       ON CONFLICT(id) DO UPDATE SET
                         student_id=excluded.student_id,board_id=excluded.board_id,
                         date=excluded.date,duration_minutes=excluded.duration_minutes,
                         topic=excluded.topic,homework=excluded.homework,result=excluded.result,
                         updated_at=now()""",
                    session_id,user["id"],data.student_id,data.board_id,data.date,
                    data.duration_minutes,data.topic.strip(),data.homework,data.result,
                )
        return {"ok": True}

    @router.delete("/api/v1/student-sessions/{session_id}", status_code=204)
    async def delete_student_session(
        session_id: UUID, request: Request, user=Depends(current_user)
    ):
        teacher_only(user)
        async with request.app.state.pool.acquire() as conn:
            await conn.execute(
                "DELETE FROM student_sessions WHERE id=$1 AND teacher_id=$2",
                session_id,user["id"],
            )
        return Response(status_code=204)

    @router.get("/api/v1/assignments")
    async def list_assignments(request: Request, user=Depends(current_user)):
        async with request.app.state.pool.acquire() as conn:
            rows = await conn.fetch(
                """SELECT a.id,a.teacher_id,a.student_id,a.board_id,a.title,a.description,
                          a.due_at,a.max_score,a.created_at,b.title AS board_title,
                          s.content,s.submitted_at,s.score,s.feedback,s.reviewed_at
                     FROM assignments a
                     LEFT JOIN boards b ON b.id=a.board_id
                     LEFT JOIN submissions s
                       ON s.assignment_id=a.id AND s.student_id=a.student_id
                    WHERE a.teacher_id=$1 OR a.student_id=$1
                    ORDER BY a.created_at DESC LIMIT 1000""",
                user["id"],
            )
        return [{
            "id": str(row["id"]), "teacher_id": str(row["teacher_id"]),
            "student_id": str(row["student_id"]),
            "board_id": str(row["board_id"]) if row["board_id"] else None,
            "title": row["title"], "description": row["description"],
            "due_at": iso(row["due_at"]), "max_score": row["max_score"],
            "created_at": iso(row["created_at"]),
            "boards": {"title": row["board_title"]} if row["board_title"] else None,
            "submissions": ({
                "content": row["content"], "submitted_at": iso(row["submitted_at"]),
                "score": float(row["score"]) if row["score"] is not None else None,
                "feedback": row["feedback"], "reviewed_at": iso(row["reviewed_at"]),
            } if row["submitted_at"] is not None else None),
        } for row in rows]

    @router.post("/api/v1/assignments", status_code=201)
    async def create_assignment(
        data: AssignmentCreateInput, request: Request, user=Depends(current_user)
    ):
        teacher_only(user)
        title = data.title.strip()
        if not title:
            raise HTTPException(422, "Укажите название задания.")
        async with request.app.state.pool.acquire() as conn:
            await ensure_student_link(conn, user["id"], data.student_id, data.board_id)
            await conn.execute(
                """INSERT INTO assignments
                   (id,teacher_id,student_id,board_id,title,description,due_at,max_score)
                   VALUES($1,$2,$3,$4,$5,$6,$7,$8)""",
                data.id,user["id"],data.student_id,data.board_id,title,
                data.description.strip(),data.due_at,data.max_score,
            )
            await conn.execute("INSERT INTO user_notifications(id,user_id,kind,title,body,href) VALUES($1,$2,'assignment',$3,$4,'/app?section=assignments')",uuid4(),data.student_id,title,data.description.strip()[:400])
        return {"ok": True, "id": str(data.id)}

    @router.delete("/api/v1/assignments/{assignment_id}", status_code=204)
    async def delete_assignment(
        assignment_id: UUID, request: Request, user=Depends(current_user)
    ):
        teacher_only(user)
        async with request.app.state.pool.acquire() as conn:
            await conn.execute(
                "DELETE FROM assignments WHERE id=$1 AND teacher_id=$2",
                assignment_id,user["id"],
            )
        return Response(status_code=204)

    @router.post("/api/v1/assignments/{assignment_id}/submit")
    async def submit_assignment(
        assignment_id: UUID, data: AssignmentSubmitInput, request: Request,
        user=Depends(current_user),
    ):
        if user["account_role"] != "student":
            raise HTTPException(403, "Сдать задание может только ученик.")
        async with request.app.state.pool.acquire() as conn:
            async with conn.transaction():
                assignment = await conn.fetchrow(
                    """SELECT id FROM assignments
                        WHERE id=$1 AND student_id=$2 FOR UPDATE""",
                    assignment_id,user["id"],
                )
                if assignment is None:
                    raise HTTPException(404, "Задание не найдено.")
                await conn.execute(
                    """INSERT INTO submissions
                       (assignment_id,student_id,content,submitted_at,score,feedback,reviewed_at)
                       VALUES($1,$2,$3,now(),NULL,'',NULL)
                       ON CONFLICT(assignment_id,student_id) DO UPDATE SET
                         content=excluded.content,submitted_at=now(),score=NULL,
                         feedback='',reviewed_at=NULL""",
                    assignment_id,user["id"],data.content,
                )
                await conn.execute("INSERT INTO user_notifications(id,user_id,kind,title,body,href) SELECT $1,teacher_id,'submission','Получено решение задания',$2,'/app?section=assignments' FROM assignments WHERE id=$3",uuid4(),data.content[:240],assignment_id)
        return {"ok": True}

    @router.post("/api/v1/assignments/{assignment_id}/review")
    async def review_assignment(
        assignment_id: UUID, data: AssignmentReviewInput, request: Request,
        user=Depends(current_user),
    ):
        teacher_only(user)
        async with request.app.state.pool.acquire() as conn:
            async with conn.transaction():
                assignment = await conn.fetchrow(
                    """SELECT student_id,max_score FROM assignments
                        WHERE id=$1 AND teacher_id=$2 FOR UPDATE""",
                    assignment_id,user["id"],
                )
                if assignment is None:
                    raise HTTPException(404, "Задание не найдено.")
                if data.score is not None and data.score > assignment["max_score"]:
                    raise HTTPException(422, "Оценка превышает максимальный балл.")
                updated = await conn.fetchval(
                    """UPDATE submissions SET score=$3,feedback=$4,reviewed_at=now()
                        WHERE assignment_id=$1 AND student_id=$2
                        RETURNING assignment_id""",
                    assignment_id,assignment["student_id"],data.score,data.feedback.strip(),
                )
                if updated is None:
                    raise HTTPException(404, "Ученик ещё не отправил это задание.")
                await conn.execute("INSERT INTO user_notifications(id,user_id,kind,title,body,href) VALUES($1,$2,'review','Работа проверена',$3,'/app?section=assignments')",uuid4(),assignment["student_id"],data.feedback.strip()[:400])
        return {"ok": True}

    @router.get("/api/v1/schedule")
    async def list_schedule(request: Request, user=Depends(current_user)):
        async with request.app.state.pool.acquire() as conn:
            rows = await conn.fetch(
                """SELECT s.id,s.teacher_id,s.student_id,u.display_name AS student_name,
                          s.board_id,b.title AS board_title,s.title,s.starts_at,
                          s.duration_minutes,s.recurrence,s.recurrence_group_id,
                          s.note,s.status,s.created_at
                     FROM scheduled_lessons s
                     JOIN account_users u ON u.id=s.student_id
                     LEFT JOIN boards b ON b.id=s.board_id
                    WHERE s.teacher_id=$1 OR s.student_id=$1
                    ORDER BY s.starts_at,s.id LIMIT 2000""",
                user["id"],
            )
        return [{
            "id":str(row["id"]),"teacher_id":str(row["teacher_id"]),
            "student_id":str(row["student_id"]),"student_name":row["student_name"],
            "board_id":str(row["board_id"]) if row["board_id"] else None,
            "board_title":row["board_title"] or "Без доски","title":row["title"],
            "starts_at":iso(row["starts_at"]),"duration_minutes":row["duration_minutes"],
            "recurrence":row["recurrence"],
            "recurrence_group_id":str(row["recurrence_group_id"]) if row["recurrence_group_id"] else None,
            "note":row["note"],"status":row["status"],"created_at":iso(row["created_at"]),
        } for row in rows]

    @router.post("/api/v1/schedule", status_code=201)
    async def create_schedule(
        data: ScheduleBulkInput, request: Request, user=Depends(current_user)
    ):
        teacher_only(user)
        async with request.app.state.pool.acquire() as conn:
            async with conn.transaction():
                for item in data.items:
                    await ensure_student_link(conn,user["id"],item.student_id,item.board_id)
                    await conn.execute(
                        """INSERT INTO scheduled_lessons
                           (id,teacher_id,student_id,board_id,title,starts_at,duration_minutes,
                            recurrence,recurrence_group_id,note,status)
                           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'planned')""",
                        item.id,user["id"],item.student_id,item.board_id,
                        item.title.strip() or "Занятие",item.starts_at,
                        item.duration_minutes,item.recurrence,item.recurrence_group_id,
                        item.note.strip(),
                    )
        return {"ok": True, "created": len(data.items)}

    @router.patch("/api/v1/schedule/{schedule_id}")
    async def update_schedule(
        schedule_id: UUID, data: SchedulePatchInput, request: Request,
        user=Depends(current_user),
    ):
        teacher_only(user)
        fields = data.model_dump(exclude_unset=True)
        if not fields:
            return {"ok": True}
        if any(value is None for value in fields.values()):
            raise HTTPException(422, "Для очистки поля передайте пустую строку, а не null.")
        columns = {
            "title":"title","starts_at":"starts_at",
            "duration_minutes":"duration_minutes","note":"note","status":"status",
        }
        async with request.app.state.pool.acquire() as conn:
            existing = await conn.fetchval(
                "SELECT id FROM scheduled_lessons WHERE id=$1 AND teacher_id=$2",
                schedule_id,user["id"],
            )
            if existing is None:
                raise HTTPException(404, "Занятие в расписании не найдено.")
            assignments = []
            values: list[object] = [schedule_id,user["id"]]
            for key,value in fields.items():
                assignments.append(columns[key] + "=$" + str(len(values)+1))
                values.append(value.strip() if key in ("title","note") and isinstance(value,str) else value)
            await conn.execute(
                "UPDATE scheduled_lessons SET "+",".join(assignments)+
                " WHERE id=$1 AND teacher_id=$2",*values,
            )
        return {"ok": True}

    @router.delete("/api/v1/schedule/{schedule_id}", status_code=204)
    async def delete_schedule(
        schedule_id: UUID, request: Request, user=Depends(current_user),
        series: bool = False, group_id: UUID | None = None,
    ):
        teacher_only(user)
        async with request.app.state.pool.acquire() as conn:
            if series and group_id:
                await conn.execute(
                    "DELETE FROM scheduled_lessons WHERE teacher_id=$1 AND recurrence_group_id=$2",
                    user["id"],group_id,
                )
            else:
                await conn.execute(
                    "DELETE FROM scheduled_lessons WHERE id=$1 AND teacher_id=$2",
                    schedule_id,user["id"],
                )
        return Response(status_code=204)

    @router.post("/api/v1/schedule/{schedule_id}/start")
    async def start_schedule(
        schedule_id: UUID, request: Request, user=Depends(current_user)
    ):
        teacher_only(user)
        async with request.app.state.pool.acquire() as conn:
            exists = await conn.fetchval(
                "SELECT id FROM scheduled_lessons WHERE id=$1 AND teacher_id=$2",
                schedule_id,user["id"],
            )
        if exists is None:
            raise HTTPException(404, "Занятие в расписании не найдено.")
        return {"ok": True}

    @router.post("/api/v1/schedule/{schedule_id}/complete")
    async def complete_schedule(
        schedule_id: UUID, request: Request, user=Depends(current_user)
    ):
        teacher_only(user)
        async with request.app.state.pool.acquire() as conn:
            updated = await conn.fetchval(
                """UPDATE scheduled_lessons SET status='completed'
                    WHERE id=$1 AND teacher_id=$2 RETURNING id""",
                schedule_id,user["id"],
            )
        if updated is None:
            raise HTTPException(404, "Занятие в расписании не найдено.")
        return {"ok": True}

    @router.get("/api/v1/boards/{board_id}/lessons/active")
    async def get_active_lesson(
        board_id: UUID, request: Request, user=Depends(current_user)
    ):
        async with request.app.state.pool.acquire() as conn:
            await board_access(conn,board_id,user["id"])
            row = await conn.fetchrow(
                """SELECT l.id,l.board_id,l.student_id,u.display_name AS student_name,
                          l.topic,l.started_at,l.ended_at,l.schedule_id
                     FROM live_lessons l
                     JOIN account_users u ON u.id=l.student_id
                    WHERE l.board_id=$1 AND l.ended_at IS NULL
                    ORDER BY l.started_at DESC LIMIT 1""",
                board_id,
            )
        if row is None:
            return None
        return {
            "id":str(row["id"]),"board_id":str(row["board_id"]),
            "student_id":str(row["student_id"]),"student_name":row["student_name"],
            "topic":row["topic"],"started_at":iso(row["started_at"]),
            "ended_at":iso(row["ended_at"]),
            "schedule_id":str(row["schedule_id"]) if row["schedule_id"] else None,
        }

    @router.post("/api/v1/boards/{board_id}/lessons", status_code=201)
    async def start_lesson(
        board_id: UUID, data: LessonStartInput, request: Request,
        user=Depends(current_user),
    ):
        teacher_only(user)
        async with request.app.state.pool.acquire() as conn:
            async with conn.transaction():
                board, role = await board_access(conn,board_id,user["id"],lock=True)
                if role != "owner":
                    raise HTTPException(403, "Начать занятие может только владелец доски.")
                await ensure_student_link(conn,user["id"],data.student_id,board_id)
                if data.schedule_id:
                    scheduled = await conn.fetchval(
                        """SELECT id FROM scheduled_lessons
                            WHERE id=$1 AND teacher_id=$2 AND student_id=$3
                              AND (board_id IS NULL OR board_id=$4)
                              AND status<>'cancelled'""",
                        data.schedule_id,user["id"],data.student_id,board_id,
                    )
                    if scheduled is None:
                        raise HTTPException(404, "Занятие расписания не найдено.")
                lesson_id = uuid4()
                try:
                    await conn.execute(
                        """INSERT INTO live_lessons
                           (id,teacher_id,student_id,board_id,topic,schedule_id)
                           VALUES($1,$2,$3,$4,$5,$6)""",
                        lesson_id,user["id"],data.student_id,board_id,
                        data.topic.strip(),data.schedule_id,
                    )
                except asyncpg.UniqueViolationError:
                    raise HTTPException(409, "На этой доске уже идёт занятие.") from None
                lesson_started_at = await conn.fetchval(
                    "SELECT started_at FROM live_lessons WHERE id=$1",lesson_id
                )
                student_name = await conn.fetchval(
                    "SELECT display_name FROM account_users WHERE id=$1",data.student_id
                )
        return {
            "id":str(lesson_id),"board_id":str(board_id),
            "student_id":str(data.student_id),"student_name":student_name or "Ученик",
            "topic":data.topic.strip(),"started_at":iso(lesson_started_at),
            "ended_at":None,"schedule_id":str(data.schedule_id) if data.schedule_id else None,
        }

    @router.post("/api/v1/lessons/{lesson_id}/finish")
    async def finish_lesson(
        lesson_id: UUID, data: LessonFinishInput, request: Request,
        user=Depends(current_user),
    ):
        teacher_only(user)
        async with request.app.state.pool.acquire() as conn:
            async with conn.transaction():
                lesson = await conn.fetchrow(
                    """SELECT id,student_id,board_id,started_at,schedule_id
                         FROM live_lessons
                        WHERE id=$1 AND teacher_id=$2 AND ended_at IS NULL
                        FOR UPDATE""",
                    lesson_id,user["id"],
                )
                if lesson is None:
                    raise HTTPException(404, "Активное занятие не найдено.")
                ended_at = datetime.now(timezone.utc)
                minutes = min(1440, max(1, round((ended_at-lesson["started_at"]).total_seconds()/60)))
                await conn.execute(
                    """UPDATE live_lessons SET ended_at=$2,result=$3,homework=$4
                        WHERE id=$1""",
                    lesson_id,ended_at,data.result.strip(),data.homework.strip(),
                )
                await conn.execute(
                    """INSERT INTO student_sessions
                       (id,teacher_id,student_id,board_id,date,duration_minutes,
                        topic,homework,result)
                       SELECT $1,$2,$3,$4,$5,$6,topic,$7,$8
                         FROM live_lessons WHERE id=$1
                       ON CONFLICT(id) DO UPDATE SET
                         date=excluded.date,duration_minutes=excluded.duration_minutes,
                         topic=excluded.topic,homework=excluded.homework,
                         result=excluded.result,updated_at=now()""",
                    lesson_id,user["id"],lesson["student_id"],lesson["board_id"],
                    lesson["started_at"],minutes,data.homework.strip(),data.result.strip(),
                )
                if lesson["schedule_id"]:
                    await conn.execute(
                        """UPDATE scheduled_lessons SET status='completed'
                            WHERE id=$1 AND teacher_id=$2""",
                        lesson["schedule_id"],user["id"],
                    )
        return {"ok": True, "minutes": minutes}

    return router
