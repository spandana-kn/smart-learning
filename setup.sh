#!/usr/bin/env bash
# SmartFocus — one-shot dev setup
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "=== SmartFocus Setup ==="

# ── Backend ────────────────────────────────────────────────────────────────
echo ""
echo "→ Setting up backend..."
cd "$ROOT/backend"

if [ ! -d ".venv" ]; then
python3 -m venv .venv
fi
source .venv/bin/activate

pip install --upgrade pip -q
pip install -r requirements.txt -q

if [ ! -f ".env" ]; then
    cp .env.example .env
    echo "  Created backend/.env from .env.example"
fi

echo "  Backend ready."

# ── Frontend ───────────────────────────────────────────────────────────────
echo ""
echo "→ Setting up frontend..."
cd "$ROOT/frontend"

if command -v npm &>/dev/null; then
    npm install --silent
    echo "  Frontend ready."
else
    echo "  ⚠ npm not found — skipping frontend install."
fi

echo ""
echo "=== Setup complete! ==="
echo ""
echo "Start the stack:"
echo "  Backend:  cd backend && source .venv/bin/activate && uvicorn app.main:app --reload"
echo "  Frontend: cd frontend && npm run dev"
