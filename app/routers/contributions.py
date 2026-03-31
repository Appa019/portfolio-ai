from decimal import Decimal

import structlog
from fastapi import APIRouter, BackgroundTasks, HTTPException

from app.agents.pipeline import run_contribution_pipeline
from app.core.database import get_supabase
from app.schemas.contribution import ContributionCreate

logger = structlog.get_logger()

router = APIRouter(prefix="/api/aporte", tags=["contributions"])


@router.post("", status_code=201)
async def create_contribution(data: ContributionCreate, background_tasks: BackgroundTasks):
    """Register a new contribution and start the agent pipeline."""
    db = get_supabase()
    result = (
        db.table("contributions")
        .insert(
            {
                "amount_brl": str(data.amount_brl),
                "status": "pending",
                "pipeline_log": [],
            }
        )
        .execute()
    )
    contribution = result.data[0]
    contribution_id = contribution["id"]

    # Launch pipeline in background
    background_tasks.add_task(
        _run_pipeline_safe,
        contribution_id,
        data.amount_brl,
    )

    return {
        "id": contribution_id,
        "status": "pending",
        "message": "Pipeline started. Connect to WebSocket for real-time updates.",
        "ws_url": f"/api/ws/pipeline/{contribution_id}",
    }


@router.get("/{contribution_id}")
async def get_contribution(contribution_id: str):
    """Get contribution status and results."""
    db = get_supabase()
    result = db.table("contributions").select("*").eq("id", contribution_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Contribution not found")
    return result.data[0]


@router.get("/{contribution_id}/agents")
async def get_contribution_agents(contribution_id: str):
    """Get status of each agent in the pipeline."""
    db = get_supabase()
    result = (
        db.table("agent_runs")
        .select("*")
        .eq("contribution_id", contribution_id)
        .order("agent_order")
        .execute()
    )
    return result.data or []


async def _run_pipeline_safe(contribution_id: str, amount_brl: Decimal) -> None:
    """Wrapper to catch exceptions from background pipeline."""
    try:
        await run_contribution_pipeline(contribution_id, amount_brl)
    except Exception:
        logger.error("pipeline_background_error", contribution_id=contribution_id, exc_info=True)
