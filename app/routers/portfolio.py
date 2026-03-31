from fastapi import APIRouter, HTTPException

from app.schemas.asset import AssetCreate
from app.schemas.pipeline import AllocationBreakdown, PortfolioSummary
from app.services import portfolio_service

router = APIRouter(prefix="/api/portfolio", tags=["portfolio"])


@router.get("", response_model=PortfolioSummary)
async def get_portfolio():
    """Get complete portfolio summary with allocation breakdown."""
    return await portfolio_service.get_portfolio_summary()


@router.get("/allocation", response_model=AllocationBreakdown)
async def get_allocation():
    """Get current allocation vs target."""
    return await portfolio_service.calculate_allocation()


@router.get("/assets")
async def list_assets():
    """List all portfolio assets."""
    return await portfolio_service.get_all_assets()


@router.post("/assets", status_code=201)
async def create_asset(asset: AssetCreate):
    """Add a new asset to the portfolio."""
    try:
        return await portfolio_service.add_asset(asset.model_dump())
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/assets/{asset_id}/sell")
async def sell_asset(asset_id: str):
    """Sell an asset and record the transaction. Returns sale value for redistribution."""
    try:
        return await portfolio_service.sell_asset(asset_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/assets/{asset_id}")
async def delete_asset(asset_id: str):
    """Remove an asset from the portfolio (fails if locked)."""
    try:
        return await portfolio_service.remove_asset(asset_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
