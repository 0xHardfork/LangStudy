#!/bin/bash

# Exit on any error
set -e

# Resolve script directory and change to backend root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$BACKEND_DIR"

echo "============================================="
echo "Starting LangStudy backend service..."
echo "Working directory: $BACKEND_DIR"

# 1. Check binaries
if [ ! -f "bin/server" ] || [ ! -f "bin/migrate" ]; then
    echo "ERROR: bin/server or bin/migrate not found. Please run 'make build' first."
    exit 1
fi

# 2. Check configuration file
if [ ! -f "config.yaml" ] && [ ! -f "configs/config.yaml" ]; then
    if [ -f "configs/config.prod.yaml" ]; then
        echo "config.yaml not found. Copying configs/config.prod.yaml as default config.yaml..."
        cp configs/config.prod.yaml config.yaml
    else
        echo "ERROR: No configuration file found (configs/config.prod.yaml or config.yaml)."
        exit 1
    fi
fi

# 3. Pre-run migrations
echo "Running database migrations..."
if ./bin/migrate; then
    echo "Database migrations completed successfully."
else
    echo "ERROR: Database migrations failed. Aborting startup."
    exit 1
fi

# 4. Check if server is already running
if [ -f "server.pid" ]; then
    PID=$(cat server.pid)
    if ps -p "$PID" > /dev/null 2>&1; then
        echo "WARNING: Server is already running with PID $PID. Please run stop.sh first."
        exit 0
    else
        echo "Removing stale server.pid file..."
        rm -f server.pid
    fi
fi

# 5. Start server in background
echo "Starting API server in background..."
LOG_FILE="/data/langstudy/log/server.log"
# Attempt to create log directory if permissions allow (usually managed by root/langstudy)
mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true
nohup ./bin/server > "$LOG_FILE" 2>&1 &
NEW_PID=$!

# Save PID
echo $NEW_PID > server.pid

# Check if process is still running after a brief pause
sleep 1.5
if ps -p "$NEW_PID" > /dev/null 2>&1; then
    echo "LangStudy backend started successfully with PID: $NEW_PID"
    echo "Logs are being redirected to $LOG_FILE"
    echo "============================================="
else
    echo "ERROR: Server failed to start. Check $LOG_FILE for details."
    if [ -f "$LOG_FILE" ]; then
        cat "$LOG_FILE" | tail -n 20
    fi
    exit 1
fi
