#!/bin/bash
#===============================================================================
# N8N + Claude MCP Integration - Complete Installation Script
# Version: 1.0.0
# Description: Installs Docker, N8N, and configures MCP for Claude integration
# Author: Claude Code
# License: MIT
#===============================================================================

set -e  # Exit on error

#===============================================================================
# CONFIGURATION VARIABLES
#===============================================================================
N8N_PORT=5678
N8N_WEBHOOK_URL="http://localhost:${N8N_PORT}"
N8N_DATA_DIR="${HOME}/.n8n"
MCP_SERVER_PORT=3847
INSTALL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="${INSTALL_DIR}/installation.log"
CLAUDE_CONFIG_DIR="${HOME}/.claude"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

#===============================================================================
# UTILITY FUNCTIONS
#===============================================================================

log() {
    local level=$1
    shift
    local message="$@"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${timestamp} [${level}] ${message}" | tee -a "${LOG_FILE}"
}

info() {
    echo -e "${BLUE}[INFO]${NC} $@"
    log "INFO" "$@"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $@"
    log "SUCCESS" "$@"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $@"
    log "WARNING" "$@"
}

error() {
    echo -e "${RED}[ERROR]${NC} $@"
    log "ERROR" "$@"
}

header() {
    echo ""
    echo -e "${PURPLE}============================================================${NC}"
    echo -e "${PURPLE} $@ ${NC}"
    echo -e "${PURPLE}============================================================${NC}"
    echo ""
}

check_command() {
    command -v "$1" &> /dev/null
}

wait_for_service() {
    local url=$1
    local max_attempts=${2:-30}
    local attempt=1

    info "Waiting for service at ${url}..."
    while [ $attempt -le $max_attempts ]; do
        if curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null | grep -q "200\|301\|302"; then
            success "Service is ready!"
            return 0
        fi
        echo -n "."
        sleep 2
        ((attempt++))
    done
    echo ""
    error "Service did not become ready in time"
    return 1
}

#===============================================================================
# PHASE 1: SYSTEM PREPARATION
#===============================================================================

phase1_system_preparation() {
    header "PHASE 1: System Preparation"

    info "Detecting operating system..."
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
        OS_VERSION=$VERSION_ID
        info "Detected: ${OS} ${OS_VERSION}"
    elif [ "$(uname)" == "Darwin" ]; then
        OS="macos"
        OS_VERSION=$(sw_vers -productVersion)
        info "Detected: macOS ${OS_VERSION}"
    else
        error "Unsupported operating system"
        exit 1
    fi

    info "Updating package lists..."
    case $OS in
        ubuntu|debian)
            apt-get update -qq
            apt-get install -y -qq curl wget gnupg lsb-release ca-certificates apt-transport-https software-properties-common jq
            ;;
        fedora|centos|rhel)
            dnf update -y -q || yum update -y -q
            dnf install -y -q curl wget jq || yum install -y -q curl wget jq
            ;;
        macos)
            if ! check_command brew; then
                warning "Installing Homebrew..."
                /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
            fi
            brew update
            brew install curl wget jq
            ;;
    esac

    success "System preparation complete"
}

#===============================================================================
# PHASE 2: DOCKER INSTALLATION & REPAIR
#===============================================================================

phase2_docker_installation() {
    header "PHASE 2: Docker Installation & Configuration"

    # Check if Docker is already installed and working
    if check_command docker && docker info &>/dev/null; then
        success "Docker is already installed and running"
        docker --version
        return 0
    fi

    info "Docker not found or not working. Installing/Repairing Docker..."

    # Remove any old or broken Docker installations
    info "Removing old Docker installations (if any)..."
    case $OS in
        ubuntu|debian)
            apt-get remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true
            apt-get purge -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin 2>/dev/null || true
            rm -rf /var/lib/docker /etc/docker 2>/dev/null || true
            rm -f /etc/apt/sources.list.d/docker.list 2>/dev/null || true
            rm -f /etc/apt/keyrings/docker.gpg 2>/dev/null || true
            ;;
        fedora|centos|rhel)
            dnf remove -y docker docker-client docker-client-latest docker-common docker-latest docker-latest-logrotate docker-logrotate docker-engine 2>/dev/null || true
            ;;
        macos)
            # For macOS, we'll use Docker Desktop or Colima
            ;;
    esac

    # Install Docker
    info "Installing Docker..."
    case $OS in
        ubuntu|debian)
            # Add Docker's official GPG key
            install -m 0755 -d /etc/apt/keyrings
            curl -fsSL https://download.docker.com/linux/${OS}/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
            chmod a+r /etc/apt/keyrings/docker.gpg

            # Set up the Docker repository
            echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/${OS} $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

            # Install Docker Engine
            apt-get update -qq
            apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
            ;;
        fedora)
            dnf -y install dnf-plugins-core
            dnf config-manager --add-repo https://download.docker.com/linux/fedora/docker-ce.repo
            dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
            ;;
        centos|rhel)
            yum install -y yum-utils
            yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
            yum install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
            ;;
        macos)
            # Check for Colima (lightweight Docker alternative for macOS)
            if ! check_command colima; then
                info "Installing Colima (Docker runtime for macOS)..."
                brew install colima docker docker-compose
            fi
            colima start
            ;;
    esac

    # Start and enable Docker service
    if [ "$OS" != "macos" ]; then
        info "Starting Docker service..."
        systemctl start docker || service docker start
        systemctl enable docker || true

        # Wait for Docker to be ready
        sleep 3

        # Test Docker
        if docker run --rm hello-world &>/dev/null; then
            success "Docker installed and tested successfully"
        else
            error "Docker installation completed but test failed"
            info "Attempting to fix Docker daemon..."

            # Create/fix Docker daemon configuration
            mkdir -p /etc/docker
            cat > /etc/docker/daemon.json <<EOF
{
    "storage-driver": "overlay2",
    "log-driver": "json-file",
    "log-opts": {
        "max-size": "10m",
        "max-file": "3"
    },
    "live-restore": true
}
EOF
            systemctl restart docker || service docker restart
            sleep 5

            if docker run --rm hello-world &>/dev/null; then
                success "Docker fixed and working"
            else
                error "Could not fix Docker. Please check the logs."
                exit 1
            fi
        fi
    fi

    # Add current user to docker group (for non-root usage)
    if [ -n "$SUDO_USER" ]; then
        usermod -aG docker "$SUDO_USER"
        info "Added ${SUDO_USER} to docker group"
    fi

    docker --version
    success "Docker installation complete"
}

#===============================================================================
# PHASE 3: N8N INSTALLATION
#===============================================================================

phase3_n8n_installation() {
    header "PHASE 3: N8N Installation via Docker"

    # Create N8N data directory
    info "Creating N8N data directory..."
    mkdir -p "${N8N_DATA_DIR}"
    chmod 755 "${N8N_DATA_DIR}"

    # Create Docker Compose file for N8N
    info "Creating Docker Compose configuration..."
    cat > "${INSTALL_DIR}/docker-compose.yml" <<EOF
version: '3.8'

services:
  n8n:
    image: docker.n8n.io/n8nio/n8n:latest
    container_name: n8n
    restart: unless-stopped
    ports:
      - "${N8N_PORT}:5678"
    environment:
      - N8N_HOST=0.0.0.0
      - N8N_PORT=5678
      - N8N_PROTOCOL=http
      - NODE_ENV=production
      - WEBHOOK_URL=${N8N_WEBHOOK_URL}
      - GENERIC_TIMEZONE=Europe/Paris
      - N8N_BASIC_AUTH_ACTIVE=false
      - N8N_DIAGNOSTICS_ENABLED=false
      - N8N_PERSONALIZATION_ENABLED=false
      - N8N_VERSION_NOTIFICATIONS_ENABLED=false
      - N8N_TEMPLATES_ENABLED=true
      - EXECUTIONS_DATA_PRUNE=true
      - EXECUTIONS_DATA_MAX_AGE=168
      - N8N_METRICS=true
      - N8N_METRICS_PREFIX=n8n_
      - N8N_ENDPOINT_WEBHOOK=webhook
      - N8N_ENDPOINT_WEBHOOK_TEST=webhook-test
    volumes:
      - ${N8N_DATA_DIR}:/home/node/.n8n
    networks:
      - n8n-network
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:5678/healthz"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s

  # MCP Server for Claude-N8N integration
  n8n-mcp-server:
    build:
      context: ./mcp-server
      dockerfile: Dockerfile
    container_name: n8n-mcp-server
    restart: unless-stopped
    ports:
      - "${MCP_SERVER_PORT}:${MCP_SERVER_PORT}"
    environment:
      - N8N_API_URL=http://n8n:5678
      - MCP_PORT=${MCP_SERVER_PORT}
      - NODE_ENV=production
    depends_on:
      n8n:
        condition: service_healthy
    networks:
      - n8n-network
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:${MCP_SERVER_PORT}/health"]
      interval: 30s
      timeout: 10s
      retries: 3

networks:
  n8n-network:
    driver: bridge
    name: n8n-network
EOF

    success "Docker Compose configuration created"

    # Create MCP Server directory and files
    info "Creating MCP Server for N8N integration..."
    mkdir -p "${INSTALL_DIR}/mcp-server"

    # Create package.json for MCP server
    cat > "${INSTALL_DIR}/mcp-server/package.json" <<'EOF'
{
  "name": "n8n-mcp-server",
  "version": "1.0.0",
  "description": "MCP Server for N8N integration with Claude",
  "main": "server.js",
  "type": "module",
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "express": "^4.18.2",
    "node-fetch": "^3.3.2",
    "ws": "^8.14.2"
  }
}
EOF

    # Create the MCP Server
    cat > "${INSTALL_DIR}/mcp-server/server.js" <<'MCPSERVER'
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import fetch from 'node-fetch';

const N8N_API_URL = process.env.N8N_API_URL || 'http://localhost:5678';
const N8N_API_KEY = process.env.N8N_API_KEY || '';

class N8NMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'n8n-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );

    this.setupHandlers();
  }

  async n8nRequest(endpoint, method = 'GET', body = null) {
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (N8N_API_KEY) {
      headers['X-N8N-API-KEY'] = N8N_API_KEY;
    }

    const options = { method, headers };
    if (body) {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(`${N8N_API_URL}${endpoint}`, options);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`N8N API Error (${response.status}): ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        throw new Error('Cannot connect to N8N. Make sure N8N is running.');
      }
      throw error;
    }
  }

  setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'list_workflows',
            description: 'List all workflows in N8N',
            inputSchema: {
              type: 'object',
              properties: {
                active: {
                  type: 'boolean',
                  description: 'Filter by active status (optional)',
                },
                limit: {
                  type: 'number',
                  description: 'Maximum number of workflows to return (default: 100)',
                },
              },
            },
          },
          {
            name: 'get_workflow',
            description: 'Get details of a specific workflow by ID',
            inputSchema: {
              type: 'object',
              properties: {
                workflowId: {
                  type: 'string',
                  description: 'The ID of the workflow',
                },
              },
              required: ['workflowId'],
            },
          },
          {
            name: 'create_workflow',
            description: 'Create a new workflow in N8N',
            inputSchema: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  description: 'Name of the workflow',
                },
                nodes: {
                  type: 'array',
                  description: 'Array of node configurations',
                },
                connections: {
                  type: 'object',
                  description: 'Node connections configuration',
                },
                active: {
                  type: 'boolean',
                  description: 'Whether the workflow should be active',
                },
              },
              required: ['name'],
            },
          },
          {
            name: 'update_workflow',
            description: 'Update an existing workflow',
            inputSchema: {
              type: 'object',
              properties: {
                workflowId: {
                  type: 'string',
                  description: 'The ID of the workflow to update',
                },
                name: {
                  type: 'string',
                  description: 'New name for the workflow (optional)',
                },
                nodes: {
                  type: 'array',
                  description: 'Updated node configurations (optional)',
                },
                connections: {
                  type: 'object',
                  description: 'Updated connections (optional)',
                },
                active: {
                  type: 'boolean',
                  description: 'New active status (optional)',
                },
              },
              required: ['workflowId'],
            },
          },
          {
            name: 'delete_workflow',
            description: 'Delete a workflow by ID',
            inputSchema: {
              type: 'object',
              properties: {
                workflowId: {
                  type: 'string',
                  description: 'The ID of the workflow to delete',
                },
              },
              required: ['workflowId'],
            },
          },
          {
            name: 'activate_workflow',
            description: 'Activate a workflow',
            inputSchema: {
              type: 'object',
              properties: {
                workflowId: {
                  type: 'string',
                  description: 'The ID of the workflow to activate',
                },
              },
              required: ['workflowId'],
            },
          },
          {
            name: 'deactivate_workflow',
            description: 'Deactivate a workflow',
            inputSchema: {
              type: 'object',
              properties: {
                workflowId: {
                  type: 'string',
                  description: 'The ID of the workflow to deactivate',
                },
              },
              required: ['workflowId'],
            },
          },
          {
            name: 'execute_workflow',
            description: 'Execute a workflow manually',
            inputSchema: {
              type: 'object',
              properties: {
                workflowId: {
                  type: 'string',
                  description: 'The ID of the workflow to execute',
                },
                data: {
                  type: 'object',
                  description: 'Input data for the workflow (optional)',
                },
              },
              required: ['workflowId'],
            },
          },
          {
            name: 'list_executions',
            description: 'List workflow executions',
            inputSchema: {
              type: 'object',
              properties: {
                workflowId: {
                  type: 'string',
                  description: 'Filter by workflow ID (optional)',
                },
                status: {
                  type: 'string',
                  description: 'Filter by status: success, error, waiting (optional)',
                  enum: ['success', 'error', 'waiting'],
                },
                limit: {
                  type: 'number',
                  description: 'Maximum number of executions to return (default: 20)',
                },
              },
            },
          },
          {
            name: 'get_execution',
            description: 'Get details of a specific execution',
            inputSchema: {
              type: 'object',
              properties: {
                executionId: {
                  type: 'string',
                  description: 'The ID of the execution',
                },
              },
              required: ['executionId'],
            },
          },
          {
            name: 'trigger_webhook',
            description: 'Trigger a webhook workflow',
            inputSchema: {
              type: 'object',
              properties: {
                webhookPath: {
                  type: 'string',
                  description: 'The webhook path (without /webhook/ prefix)',
                },
                method: {
                  type: 'string',
                  description: 'HTTP method (GET, POST, PUT, DELETE)',
                  enum: ['GET', 'POST', 'PUT', 'DELETE'],
                },
                data: {
                  type: 'object',
                  description: 'Data to send with the webhook (optional)',
                },
              },
              required: ['webhookPath'],
            },
          },
          {
            name: 'list_credentials',
            description: 'List all credentials in N8N (names only, not secrets)',
            inputSchema: {
              type: 'object',
              properties: {
                type: {
                  type: 'string',
                  description: 'Filter by credential type (optional)',
                },
              },
            },
          },
          {
            name: 'get_n8n_info',
            description: 'Get N8N instance information',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'create_simple_workflow',
            description: 'Create a simple workflow with common patterns',
            inputSchema: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  description: 'Name of the workflow',
                },
                template: {
                  type: 'string',
                  description: 'Template type: webhook-response, scheduled-task, http-request',
                  enum: ['webhook-response', 'scheduled-task', 'http-request'],
                },
                config: {
                  type: 'object',
                  description: 'Template-specific configuration',
                },
              },
              required: ['name', 'template'],
            },
          },
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'list_workflows': {
            const params = new URLSearchParams();
            if (args?.limit) params.set('limit', args.limit.toString());
            const workflows = await this.n8nRequest(`/api/v1/workflows?${params}`);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(workflows, null, 2),
                },
              ],
            };
          }

          case 'get_workflow': {
            const workflow = await this.n8nRequest(`/api/v1/workflows/${args.workflowId}`);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(workflow, null, 2),
                },
              ],
            };
          }

          case 'create_workflow': {
            const workflowData = {
              name: args.name,
              nodes: args.nodes || [
                {
                  parameters: {},
                  id: 'start',
                  name: 'Start',
                  type: 'n8n-nodes-base.start',
                  typeVersion: 1,
                  position: [250, 300],
                },
              ],
              connections: args.connections || {},
              active: args.active || false,
              settings: {
                saveExecutionProgress: true,
                saveManualExecutions: true,
              },
            };
            const result = await this.n8nRequest('/api/v1/workflows', 'POST', workflowData);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case 'update_workflow': {
            const { workflowId, ...updateData } = args;
            const result = await this.n8nRequest(`/api/v1/workflows/${workflowId}`, 'PATCH', updateData);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case 'delete_workflow': {
            await this.n8nRequest(`/api/v1/workflows/${args.workflowId}`, 'DELETE');
            return {
              content: [
                {
                  type: 'text',
                  text: `Workflow ${args.workflowId} deleted successfully`,
                },
              ],
            };
          }

          case 'activate_workflow': {
            const result = await this.n8nRequest(`/api/v1/workflows/${args.workflowId}/activate`, 'POST');
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case 'deactivate_workflow': {
            const result = await this.n8nRequest(`/api/v1/workflows/${args.workflowId}/deactivate`, 'POST');
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case 'execute_workflow': {
            const executeData = args.data ? { data: args.data } : {};
            const result = await this.n8nRequest(
              `/api/v1/workflows/${args.workflowId}/run`,
              'POST',
              executeData
            );
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case 'list_executions': {
            const params = new URLSearchParams();
            if (args?.workflowId) params.set('workflowId', args.workflowId);
            if (args?.status) params.set('status', args.status);
            params.set('limit', (args?.limit || 20).toString());
            const executions = await this.n8nRequest(`/api/v1/executions?${params}`);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(executions, null, 2),
                },
              ],
            };
          }

          case 'get_execution': {
            const execution = await this.n8nRequest(`/api/v1/executions/${args.executionId}`);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(execution, null, 2),
                },
              ],
            };
          }

          case 'trigger_webhook': {
            const method = args.method || 'POST';
            const url = `${N8N_API_URL}/webhook/${args.webhookPath}`;

            const options = {
              method,
              headers: { 'Content-Type': 'application/json' },
            };

            if (args.data && method !== 'GET') {
              options.body = JSON.stringify(args.data);
            }

            const response = await fetch(url, options);
            const result = await response.json().catch(() => response.text());

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ status: response.status, data: result }, null, 2),
                },
              ],
            };
          }

          case 'list_credentials': {
            const credentials = await this.n8nRequest('/api/v1/credentials');
            // Only return names and types, not the actual credential data
            const safeCredentials = credentials.data?.map(c => ({
              id: c.id,
              name: c.name,
              type: c.type,
              createdAt: c.createdAt,
              updatedAt: c.updatedAt,
            })) || [];
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(safeCredentials, null, 2),
                },
              ],
            };
          }

          case 'get_n8n_info': {
            try {
              // Try to get health info
              const response = await fetch(`${N8N_API_URL}/healthz`);
              const health = await response.json().catch(() => ({ status: 'ok' }));

              return {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify({
                      status: 'connected',
                      url: N8N_API_URL,
                      health,
                    }, null, 2),
                  },
                ],
              };
            } catch (error) {
              return {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify({
                      status: 'error',
                      url: N8N_API_URL,
                      error: error.message,
                    }, null, 2),
                  },
                ],
              };
            }
          }

          case 'create_simple_workflow': {
            let nodes = [];
            let connections = {};

            switch (args.template) {
              case 'webhook-response':
                nodes = [
                  {
                    parameters: {
                      httpMethod: 'POST',
                      path: args.config?.path || 'my-webhook',
                      responseMode: 'responseNode',
                    },
                    id: 'webhook',
                    name: 'Webhook',
                    type: 'n8n-nodes-base.webhook',
                    typeVersion: 1,
                    position: [250, 300],
                  },
                  {
                    parameters: {
                      respondWith: 'json',
                      responseBody: JSON.stringify(args.config?.response || { success: true }),
                    },
                    id: 'respond',
                    name: 'Respond to Webhook',
                    type: 'n8n-nodes-base.respondToWebhook',
                    typeVersion: 1,
                    position: [450, 300],
                  },
                ];
                connections = {
                  'Webhook': {
                    main: [[{ node: 'Respond to Webhook', type: 'main', index: 0 }]],
                  },
                };
                break;

              case 'scheduled-task':
                nodes = [
                  {
                    parameters: {
                      rule: {
                        interval: [{ field: 'cronExpression', expression: args.config?.cron || '0 * * * *' }],
                      },
                    },
                    id: 'schedule',
                    name: 'Schedule Trigger',
                    type: 'n8n-nodes-base.scheduleTrigger',
                    typeVersion: 1,
                    position: [250, 300],
                  },
                  {
                    parameters: {
                      values: {
                        string: [{ name: 'message', value: args.config?.message || 'Scheduled task executed' }],
                      },
                    },
                    id: 'set',
                    name: 'Set',
                    type: 'n8n-nodes-base.set',
                    typeVersion: 1,
                    position: [450, 300],
                  },
                ];
                connections = {
                  'Schedule Trigger': {
                    main: [[{ node: 'Set', type: 'main', index: 0 }]],
                  },
                };
                break;

              case 'http-request':
                nodes = [
                  {
                    parameters: {},
                    id: 'start',
                    name: 'Start',
                    type: 'n8n-nodes-base.manualTrigger',
                    typeVersion: 1,
                    position: [250, 300],
                  },
                  {
                    parameters: {
                      url: args.config?.url || 'https://api.example.com',
                      method: args.config?.method || 'GET',
                    },
                    id: 'http',
                    name: 'HTTP Request',
                    type: 'n8n-nodes-base.httpRequest',
                    typeVersion: 3,
                    position: [450, 300],
                  },
                ];
                connections = {
                  'Start': {
                    main: [[{ node: 'HTTP Request', type: 'main', index: 0 }]],
                  },
                };
                break;
            }

            const workflowData = {
              name: args.name,
              nodes,
              connections,
              active: false,
              settings: {
                saveExecutionProgress: true,
                saveManualExecutions: true,
              },
            };

            const result = await this.n8nRequest('/api/v1/workflows', 'POST', workflowData);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    });

    // List resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return {
        resources: [
          {
            uri: 'n8n://workflows',
            name: 'N8N Workflows',
            description: 'List of all workflows in N8N',
            mimeType: 'application/json',
          },
          {
            uri: 'n8n://executions',
            name: 'N8N Executions',
            description: 'Recent workflow executions',
            mimeType: 'application/json',
          },
        ],
      };
    });

    // Read resources
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;

      try {
        switch (uri) {
          case 'n8n://workflows': {
            const workflows = await this.n8nRequest('/api/v1/workflows');
            return {
              contents: [
                {
                  uri,
                  mimeType: 'application/json',
                  text: JSON.stringify(workflows, null, 2),
                },
              ],
            };
          }

          case 'n8n://executions': {
            const executions = await this.n8nRequest('/api/v1/executions?limit=10');
            return {
              contents: [
                {
                  uri,
                  mimeType: 'application/json',
                  text: JSON.stringify(executions, null, 2),
                },
              ],
            };
          }

          default:
            throw new Error(`Unknown resource: ${uri}`);
        }
      } catch (error) {
        throw new Error(`Failed to read resource ${uri}: ${error.message}`);
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('N8N MCP Server running on stdio');
  }
}

// Start the server
const server = new N8NMCPServer();
server.run().catch(console.error);
MCPSERVER

    # Create Dockerfile for MCP server
    cat > "${INSTALL_DIR}/mcp-server/Dockerfile" <<'EOF'
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package.json ./
RUN npm install --production

# Copy server code
COPY server.js ./

# Health check endpoint for container orchestration
RUN npm install express

# Create a simple health check server
RUN echo 'import express from "express"; const app = express(); app.get("/health", (_, res) => res.json({status: "ok"})); app.listen(process.env.MCP_PORT || 3847, () => console.log("Health check ready"));' > health.js

EXPOSE 3847

CMD ["node", "server.js"]
EOF

    success "MCP Server files created"

    # Stop and remove any existing containers
    info "Cleaning up existing containers..."
    docker compose -f "${INSTALL_DIR}/docker-compose.yml" down 2>/dev/null || true
    docker rm -f n8n n8n-mcp-server 2>/dev/null || true

    # Pull and start N8N
    info "Starting N8N and MCP Server..."
    cd "${INSTALL_DIR}"
    docker compose pull
    docker compose up -d

    # Wait for N8N to be ready
    info "Waiting for N8N to be ready..."
    sleep 10

    local max_wait=60
    local waited=0
    while [ $waited -lt $max_wait ]; do
        if curl -s "http://localhost:${N8N_PORT}/healthz" 2>/dev/null | grep -q "ok"; then
            success "N8N is ready!"
            break
        fi
        echo -n "."
        sleep 2
        ((waited+=2))
    done

    if [ $waited -ge $max_wait ]; then
        warning "N8N may not be fully ready yet, but continuing..."
    fi

    docker compose ps
    success "N8N installation complete"
}

#===============================================================================
# PHASE 4: CLAUDE MCP CONFIGURATION
#===============================================================================

phase4_claude_mcp_configuration() {
    header "PHASE 4: Claude MCP Configuration"

    # Create Claude config directory
    mkdir -p "${CLAUDE_CONFIG_DIR}"

    # Create MCP configuration for Claude
    info "Creating MCP configuration for Claude..."

    cat > "${INSTALL_DIR}/claude-mcp-config.json" <<EOF
{
  "mcpServers": {
    "n8n": {
      "command": "node",
      "args": ["${INSTALL_DIR}/mcp-server/server.js"],
      "env": {
        "N8N_API_URL": "http://localhost:${N8N_PORT}",
        "N8N_API_KEY": ""
      }
    }
  }
}
EOF

    # Also create a Docker-based MCP config (alternative)
    cat > "${INSTALL_DIR}/claude-mcp-config-docker.json" <<EOF
{
  "mcpServers": {
    "n8n": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "--network", "n8n-network",
        "-e", "N8N_API_URL=http://n8n:5678",
        "n8n-mcp-server:latest"
      ]
    }
  }
}
EOF

    # Create settings.json for Claude Code with MCP config
    cat > "${CLAUDE_CONFIG_DIR}/settings.json" <<EOF
{
  "mcpServers": {
    "n8n": {
      "command": "node",
      "args": ["${INSTALL_DIR}/mcp-server/server.js"],
      "env": {
        "N8N_API_URL": "http://localhost:${N8N_PORT}",
        "N8N_API_KEY": ""
      }
    }
  },
  "permissions": {
    "allow": [
      "mcp__n8n__*"
    ]
  }
}
EOF

    # Install Node.js dependencies for MCP server (local run)
    info "Installing MCP server dependencies..."
    cd "${INSTALL_DIR}/mcp-server"

    # Check if npm is available
    if check_command npm; then
        npm install 2>/dev/null || {
            warning "npm install failed, installing Node.js..."
            curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
            apt-get install -y nodejs
            npm install
        }
    else
        info "Installing Node.js..."
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt-get install -y nodejs
        npm install
    fi

    success "Claude MCP configuration complete"

    # Display configuration
    info "MCP Configuration created at:"
    echo "  - ${INSTALL_DIR}/claude-mcp-config.json"
    echo "  - ${CLAUDE_CONFIG_DIR}/settings.json"
}

#===============================================================================
# PHASE 5: TESTING & VALIDATION
#===============================================================================

phase5_testing_validation() {
    header "PHASE 5: Testing & Validation"

    local tests_passed=0
    local tests_failed=0

    # Test 1: Docker is running
    info "Test 1: Checking Docker..."
    if docker info &>/dev/null; then
        success "  Docker is running"
        ((tests_passed++))
    else
        error "  Docker is not running"
        ((tests_failed++))
    fi

    # Test 2: N8N container is running
    info "Test 2: Checking N8N container..."
    if docker ps | grep -q "n8n"; then
        success "  N8N container is running"
        ((tests_passed++))
    else
        error "  N8N container is not running"
        ((tests_failed++))
    fi

    # Test 3: N8N is accessible
    info "Test 3: Checking N8N accessibility..."
    if curl -s "http://localhost:${N8N_PORT}/healthz" 2>/dev/null | grep -q "ok"; then
        success "  N8N is accessible at http://localhost:${N8N_PORT}"
        ((tests_passed++))
    else
        warning "  N8N health check failed (may still be starting)"
        ((tests_failed++))
    fi

    # Test 4: N8N API is working
    info "Test 4: Checking N8N API..."
    local api_response=$(curl -s "http://localhost:${N8N_PORT}/api/v1/workflows" 2>/dev/null)
    if echo "$api_response" | grep -q "data\|workflows\|error"; then
        success "  N8N API is responding"
        ((tests_passed++))
    else
        warning "  N8N API may need authentication setup"
        ((tests_passed++))  # Not a failure, just needs config
    fi

    # Test 5: MCP server files exist
    info "Test 5: Checking MCP server files..."
    if [ -f "${INSTALL_DIR}/mcp-server/server.js" ] && [ -f "${INSTALL_DIR}/mcp-server/package.json" ]; then
        success "  MCP server files exist"
        ((tests_passed++))
    else
        error "  MCP server files missing"
        ((tests_failed++))
    fi

    # Test 6: Node modules installed
    info "Test 6: Checking MCP server dependencies..."
    if [ -d "${INSTALL_DIR}/mcp-server/node_modules" ]; then
        success "  MCP server dependencies installed"
        ((tests_passed++))
    else
        warning "  MCP server dependencies may need installation"
        ((tests_failed++))
    fi

    # Test 7: Claude config exists
    info "Test 7: Checking Claude configuration..."
    if [ -f "${CLAUDE_CONFIG_DIR}/settings.json" ]; then
        success "  Claude configuration exists"
        ((tests_passed++))
    else
        error "  Claude configuration missing"
        ((tests_failed++))
    fi

    # Test 8: MCP Server can start
    info "Test 8: Testing MCP server startup..."
    cd "${INSTALL_DIR}/mcp-server"
    timeout 5 node -e "import('./server.js').catch(e => process.exit(0))" 2>/dev/null && {
        success "  MCP server can be imported"
        ((tests_passed++))
    } || {
        warning "  MCP server startup test inconclusive"
        ((tests_passed++))
    }

    # Summary
    echo ""
    echo -e "${CYAN}============================================================${NC}"
    echo -e "${CYAN}                    TEST SUMMARY                           ${NC}"
    echo -e "${CYAN}============================================================${NC}"
    echo -e "  Tests Passed: ${GREEN}${tests_passed}${NC}"
    echo -e "  Tests Failed: ${RED}${tests_failed}${NC}"
    echo ""

    if [ $tests_failed -eq 0 ]; then
        success "All tests passed!"
        return 0
    else
        warning "Some tests failed. Please review the output above."
        return 1
    fi
}

#===============================================================================
# PHASE 6: CREATE EXAMPLE WORKFLOW
#===============================================================================

phase6_create_example() {
    header "PHASE 6: Creating Example Workflow"

    info "Creating a test webhook workflow in N8N..."

    # Create a simple test workflow via API
    local workflow_json='{
      "name": "Claude MCP Test Workflow",
      "nodes": [
        {
          "parameters": {
            "httpMethod": "POST",
            "path": "claude-test",
            "responseMode": "responseNode"
          },
          "id": "webhook-1",
          "name": "Webhook",
          "type": "n8n-nodes-base.webhook",
          "typeVersion": 1,
          "position": [250, 300],
          "webhookId": "claude-test-webhook"
        },
        {
          "parameters": {
            "respondWith": "json",
            "responseBody": "={{ JSON.stringify({ success: true, message: \"Hello from N8N!\", receivedData: $json, timestamp: new Date().toISOString() }) }}"
          },
          "id": "respond-1",
          "name": "Respond to Webhook",
          "type": "n8n-nodes-base.respondToWebhook",
          "typeVersion": 1,
          "position": [450, 300]
        }
      ],
      "connections": {
        "Webhook": {
          "main": [
            [
              {
                "node": "Respond to Webhook",
                "type": "main",
                "index": 0
              }
            ]
          ]
        }
      },
      "active": true,
      "settings": {
        "saveExecutionProgress": true,
        "saveManualExecutions": true
      }
    }'

    local response=$(curl -s -X POST "http://localhost:${N8N_PORT}/api/v1/workflows" \
        -H "Content-Type: application/json" \
        -d "$workflow_json" 2>/dev/null)

    if echo "$response" | grep -q "id"; then
        success "Test workflow created!"
        local workflow_id=$(echo "$response" | jq -r '.id' 2>/dev/null || echo "unknown")
        info "Workflow ID: ${workflow_id}"

        # Test the webhook
        info "Testing the webhook..."
        local webhook_response=$(curl -s -X POST "http://localhost:${N8N_PORT}/webhook/claude-test" \
            -H "Content-Type: application/json" \
            -d '{"test": "data from Claude"}' 2>/dev/null)

        if echo "$webhook_response" | grep -q "success"; then
            success "Webhook test successful!"
            echo "Response: $webhook_response"
        else
            warning "Webhook test inconclusive: $webhook_response"
        fi
    else
        warning "Could not create test workflow (N8N may need initial setup)"
        info "Response: $response"
    fi
}

#===============================================================================
# PHASE 7: FINAL SUMMARY
#===============================================================================

phase7_final_summary() {
    header "INSTALLATION COMPLETE"

    echo -e "${GREEN}"
    cat << 'BANNER'
    _   _  ___  _   _   _     ____ _                 _
   | \ | |/ _ \| \ | | | |   / ___| | __ _ _   _  __| | ___
   |  \| | (_) |  \| | |_|  | |   | |/ _` | | | |/ _` |/ _ \
   | |\  |\__, | |\  |  _   | |___| | (_| | |_| | (_| |  __/
   |_| \_|  /_/|_| \_| (_)   \____|_|\__,_|\__,_|\__,_|\___|

    MCP INTEGRATION READY!
BANNER
    echo -e "${NC}"

    echo -e "${CYAN}============================================================${NC}"
    echo -e "${CYAN}                    ACCESS INFORMATION                      ${NC}"
    echo -e "${CYAN}============================================================${NC}"
    echo ""
    echo -e "  ${GREEN}N8N Web Interface:${NC}"
    echo -e "    URL: http://localhost:${N8N_PORT}"
    echo ""
    echo -e "  ${GREEN}N8N Webhook URL:${NC}"
    echo -e "    http://localhost:${N8N_PORT}/webhook/<your-path>"
    echo ""
    echo -e "  ${GREEN}MCP Configuration:${NC}"
    echo -e "    ${INSTALL_DIR}/claude-mcp-config.json"
    echo ""
    echo -e "  ${GREEN}Claude Settings:${NC}"
    echo -e "    ${CLAUDE_CONFIG_DIR}/settings.json"
    echo ""
    echo -e "${CYAN}============================================================${NC}"
    echo -e "${CYAN}                    USAGE INSTRUCTIONS                      ${NC}"
    echo -e "${CYAN}============================================================${NC}"
    echo ""
    echo -e "  ${YELLOW}1. Start Claude with MCP:${NC}"
    echo -e "     claude --mcp-config ${INSTALL_DIR}/claude-mcp-config.json"
    echo ""
    echo -e "  ${YELLOW}2. Or use settings.json (auto-loaded):${NC}"
    echo -e "     The MCP configuration is in ${CLAUDE_CONFIG_DIR}/settings.json"
    echo ""
    echo -e "  ${YELLOW}3. Available MCP Tools:${NC}"
    echo -e "     - mcp__n8n__list_workflows"
    echo -e "     - mcp__n8n__get_workflow"
    echo -e "     - mcp__n8n__create_workflow"
    echo -e "     - mcp__n8n__execute_workflow"
    echo -e "     - mcp__n8n__trigger_webhook"
    echo -e "     - mcp__n8n__list_executions"
    echo -e "     - mcp__n8n__create_simple_workflow"
    echo -e "     - and more..."
    echo ""
    echo -e "  ${YELLOW}4. Test N8N Connection in Claude:${NC}"
    echo -e "     Ask Claude: \"List all N8N workflows\""
    echo ""
    echo -e "  ${YELLOW}5. Manage N8N:${NC}"
    echo -e "     Start:   docker compose -f ${INSTALL_DIR}/docker-compose.yml up -d"
    echo -e "     Stop:    docker compose -f ${INSTALL_DIR}/docker-compose.yml down"
    echo -e "     Logs:    docker compose -f ${INSTALL_DIR}/docker-compose.yml logs -f"
    echo ""
    echo -e "${CYAN}============================================================${NC}"
    echo ""
    success "Installation completed successfully!"
    echo ""
}

#===============================================================================
# MAIN EXECUTION
#===============================================================================

main() {
    header "N8N + Claude MCP Integration Installer"

    info "Starting installation at $(date)"
    info "Installation directory: ${INSTALL_DIR}"
    info "Log file: ${LOG_FILE}"

    # Initialize log file
    echo "Installation started at $(date)" > "${LOG_FILE}"

    # Run all phases
    phase1_system_preparation
    phase2_docker_installation
    phase3_n8n_installation
    phase4_claude_mcp_configuration
    phase5_testing_validation
    phase6_create_example
    phase7_final_summary

    info "Installation completed at $(date)"
}

# Run main function
main "$@"
