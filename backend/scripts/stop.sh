#!/bin/bash

# Resolve script directory and change to backend root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$BACKEND_DIR"

echo "============================================="
echo "Stopping LangStudy backend service..."

# Check if PID file exists
if [ ! -f "server.pid" ]; then
    echo "ERROR: server.pid file not found. Is the server running?"
    exit 1
fi

PID=$(cat server.pid)

# Verify if the process actually exists
if ! ps -p "$PID" > /dev/null 2>&1; then
    echo "Stale PID file found (process $PID is not running). Cleaning up..."
    rm -f server.pid
    exit 0
fi

# Send SIGTERM for graceful shutdown
echo "Sending SIGTERM to process $PID (Graceful Shutdown)..."
kill -15 "$PID"

# Wait for the process to exit
LIMIT=20 # Max wait 10 seconds (20 * 0.5s)
COUNT=0
while [ $COUNT -lt $LIMIT ]; do
    if ! ps -p "$PID" > /dev/null 2>&1; then
        echo "Server exited gracefully."
        rm -f server.pid
        echo "============================================="
        exit 0
    fi
    sleep 0.5
    COUNT=$((COUNT + 1))
done

# If still running, force termination
echo "WARNING: Server did not exit after 10 seconds. Forcing shutdown..."
kill -9 "$PID"
rm -f server.pid
echo "Server terminated forcefully."
echo "============================================="
