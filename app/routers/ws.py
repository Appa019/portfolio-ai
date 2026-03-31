import asyncio
import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.agents.pipeline import subscribe_to_pipeline, unsubscribe_from_pipeline

router = APIRouter(tags=["websocket"])


@router.websocket("/api/ws/pipeline/{contribution_id}")
async def pipeline_websocket(websocket: WebSocket, contribution_id: str):
    """WebSocket endpoint for real-time pipeline status updates."""
    await websocket.accept()
    queue = await subscribe_to_pipeline(contribution_id)

    try:
        while True:
            try:
                event = await asyncio.wait_for(queue.get(), timeout=300)
                await websocket.send_text(json.dumps(event, default=str))

                # Close on pipeline completion or failure
                if event.get("agent") == "pipeline" and event.get("status") in (
                    "completed",
                    "failed",
                ):
                    break
            except TimeoutError:
                # Send keepalive ping
                await websocket.send_text(json.dumps({"type": "ping"}))
    except WebSocketDisconnect:
        pass
    finally:
        await unsubscribe_from_pipeline(contribution_id, queue)
