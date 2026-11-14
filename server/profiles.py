"""Private profile details and appearance settings for the current account."""
import json
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, ConfigDict, Field


class ProfileFields(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)


class PersonalDetails(ProfileFields):
    first_name: str = Field(max_length=80)
    last_name: str = Field(max_length=80)
    middle_name: str = Field(max_length=80)
    phone: str = Field(max_length=40, pattern=r"^(?:[+0-9 ().\-]{7,40})?$")
    city: str = Field(max_length=100)
    organization: str = Field(max_length=160)
    focus_area: str = Field(max_length=120)


class ProfileSettings(ProfileFields):
    display_name: str = Field(min_length=2, max_length=80)
    theme: Literal["system", "light", "dark"]
    compact_ui: bool
    default_board_zoom: int = Field(ge=50, le=200)


def make_profile_router(current_user) -> APIRouter:
    router = APIRouter(prefix="/api/v1/account/profile")

    @router.get("")
    async def profile(request: Request, user=Depends(current_user)):
        async with request.app.state.pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT first_name, last_name, display_name, profile_details FROM account_users WHERE id=$1",
                user["id"],
            )
        if row is None:
            raise HTTPException(404, "Профиль не найден.")
        details = json.loads(row["profile_details"])
        return {
            **{key: details.get(key, "") for key in
               ("middle_name", "phone", "city", "organization", "focus_area")},
            "first_name": row["first_name"],
            "last_name": row["last_name"],
            "display_name": row["display_name"],
            "theme": details.get("theme", "system"),
            "compact_ui": details.get("compact_ui", False),
            "default_board_zoom": details.get("default_board_zoom", 100),
        }

    @router.put("/details", status_code=204)
    async def save_details(data: PersonalDetails, request: Request, user=Depends(current_user)):
        if len(data.first_name) == 1:
            raise HTTPException(422, "Имя должно содержать минимум 2 символа.")
        extra = data.model_dump(exclude={"first_name", "last_name"})
        async with request.app.state.pool.acquire() as conn:
            await conn.execute(
                """UPDATE account_users SET first_name=$2, last_name=$3,
                          profile_details=profile_details || $4::jsonb WHERE id=$1""",
                user["id"], data.first_name, data.last_name, json.dumps(extra),
            )
        return Response(status_code=204)

    @router.put("/settings", status_code=204)
    async def save_settings(data: ProfileSettings, request: Request, user=Depends(current_user)):
        extra = data.model_dump(exclude={"display_name"})
        async with request.app.state.pool.acquire() as conn:
            await conn.execute(
                """UPDATE account_users SET display_name=$2,
                          profile_details=profile_details || $3::jsonb WHERE id=$1""",
                user["id"], data.display_name, json.dumps(extra),
            )
        return Response(status_code=204)

    return router
