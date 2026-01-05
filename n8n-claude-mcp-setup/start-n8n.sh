#!/bin/bash
export N8N_PORT=5678
export N8N_HOST=0.0.0.0
export N8N_PROTOCOL=http
export GENERIC_TIMEZONE=${GENERIC_TIMEZONE:-Europe/Paris}
export N8N_BASIC_AUTH_ACTIVE=false
export N8N_DIAGNOSTICS_ENABLED=false
export N8N_METRICS=true
export N8N_USER_FOLDER="/root/.n8n"

echo "Starting N8N on port 5678..."
echo "Access N8N at: http://localhost:5678"
n8n start
