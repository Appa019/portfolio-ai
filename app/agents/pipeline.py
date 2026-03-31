import asyncio
import json
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

import structlog

from app.agents.b3_screener import B3ScreenerAgent
from app.agents.base import AgentResult, BaseAgent
from app.agents.consolidator import ConsolidatorAgent
from app.agents.crypto_screener import CryptoScreenerAgent
from app.agents.deep_research_b3 import DeepResearchB3Agent
from app.agents.deep_research_crypto import DeepResearchCryptoAgent
from app.agents.macro_analyst import MacroAnalystAgent
from app.agents.portfolio_balancer import PortfolioBalancerAgent
from app.agents.risk_analyst import RiskAnalystAgent
from app.agents.sector_analyst import SectorAnalystAgent
from app.agents.sentiment_analyst import SentimentAnalystAgent
from app.core.browser import ClaudeSession
from app.core.database import get_supabase
from app.services import market_data_service, portfolio_service, telegram_service

logger = structlog.get_logger()

# Global event queues for WebSocket subscriptions
_event_queues: dict[str, list[asyncio.Queue]] = {}
_event_queues_lock = asyncio.Lock()


async def subscribe_to_pipeline(contribution_id: str) -> asyncio.Queue:
    """Subscribe to pipeline events for a contribution."""
    queue: asyncio.Queue = asyncio.Queue()
    async with _event_queues_lock:
        if contribution_id not in _event_queues:
            _event_queues[contribution_id] = []
        _event_queues[contribution_id].append(queue)
    return queue


async def unsubscribe_from_pipeline(contribution_id: str, queue: asyncio.Queue) -> None:
    """Unsubscribe from pipeline events."""
    async with _event_queues_lock:
        if contribution_id in _event_queues:
            _event_queues[contribution_id] = [
                q for q in _event_queues[contribution_id] if q is not queue
            ]


async def _emit_event(contribution_id: str, event: dict[str, Any]) -> None:
    """Emit an event to all subscribers of a pipeline."""
    async with _event_queues_lock:
        queues = list(_event_queues.get(contribution_id, []))
    for queue in queues:
        await queue.put(event)


async def run_contribution_pipeline(contribution_id: UUID, amount_brl: Decimal) -> dict[str, Any]:
    """Execute the full ultra-research agent pipeline for a contribution.

    Flow (11 steps):
    1.  [API] Fetch macro data (BCB, yfinance, CoinGecko)
    2.  MacroAnalyst (1 prompt, research mode)
    3.  SectorAnalyst (1 prompt, research mode)
    4.  PortfolioBalancer (1 prompt, macro-informed)
    5.  B3Screener + CryptoScreener (sequential, research mode)
    6.  [API] Fetch candidate fundamentals
    7.  DeepResearchB3 (3 rounds, multi-turn)
    8.  DeepResearchCrypto (3 rounds, multi-turn)
    9.  RiskAnalyst (1 prompt, research mode)
    10. SentimentAnalyst (1 prompt, research mode)
    11. Consolidator (1 prompt, receives everything)
    """
    cid = str(contribution_id)
    db = get_supabase()

    db.table("contributions").update({"status": "processing"}).eq("id", cid).execute()

    session = ClaudeSession()
    context: dict[str, Any] = {
        "amount_brl": str(amount_brl),
        "agent_results": {},
        "market_data": {},
        "candidate_data": {},
    }

    try:
        await session.initialize()
        is_logged_in = await session.ensure_logged_in()
        if not is_logged_in:
            raise RuntimeError("Not logged in to claude.ai. Run scripts/login_claude.py first.")

        # Build portfolio summary
        summary = await portfolio_service.get_portfolio_summary()
        context["portfolio_summary"] = json.loads(summary.model_dump_json())

        # --- Step 1: Fetch macro data from APIs (no browser) ---
        await _emit_event(cid, {"agent": "market_data", "status": "running"})
        logger.info("pipeline_step", step=1, action="fetch_market_data")

        market_context = await market_data_service.build_full_context()
        context["market_data"] = market_context
        await market_data_service.save_macro_snapshot(cid, market_context)

        db.table("contributions").update({"macro_context": market_context}).eq("id", cid).execute()

        await _emit_event(cid, {"agent": "market_data", "status": "completed"})

        # --- Step 2: MacroAnalyst ---
        result = await _run_agent(MacroAnalystAgent(), session, context, contribution_id, cid)
        context["agent_results"]["macro_analyst"] = result.output

        # --- Step 3: SectorAnalyst ---
        result = await _run_agent(SectorAnalystAgent(), session, context, contribution_id, cid)
        context["agent_results"]["sector_analyst"] = result.output

        # --- Step 4: PortfolioBalancer ---
        result = await _run_agent(PortfolioBalancerAgent(), session, context, contribution_id, cid)
        context["agent_results"]["portfolio_balancer"] = result.output

        # --- Step 5: B3 Screener + Crypto Screener (sequential) ---
        result = await _run_agent(B3ScreenerAgent(), session, context, contribution_id, cid)
        context["agent_results"]["b3_screener"] = result.output

        result = await _run_agent(CryptoScreenerAgent(), session, context, contribution_id, cid)
        context["agent_results"]["crypto_screener"] = result.output

        # --- Step 6: Fetch candidate fundamentals from APIs (no browser) ---
        await _emit_event(cid, {"agent": "candidate_data", "status": "running"})
        logger.info("pipeline_step", step=6, action="fetch_candidate_data")

        stock_tickers = _extract_candidate_tickers(
            context["agent_results"].get("b3_screener", {}), "candidatos"
        )
        crypto_ids = _extract_candidate_tickers(
            context["agent_results"].get("crypto_screener", {}), "candidatos"
        )

        stock_data, crypto_data = [], []
        if stock_tickers:
            stock_data = await market_data_service.enrich_stock_candidates(stock_tickers[:10])
        if crypto_ids:
            crypto_data = await market_data_service.enrich_crypto_candidates(crypto_ids[:10])

        context["candidate_data"] = {
            "stocks": stock_data,
            "crypto": crypto_data,
        }

        await _emit_event(cid, {"agent": "candidate_data", "status": "completed"})

        # --- Step 7: DeepResearchB3 (3 rounds, multi-turn) ---
        deep_b3 = DeepResearchB3Agent()
        result = await _run_agent(deep_b3, session, context, contribution_id, cid)
        context["agent_results"]["deep_research_b3"] = result.output

        # --- Step 8: DeepResearchCrypto (3 rounds, multi-turn) ---
        deep_crypto = DeepResearchCryptoAgent()
        result = await _run_agent(deep_crypto, session, context, contribution_id, cid)
        context["agent_results"]["deep_research_crypto"] = result.output

        # --- Step 9: RiskAnalyst ---
        result = await _run_agent(RiskAnalystAgent(), session, context, contribution_id, cid)
        context["agent_results"]["risk_analyst"] = result.output

        db.table("contributions").update({"risk_assessment": result.output}).eq("id", cid).execute()

        # --- Step 10: SentimentAnalyst ---
        result = await _run_agent(SentimentAnalystAgent(), session, context, contribution_id, cid)
        context["agent_results"]["sentiment_analyst"] = result.output

        db.table("contributions").update({"sentiment_assessment": result.output}).eq(
            "id", cid
        ).execute()

        # --- Step 11: Consolidator ---
        final_result = await _run_agent(ConsolidatorAgent(), session, context, contribution_id, cid)
        context["agent_results"]["consolidator"] = final_result.output

        # Save final result
        db.table("contributions").update(
            {
                "status": "completed",
                "distribution": context["agent_results"].get("portfolio_balancer"),
                "final_recommendation": final_result.output,
                "completed_at": datetime.now(UTC).isoformat(),
            }
        ).eq("id", cid).execute()

        # Save per-ticker analyses to research_analyses table
        await _save_research_analyses(cid, context["agent_results"])

        await _emit_event(cid, {"agent": "pipeline", "status": "completed"})
        logger.info("pipeline_completed", contribution_id=cid)

        # Notify via Telegram
        summary = final_result.output.get("resumo_executivo", "Recomendacao pronta.")
        await telegram_service.notify_pipeline_complete(
            amount_brl=str(amount_brl),
            summary=summary,
        )

        return final_result.output

    except Exception as e:
        db.table("contributions").update(
            {
                "status": "failed",
                "pipeline_log": [{"error": str(e)}],
            }
        ).eq("id", cid).execute()

        await _emit_event(cid, {"agent": "pipeline", "status": "failed", "error": str(e)})
        logger.error("pipeline_failed", contribution_id=cid, error=str(e))
        raise

    finally:
        await session.close()
        async with _event_queues_lock:
            if cid in _event_queues:
                del _event_queues[cid]


async def _run_agent(
    agent: BaseAgent,
    session: ClaudeSession,
    context: dict[str, Any],
    contribution_id: UUID,
    cid: str,
) -> AgentResult:
    """Run a single agent with event emission."""
    await _emit_event(cid, {"agent": agent.name, "status": "running"})

    async def on_round_complete(round_num: int, total_rounds: int) -> None:
        await _emit_event(
            cid,
            {
                "agent": agent.name,
                "status": "running",
                "round_info": {
                    "round_number": round_num,
                    "total_rounds": total_rounds,
                },
            },
        )

    result = await agent.run(session, context, contribution_id, on_round_complete)

    await _emit_event(
        cid,
        {
            "agent": agent.name,
            "status": result.status,
            "data": result.output,
        },
    )

    if result.status != "completed":
        logger.warning(
            "agent_not_completed",
            agent=agent.name,
            status=result.status,
            error=result.error,
        )

    return result


def _extract_candidate_tickers(agent_output: dict[str, Any], key: str = "candidatos") -> list[str]:
    """Extract ticker list from a screener agent output."""
    tickers = []
    for candidate in agent_output.get(key, []):
        ticker = candidate.get("ticker")
        if ticker:
            tickers.append(ticker)
    return tickers


async def _save_research_analyses(contribution_id: str, agent_results: dict[str, Any]) -> None:
    """Save per-ticker analyses to the research_analyses table."""
    db = get_supabase()

    # Save B3 analyses
    b3_data = agent_results.get("deep_research_b3", {})
    risk_data = agent_results.get("risk_analyst", {})
    sentiment_data = agent_results.get("sentiment_analyst", {})

    risk_by_ticker = {r["ticker"]: r for r in risk_data.get("riscos_acoes", [])}
    sentiment_by_ticker = {s["ticker"]: s for s in sentiment_data.get("sentimento_acoes", [])}

    for analysis in b3_data.get("analises", []):
        ticker = analysis.get("ticker", "")
        risk = risk_by_ticker.get(ticker, {})
        sentiment = sentiment_by_ticker.get(ticker, {})

        db.table("research_analyses").insert(
            {
                "contribution_id": contribution_id,
                "agent_name": "deep_research_b3",
                "ticker": ticker,
                "asset_class": "stocks",
                "analysis_data": analysis,
                "risk_score": risk.get("risk_score"),
                "sentiment_score": sentiment.get("sentiment_score"),
                "confidence": analysis.get("confianca"),
            }
        ).execute()

    # Save crypto analyses
    crypto_data = agent_results.get("deep_research_crypto", {})
    risk_by_crypto = {r["ticker"]: r for r in risk_data.get("riscos_crypto", [])}
    sentiment_by_crypto = {s["ticker"]: s for s in sentiment_data.get("sentimento_crypto", [])}

    for analysis in crypto_data.get("analises", []):
        ticker = analysis.get("ticker", "")
        risk = risk_by_crypto.get(ticker, {})
        sentiment = sentiment_by_crypto.get(ticker, {})

        db.table("research_analyses").insert(
            {
                "contribution_id": contribution_id,
                "agent_name": "deep_research_crypto",
                "ticker": ticker,
                "asset_class": "crypto",
                "analysis_data": analysis,
                "risk_score": risk.get("risk_score"),
                "sentiment_score": sentiment.get("sentiment_score"),
                "confidence": analysis.get("confianca"),
            }
        ).execute()
