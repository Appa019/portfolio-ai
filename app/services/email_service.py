from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import aiosmtplib
import structlog

from app.config import settings

logger = structlog.get_logger()


async def send_email(subject: str, html_content: str, to: str | None = None) -> bool:
    """Send an email via Gmail SMTP."""
    recipient = to or settings.email_recipient
    if not settings.gmail_user or not settings.gmail_app_password:
        logger.warning("email_not_configured", subject=subject)
        return False

    message = MIMEMultipart("alternative")
    message["From"] = settings.gmail_user
    message["To"] = recipient
    message["Subject"] = subject
    message.attach(MIMEText(html_content, "html"))

    try:
        await aiosmtplib.send(
            message,
            hostname="smtp.gmail.com",
            port=587,
            start_tls=True,
            username=settings.gmail_user,
            password=settings.gmail_app_password,
        )
        logger.info("email_sent", subject=subject, to=recipient)
        return True
    except Exception:
        logger.error("email_failed", subject=subject, to=recipient, exc_info=True)
        return False
