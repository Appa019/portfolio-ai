from fastapi import APIRouter, HTTPException

from app.core.database import get_supabase

router = APIRouter(prefix="/api/research", tags=["research"])


@router.get("/{contribution_id}/analyses")
async def get_research_analyses(contribution_id: str, asset_class: str | None = None):
    """Get all research analyses for a contribution."""
    db = get_supabase()
    query = db.table("research_analyses").select("*").eq("contribution_id", contribution_id)

    if asset_class:
        query = query.eq("asset_class", asset_class)

    result = query.order("created_at").execute()
    return {"analyses": result.data or []}


@router.get("/{contribution_id}/analyses/{ticker}")
async def get_ticker_analysis(contribution_id: str, ticker: str):
    """Get detailed analysis for a specific ticker."""
    db = get_supabase()
    result = (
        db.table("research_analyses")
        .select("*")
        .eq("contribution_id", contribution_id)
        .eq("ticker", ticker)
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Analysis not found")

    return result.data[0]


@router.get("/{contribution_id}/risk")
async def get_risk_assessment(contribution_id: str):
    """Get risk analyst output for a contribution."""
    db = get_supabase()
    result = (
        db.table("contributions")
        .select("risk_assessment")
        .eq("id", contribution_id)
        .single()
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Contribution not found")

    return result.data.get("risk_assessment") or {}


@router.get("/{contribution_id}/sentiment")
async def get_sentiment_assessment(contribution_id: str):
    """Get sentiment analyst output for a contribution."""
    db = get_supabase()
    result = (
        db.table("contributions")
        .select("sentiment_assessment")
        .eq("id", contribution_id)
        .single()
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Contribution not found")

    return result.data.get("sentiment_assessment") or {}


@router.get("/{contribution_id}/macro")
async def get_macro_context(contribution_id: str):
    """Get macro economic context used in the pipeline."""
    db = get_supabase()
    result = (
        db.table("macro_snapshots")
        .select("*")
        .eq("contribution_id", contribution_id)
        .order("captured_at", desc=True)
        .limit(1)
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Macro snapshot not found")

    return result.data[0]


@router.get("/{contribution_id}/agents")
async def get_agent_runs(contribution_id: str):
    """Get all agent execution logs for a contribution."""
    db = get_supabase()
    result = (
        db.table("agent_runs")
        .select("*")
        .eq("contribution_id", contribution_id)
        .order("agent_order")
        .execute()
    )
    return {"agents": result.data or []}
