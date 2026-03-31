from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.database import get_supabase

router = APIRouter(prefix="/api/settings", tags=["settings"])


class AllocationTargets(BaseModel):
    fixed_income: float
    stocks: float
    crypto: float


@router.get("/allocation")
async def get_allocation_targets() -> dict[str, Any]:
    """Get current allocation targets."""
    db = get_supabase()
    result = (
        db.table("user_settings")
        .select("value")
        .eq("key", "allocation_targets")
        .single()
        .execute()
    )
    if not result.data:
        return {"fixed_income": 35, "stocks": 40, "crypto": 25}
    return result.data["value"]


@router.put("/allocation")
async def update_allocation_targets(data: AllocationTargets) -> dict[str, Any]:
    """Update allocation targets. Sum must equal 100."""
    total = data.fixed_income + data.stocks + data.crypto
    if abs(total - 100) > 0.5:
        raise HTTPException(
            status_code=400,
            detail=f"Allocation must sum to 100%, got {total}%",
        )

    value = {
        "fixed_income": data.fixed_income,
        "stocks": data.stocks,
        "crypto": data.crypto,
    }

    db = get_supabase()
    db.table("user_settings").upsert(
        {"key": "allocation_targets", "value": value},
        on_conflict="key",
    ).execute()

    return value
