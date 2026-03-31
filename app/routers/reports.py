from fastapi import APIRouter, HTTPException

from app.core.database import get_supabase

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("")
async def list_reports():
    """List all weekly reports, most recent first."""
    db = get_supabase()
    result = db.table("weekly_reports").select("*").order("period_end", desc=True).execute()
    return result.data or []


@router.get("/{report_id}")
async def get_report(report_id: str):
    """Get a specific weekly report."""
    db = get_supabase()
    result = db.table("weekly_reports").select("*").eq("id", report_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Report not found")
    return result.data[0]
