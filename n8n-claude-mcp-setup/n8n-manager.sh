#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
N8N_PID_FILE="${SCRIPT_DIR}/.n8n.pid"
N8N_PORT=5678

case "$1" in
    start)
        if [ -f "$N8N_PID_FILE" ] && kill -0 $(cat "$N8N_PID_FILE") 2>/dev/null; then
            echo "N8N is already running (PID: $(cat $N8N_PID_FILE))"
            exit 0
        fi
        echo "Starting N8N..."
        export N8N_PORT=$N8N_PORT N8N_HOST=0.0.0.0 N8N_PROTOCOL=http
        nohup n8n start > "${SCRIPT_DIR}/n8n.log" 2>&1 &
        echo $! > "$N8N_PID_FILE"
        echo "N8N started (PID: $!)"
        echo "Access at: http://localhost:${N8N_PORT}"
        ;;
    stop)
        if [ -f "$N8N_PID_FILE" ]; then
            kill $(cat "$N8N_PID_FILE") 2>/dev/null
            rm -f "$N8N_PID_FILE"
            echo "N8N stopped"
        else
            echo "N8N is not running"
        fi
        ;;
    status)
        if [ -f "$N8N_PID_FILE" ] && kill -0 $(cat "$N8N_PID_FILE") 2>/dev/null; then
            echo "N8N is running (PID: $(cat $N8N_PID_FILE))"
            curl -s "http://localhost:${N8N_PORT}/healthz" 2>/dev/null && echo ""
        else
            echo "N8N is not running"
        fi
        ;;
    logs)
        tail -f "${SCRIPT_DIR}/n8n.log"
        ;;
    test)
        echo "Testing N8N connection..."
        curl -s "http://localhost:${N8N_PORT}/healthz" && echo ""
        echo "Testing MCP server..."
        node "${SCRIPT_DIR}/mcp-server/server.js" --test 2>/dev/null || echo "MCP server test skipped"
        ;;
    *)
        echo "Usage: $0 {start|stop|status|logs|test}"
        exit 1
        ;;
esac
