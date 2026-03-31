from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.core.scheduler import scheduler, setup_scheduler
from app.routers import contributions, portfolio, prices, reports, research, ws
from app.routers import scheduler as scheduler_router
from app.routers import settings as settings_router

logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    setup_scheduler()
    logger.info("app_started")
    yield
    # Shutdown
    scheduler.shutdown(wait=False)
    logger.info("app_stopped")


app = FastAPI(
    title="PortfolioAI",
    description="Investment portfolio management with multi-agent ultra-research",
    version="0.2.0",
    lifespan=lifespan,
)

allowed_origins = [
    "http://localhost:3000",
    "https://portfolio-ai-amber.vercel.app",
]
if settings.frontend_url and settings.frontend_url not in allowed_origins:
    allowed_origins.append(settings.frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https://.*\.trycloudflare\.com",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

app.include_router(portfolio.router)
app.include_router(prices.router)
app.include_router(contributions.router)
app.include_router(ws.router)
app.include_router(scheduler_router.router)
app.include_router(reports.router)
app.include_router(research.router)
app.include_router(settings_router.router)


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "version": "0.2.0"}
