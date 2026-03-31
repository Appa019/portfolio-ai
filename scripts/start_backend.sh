#!/bin/bash
# PortfolioAI — Start backend + Cloudflare Tunnel
# Exposes localhost:8000 via public HTTPS URL
# The Vercel frontend connects through this tunnel

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
TUNNEL_LOG="/tmp/cloudflared.log"

cd "$PROJECT_DIR"

echo "================================================"
echo "  PortfolioAI — Backend + Tunnel"
echo "================================================"
echo ""

# Activate venv
if [ -f ".venv/bin/activate" ]; then
    source .venv/bin/activate
elif [ -f "$HOME/codigos_python/investimentos_manual/.venv/bin/activate" ]; then
    source "$HOME/codigos_python/investimentos_manual/.venv/bin/activate"
fi

# Kill any existing tunnel
pkill -f "cloudflared tunnel" 2>/dev/null || true

# Start tunnel in background
echo "[1/2] Starting Cloudflare Tunnel..."
cloudflared tunnel --url http://localhost:8000 --no-autoupdate > "$TUNNEL_LOG" 2>&1 &
TUNNEL_PID=$!

# Wait for URL
sleep 5
TUNNEL_URL=$(grep -oP 'https://[a-z0-9-]+\.trycloudflare\.com' "$TUNNEL_LOG" | head -1)

if [ -z "$TUNNEL_URL" ]; then
    sleep 5
    TUNNEL_URL=$(grep -oP 'https://[a-z0-9-]+\.trycloudflare\.com' "$TUNNEL_LOG" | head -1)
fi

echo ""
echo "================================================"
echo "  Tunnel URL: $TUNNEL_URL"
echo "  Vercel:     https://portfolio-ai-amber.vercel.app"
echo "  Backend:    http://localhost:8000"
echo "================================================"
echo ""
echo "If the tunnel URL changed, update it in Vercel:"
echo "  cd frontend && vercel env rm NEXT_PUBLIC_API_URL production --yes"
echo "  vercel env add NEXT_PUBLIC_API_URL production --value \"$TUNNEL_URL\" --yes"
echo "  vercel --prod --yes"
echo ""

# Cleanup on exit
cleanup() {
    echo ""
    echo "Shutting down..."
    kill $TUNNEL_PID 2>/dev/null
    exit 0
}
trap cleanup INT TERM

# Start backend
echo "[2/2] Starting FastAPI backend..."
uvicorn app.main:app --reload --port 8000 --host 0.0.0.0
