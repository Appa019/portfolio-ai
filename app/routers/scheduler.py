import asyncio

from fastapi import APIRouter, HTTPException

from app.core.scheduler import (
    job_check_lockup,
    job_rebalance_check,
    job_update_prices,
    job_weekly_report,
    scheduler,
)

router = APIRouter(prefix="/api/scheduler", tags=["scheduler"])

_JOB_FUNCTIONS = {
    "update_prices": job_update_prices,
    "check_lockup": job_check_lockup,
    "rebalance_check": job_rebalance_check,
    "weekly_report": job_weekly_report,
}


@router.get("/jobs")
async def list_jobs():
    """List all scheduled jobs with their next run time."""
    jobs = scheduler.get_jobs()
    return [
        {
            "id": job.id,
            "name": job.name,
            "next_run": str(job.next_run_time) if job.next_run_time else None,
            "trigger": str(job.trigger),
        }
        for job in jobs
    ]


@router.post("/trigger/{job_id}")
async def trigger_job(job_id: str):
    """Manually trigger a scheduled job."""
    fn = _JOB_FUNCTIONS.get(job_id)
    if not fn:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found")

    asyncio.create_task(fn())
    return {"status": "triggered", "job_id": job_id}
