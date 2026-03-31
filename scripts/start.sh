#!/bin/bash
# PortfolioAI — One command to rule them all
# Starts: Backend + Cloudflare Tunnel + Updates Vercel automatically

set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TUNNEL_LOG="/tmp/cloudflared_portfolioai.log"

cd "$PROJECT_DIR"

echo ""
echo "  ╔══════════════════════════════════════╗"
echo "  ║     PortfolioAI — Ultra Research     ║"
echo "  ╚══════════════════════════════════════╝"
echo ""

# Activate venv
for VENV_PATH in "$PROJECT_DIR/.venv" "$HOME/codigos_python/investimentos_manual/.venv"; do
    if [ -f "$VENV_PATH/bin/activate" ]; then
        source "$VENV_PATH/bin/activate"
        break
    fi
done

# Kill any existing processes
pkill -f "cloudflared tunnel" 2>/dev/null || true
pkill -f "uvicorn app.main" 2>/dev/null || true
sleep 1

# Start Cloudflare Quick Tunnel
echo "  [1/3] Starting Cloudflare Tunnel..."
cloudflared tunnel --url http://localhost:8000 --no-autoupdate > "$TUNNEL_LOG" 2>&1 &
TUNNEL_PID=$!

# Wait for tunnel URL
for i in $(seq 1 15); do
    TUNNEL_URL=$(grep -oP 'https://[a-z0-9-]+\.trycloudflare\.com' "$TUNNEL_LOG" 2>/dev/null | head -1)
    if [ -n "$TUNNEL_URL" ]; then
        break
    fi
    sleep 1
done

if [ -z "$TUNNEL_URL" ]; then
    echo "  ERROR: Tunnel failed to start. Check $TUNNEL_LOG"
    exit 1
fi

echo "  Tunnel: $TUNNEL_URL"

# Update Vercel env var
echo "  [2/3] Updating Vercel..."
cd "$PROJECT_DIR/frontend"
vercel env rm NEXT_PUBLIC_API_URL production --yes > /dev/null 2>&1 || true
vercel env add NEXT_PUBLIC_API_URL production --value "$TUNNEL_URL" --yes > /dev/null 2>&1
vercel --prod --yes > /dev/null 2>&1 &
VERCEL_PID=$!
cd "$PROJECT_DIR"

echo "  Vercel rebuilding in background..."

# Cleanup on exit
cleanup() {
    echo ""
    echo "  Shutting down..."
    kill $TUNNEL_PID 2>/dev/null
    kill $VERCEL_PID 2>/dev/null
    pkill -f "uvicorn app.main" 2>/dev/null
    echo "  Done."
    exit 0
}
trap cleanup INT TERM

echo "  [3/3] Starting backend..."
echo ""
echo "  ╔══════════════════════════════════════════════════╗"
echo "  ║  Backend:  http://localhost:8000                 ║"
echo "  ║  Tunnel:   $TUNNEL_URL"
echo "  ║  Vercel:   https://portfolio-ai-amber.vercel.app ║"
echo "  ║                                                  ║"
echo "  ║  Press Ctrl+C to stop everything                 ║"
echo "  ╚══════════════════════════════════════════════════╝"
echo ""

# Start backend (foreground)
uvicorn app.main:app --reload --port 8000 --host 0.0.0.0
