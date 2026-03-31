import json
from datetime import date, timedelta

import structlog
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from app.agents.reevaluation import ReevaluationAgent
from app.agents.weekly_report import WeeklyReportAgent
from app.core.browser import ClaudeSession
from app.core.database import get_supabase
from app.services import portfolio_service, price_service, telegram_service

logger = structlog.get_logger()

scheduler = AsyncIOScheduler()


def setup_scheduler() -> None:
    """Configure and start all scheduled jobs."""
    scheduler.add_job(
        job_update_prices,
        IntervalTrigger(hours=1),
        id="update_prices",
        name="Update all asset prices",
        replace_existing=True,
    )

    scheduler.add_job(
        job_check_lockup,
        CronTrigger(hour=8, minute=0),
        id="check_lockup",
        name="Check lock-up expiry and trigger reevaluation",
        replace_existing=True,
    )

    scheduler.add_job(
        job_rebalance_check,
        CronTrigger(hour=9, minute=0),
        id="rebalance_check",
        name="Check portfolio allocation deviation",
        replace_existing=True,
    )

    scheduler.add_job(
        job_weekly_report,
        CronTrigger(day_of_week="fri", hour=12, minute=0),
        id="weekly_report",
        name="Generate weekly portfolio report",
        replace_existing=True,
    )

    scheduler.start()
    logger.info("scheduler_started", jobs=len(scheduler.get_jobs()))


async def job_update_prices() -> None:
    """Update prices for all portfolio assets."""
    try:
        results = await price_service.update_all_prices()
        logger.info("scheduled_price_update", results=len(results))
    except Exception:
        logger.error("scheduled_price_update_failed", exc_info=True)


async def job_check_lockup() -> None:
    """Check for assets completing D+30 and trigger reevaluation."""
    try:
        await portfolio_service.update_lockup_statuses()

        expiring = await portfolio_service.check_lockup_expiry()
        if not expiring:
            logger.info("no_lockup_expirations")
            return

        session = ClaudeSession()
        try:
            await session.initialize()
            if not await session.ensure_logged_in():
                logger.error("reevaluation_login_failed")
                return

            agent = ReevaluationAgent()
            db = get_supabase()

            for asset in expiring:
                context = {"asset": asset}
                result = await agent.run(session, context)

                decision = _extract_decision(result.output)
                justification = result.output.get("justificativa", "")

                db.table("asset_reviews").insert(
                    {
                        "asset_id": asset["id"],
                        "review_type": "d30_reevaluation",
                        "recommendation": decision,
                        "reasoning": result.output,
                    }
                ).execute()

                await telegram_service.notify_lockup_expired(
                    ticker=asset["ticker"],
                    recommendation=decision,
                    justification=justification,
                )

                logger.info(
                    "reevaluation_completed",
                    ticker=asset["ticker"],
                    decision=decision,
                )
        finally:
            await session.close()

    except Exception:
        logger.error("scheduled_lockup_check_failed", exc_info=True)


async def job_rebalance_check() -> None:
    """Check if any asset class deviates >5% from target."""
    try:
        summary = await portfolio_service.get_portfolio_summary()
        alerts = []

        for asset_class, deviation in summary.deviation.items():
            if abs(deviation) > 5.0:
                alerts.append(f"{asset_class}: {deviation:+.1f}% deviation from target")

        if alerts:
            logger.warning("rebalance_needed", alerts=alerts)
            await telegram_service.notify_rebalance_alert(alerts)
        else:
            logger.info("allocation_within_target")

    except Exception:
        logger.error("scheduled_rebalance_check_failed", exc_info=True)


async def job_weekly_report() -> None:
    """Generate the weekly portfolio report."""
    try:
        today = date.today()
        period_end = today
        period_start = today - timedelta(days=today.weekday())

        summary = await portfolio_service.get_portfolio_summary()

        session = ClaudeSession()
        try:
            await session.initialize()
            if not await session.ensure_logged_in():
                logger.error("weekly_report_login_failed")
                return

            agent = WeeklyReportAgent()
            context = {
                "period_start": period_start.isoformat(),
                "period_end": period_end.isoformat(),
                "portfolio_summary": json.loads(summary.model_dump_json()),
            }

            result = await agent.run(session, context)

            db = get_supabase()
            db.table("weekly_reports").insert(
                {
                    "period_start": period_start.isoformat(),
                    "period_end": period_end.isoformat(),
                    "content": result.output,
                    "summary": result.output.get("resumo_executivo", ""),
                }
            ).execute()

            period = f"{period_start.strftime('%d/%m')} a {period_end.strftime('%d/%m/%Y')}"
            await telegram_service.notify_weekly_report(
                period=period,
                performance=result.output.get("performance_semanal", "N/A"),
                highlights=result.output.get("resumo_executivo", ""),
                alerts=str(result.output.get("alertas", [])),
            )

            logger.info("weekly_report_generated", period=f"{period_start} to {period_end}")

        finally:
            await session.close()

    except Exception:
        logger.error("scheduled_weekly_report_failed", exc_info=True)


def _extract_decision(output: dict) -> str:
    """Extract recommendation from reevaluation output."""
    decision = output.get("decisao", "").upper()
    if decision in ("MANTER", "HOLD"):
        return "hold"
    if decision in ("VENDER", "SELL"):
        return "sell"
    if decision in ("AUMENTAR", "INCREASE"):
        return "increase"
    return "hold"
