#!/bin/bash

cd "$(dirname "$0")"

echo "============================================"
echo "  AITuberKit - Starting..."
echo "============================================"
echo ""

if ! command -v pnpm &> /dev/null; then
    echo "[ERROR] pnpm is not installed or not in PATH."
    echo "Please enable corepack (run: corepack enable) or install pnpm (run: npm install -g pnpm)."
    read -p "Press Enter to close..."
    exit 1
fi

if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    pnpm install
    if [ $? -ne 0 ]; then
        echo "[ERROR] pnpm install failed."
        read -p "Press Enter to close..."
        exit 1
    fi
    echo ""
fi

echo "Starting development server..."
echo "Press Ctrl+C to stop the server."
echo ""

# Open browser automatically after server starts
(sleep 3 && open http://localhost:3000) &

pnpm dev

read -p "Press Enter to close..."
