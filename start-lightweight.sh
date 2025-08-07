#!/bin/bash

# Kill any existing node processes for AnythingLLM
echo "Stopping any existing AnythingLLM processes..."
pkill -f "node.*server/index.js" || true
pkill -f "node.*collector/index.js" || true

# Start ChromaDB if not running
if ! pgrep -f "chroma run" > /dev/null; then
    echo "Starting ChromaDB..."
    if [ -d "venv" ] && [ -f "venv/bin/activate" ]; then
        source venv/bin/activate
        chroma run --path ./chroma_data --port 8000 &
        deactivate
    else
        echo "Error: Python venv not found. Please run ./scripts/setup-python-env.sh first."
        exit 1
    fi
    sleep 5
else
    echo "ChromaDB is already running"
fi

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Start server in production mode
echo "Starting AnythingLLM server..."
cd "$SCRIPT_DIR/server" && NODE_ENV=production node index.js &
SERVER_PID=$!

# Start collector in production mode
echo "Starting AnythingLLM collector..."
cd "$SCRIPT_DIR/collector" && NODE_ENV=production STORAGE_DIR="$SCRIPT_DIR/server/storage" node index.js &
COLLECTOR_PID=$!

echo ""
echo "================================="
echo "AnythingLLM Lightweight is running!"
echo "================================="
echo "Server PID: $SERVER_PID"
echo "Collector PID: $COLLECTOR_PID"
echo ""
echo "Access the application at: http://localhost:3001"
echo ""
echo "To stop all services, run: pkill node"
echo ""

# Keep script running
wait
