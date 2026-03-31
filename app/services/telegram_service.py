import httpx
import structlog

from app.config import settings

logger = structlog.get_logger()

TELEGRAM_API_BASE = "https://api.telegram.org/bot{token}"


async def send_message(text: str, parse_mode: str = "HTML") -> bool:
    """Send a message via Telegram Bot API.

    Only sends to the configured TELEGRAM_CHAT_ID (owner only).
    """
    if not settings.telegram_bot_token or not settings.telegram_chat_id:
        logger.warning("telegram_not_configured")
        return False

    url = f"{TELEGRAM_API_BASE.format(token=settings.telegram_bot_token)}/sendMessage"
    payload = {
        "chat_id": settings.telegram_chat_id,
        "text": text,
        "parse_mode": parse_mode,
        "disable_web_page_preview": True,
    }

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(url, json=payload)
            response.raise_for_status()
            logger.info("telegram_message_sent", length=len(text))
            return True
    except Exception:
        logger.error("telegram_send_failed", exc_info=True)
        return False


async def notify_pipeline_complete(amount_brl: str, summary: str) -> bool:
    """Notify that a contribution pipeline completed."""
    text = (
        "<b>Recomendacao de Aporte Pronta</b>\n\n"
        f"<b>Valor:</b> R$ {amount_brl}\n\n"
        f"{summary}\n\n"
        "<i>PortfolioAI — Ultra Research</i>"
    )
    return await send_message(text)


async def notify_lockup_expired(ticker: str, recommendation: str, justification: str) -> bool:
    """Notify that an asset's lock-up period has expired."""
    emoji = {"hold": "MANTER", "sell": "VENDER", "increase": "AUMENTAR"}.get(
        recommendation, recommendation.upper()
    )
    text = (
        f"<b>Lock-Up Expirado — {ticker}</b>\n\n"
        f"<b>Recomendacao:</b> {emoji}\n\n"
        f"{justification}\n\n"
        "<i>PortfolioAI — Reavaliacao D+30</i>"
    )
    return await send_message(text)


async def notify_weekly_report(period: str, performance: str, highlights: str, alerts: str) -> bool:
    """Send the weekly portfolio report."""
    text = (
        f"<b>Relatorio Semanal — {period}</b>\n\n"
        f"<b>Performance:</b> {performance}\n\n"
        f"<b>Destaques:</b>\n{highlights}\n\n"
        f"<b>Alertas:</b>\n{alerts}\n\n"
        "<i>PortfolioAI — Relatorio semanal</i>"
    )
    return await send_message(text)


async def notify_rebalance_alert(alerts: list[str]) -> bool:
    """Notify about allocation deviation."""
    items = "\n".join(f"  - {a}" for a in alerts)
    text = (
        "<b>Alerta de Rebalanceamento</b>\n\n"
        f"{items}\n\n"
        "<i>PortfolioAI — Desvio &gt;5% detectado</i>"
    )
    return await send_message(text)
