#!/bin/bash
#===============================================================================
# N8N + Claude MCP Integration - NPM Version (No Docker Required)
# Version: 1.0.0
# Description: Installs N8N via npm and configures MCP for Claude integration
#===============================================================================

set -e

#===============================================================================
# CONFIGURATION
#===============================================================================
N8N_PORT=5678
INSTALL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_CONFIG_DIR="${HOME}/.claude"
N8N_DATA_DIR="${HOME}/.n8n"
MCP_SERVER_DIR="${INSTALL_DIR}/mcp-server"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

info() { echo -e "${BLUE}[INFO]${NC} $@"; }
success() { echo -e "${GREEN}[SUCCESS]${NC} $@"; }
warning() { echo -e "${YELLOW}[WARNING]${NC} $@"; }
error() { echo -e "${RED}[ERROR]${NC} $@"; }
header() { echo -e "\n${PURPLE}=== $@ ===${NC}\n"; }

check_command() { command -v "$1" &> /dev/null; }

#===============================================================================
# PHASE 1: INSTALL NODE.JS
#===============================================================================
install_nodejs() {
    header "Installing Node.js"

    if check_command node && check_command npm; then
        local node_version=$(node -v | sed 's/v//' | cut -d. -f1)
        if [ "$node_version" -ge 18 ]; then
            success "Node.js $(node -v) already installed"
            return 0
        fi
    fi

    info "Installing Node.js 20.x..."

    if [ -f /etc/os-release ]; then
        . /etc/os-release
        case $ID in
            ubuntu|debian)
                curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
                apt-get install -y nodejs
                ;;
            fedora|centos|rhel)
                curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
                dnf install -y nodejs || yum install -y nodejs
                ;;
        esac
    elif [ "$(uname)" == "Darwin" ]; then
        brew install node@20
    fi

    success "Node.js $(node -v) installed"
}

#===============================================================================
# PHASE 2: INSTALL N8N
#===============================================================================
install_n8n() {
    header "Installing N8N"

    if check_command n8n; then
        success "N8N already installed: $(n8n --version 2>/dev/null || echo 'version unknown')"
    else
        info "Installing N8N globally via npm..."
        npm install -g n8n
        success "N8N installed"
    fi

    # Create data directory
    mkdir -p "${N8N_DATA_DIR}"

    # Create N8N startup script
    cat > "${INSTALL_DIR}/start-n8n.sh" <<EOF
#!/bin/bash
export N8N_PORT=${N8N_PORT}
export N8N_HOST=0.0.0.0
export N8N_PROTOCOL=http
export GENERIC_TIMEZONE=\${GENERIC_TIMEZONE:-Europe/Paris}
export N8N_BASIC_AUTH_ACTIVE=false
export N8N_DIAGNOSTICS_ENABLED=false
export N8N_METRICS=true
export N8N_USER_FOLDER="${N8N_DATA_DIR}"

echo "Starting N8N on port ${N8N_PORT}..."
echo "Access N8N at: http://localhost:${N8N_PORT}"
n8n start
EOF
    chmod +x "${INSTALL_DIR}/start-n8n.sh"

    success "N8N startup script created"
}

#===============================================================================
# PHASE 3: CREATE MCP SERVER
#===============================================================================
create_mcp_server() {
    header "Creating MCP Server for N8N"

    mkdir -p "${MCP_SERVER_DIR}"

    # Create package.json
    cat > "${MCP_SERVER_DIR}/package.json" <<'EOF'
{
  "name": "n8n-mcp-server",
  "version": "1.0.0",
  "description": "MCP Server for N8N integration with Claude",
  "main": "server.js",
  "type": "module",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "node-fetch": "^3.3.2"
  }
}
EOF

    # Create MCP Server
    cat > "${MCP_SERVER_DIR}/server.js" <<'MCPEOF'
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import fetch from 'node-fetch';

const N8N_URL = process.env.N8N_API_URL || 'http://localhost:5678';
const N8N_API_KEY = process.env.N8N_API_KEY || '';

async function n8nRequest(endpoint, method = 'GET', body = null) {
  const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
  if (N8N_API_KEY) headers['X-N8N-API-KEY'] = N8N_API_KEY;

  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${N8N_URL}${endpoint}`, opts);
  if (!res.ok) throw new Error(`N8N API Error: ${res.status} ${await res.text()}`);
  return res.json();
}

const server = new Server(
  { name: 'n8n-mcp-server', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    { name: 'list_workflows', description: 'List all N8N workflows', inputSchema: { type: 'object', properties: {} } },
    { name: 'get_workflow', description: 'Get workflow by ID', inputSchema: { type: 'object', properties: { workflowId: { type: 'string' } }, required: ['workflowId'] } },
    { name: 'create_workflow', description: 'Create a new workflow', inputSchema: { type: 'object', properties: { name: { type: 'string' }, nodes: { type: 'array' }, connections: { type: 'object' } }, required: ['name'] } },
    { name: 'execute_workflow', description: 'Execute a workflow', inputSchema: { type: 'object', properties: { workflowId: { type: 'string' }, data: { type: 'object' } }, required: ['workflowId'] } },
    { name: 'delete_workflow', description: 'Delete a workflow', inputSchema: { type: 'object', properties: { workflowId: { type: 'string' } }, required: ['workflowId'] } },
    { name: 'activate_workflow', description: 'Activate a workflow', inputSchema: { type: 'object', properties: { workflowId: { type: 'string' } }, required: ['workflowId'] } },
    { name: 'deactivate_workflow', description: 'Deactivate a workflow', inputSchema: { type: 'object', properties: { workflowId: { type: 'string' } }, required: ['workflowId'] } },
    { name: 'list_executions', description: 'List workflow executions', inputSchema: { type: 'object', properties: { workflowId: { type: 'string' }, limit: { type: 'number' } } } },
    { name: 'trigger_webhook', description: 'Trigger a webhook', inputSchema: { type: 'object', properties: { webhookPath: { type: 'string' }, method: { type: 'string' }, data: { type: 'object' } }, required: ['webhookPath'] } },
    { name: 'get_n8n_status', description: 'Check N8N connection status', inputSchema: { type: 'object', properties: {} } },
    { name: 'create_webhook_workflow', description: 'Create a simple webhook workflow', inputSchema: { type: 'object', properties: { name: { type: 'string' }, webhookPath: { type: 'string' }, response: { type: 'object' } }, required: ['name', 'webhookPath'] } },
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let result;
    switch (name) {
      case 'list_workflows':
        result = await n8nRequest('/api/v1/workflows');
        break;
      case 'get_workflow':
        result = await n8nRequest(`/api/v1/workflows/${args.workflowId}`);
        break;
      case 'create_workflow':
        result = await n8nRequest('/api/v1/workflows', 'POST', {
          name: args.name,
          nodes: args.nodes || [{ parameters: {}, id: 'start', name: 'Start', type: 'n8n-nodes-base.manualTrigger', typeVersion: 1, position: [250, 300] }],
          connections: args.connections || {},
          active: false,
          settings: { saveExecutionProgress: true, saveManualExecutions: true }
        });
        break;
      case 'execute_workflow':
        result = await n8nRequest(`/api/v1/workflows/${args.workflowId}/run`, 'POST', args.data ? { data: args.data } : {});
        break;
      case 'delete_workflow':
        await n8nRequest(`/api/v1/workflows/${args.workflowId}`, 'DELETE');
        result = { success: true, message: `Workflow ${args.workflowId} deleted` };
        break;
      case 'activate_workflow':
        result = await n8nRequest(`/api/v1/workflows/${args.workflowId}/activate`, 'POST');
        break;
      case 'deactivate_workflow':
        result = await n8nRequest(`/api/v1/workflows/${args.workflowId}/deactivate`, 'POST');
        break;
      case 'list_executions':
        const params = new URLSearchParams();
        if (args?.workflowId) params.set('workflowId', args.workflowId);
        params.set('limit', (args?.limit || 20).toString());
        result = await n8nRequest(`/api/v1/executions?${params}`);
        break;
      case 'trigger_webhook':
        const method = args.method || 'POST';
        const webhookOpts = { method, headers: { 'Content-Type': 'application/json' } };
        if (args.data && method !== 'GET') webhookOpts.body = JSON.stringify(args.data);
        const webhookRes = await fetch(`${N8N_URL}/webhook/${args.webhookPath}`, webhookOpts);
        result = { status: webhookRes.status, data: await webhookRes.json().catch(() => webhookRes.text()) };
        break;
      case 'get_n8n_status':
        try {
          const healthRes = await fetch(`${N8N_URL}/healthz`);
          result = { status: 'connected', url: N8N_URL, health: await healthRes.json().catch(() => ({ status: 'ok' })) };
        } catch (e) {
          result = { status: 'error', url: N8N_URL, error: e.message };
        }
        break;
      case 'create_webhook_workflow':
        result = await n8nRequest('/api/v1/workflows', 'POST', {
          name: args.name,
          nodes: [
            { parameters: { httpMethod: 'POST', path: args.webhookPath, responseMode: 'responseNode' }, id: 'webhook', name: 'Webhook', type: 'n8n-nodes-base.webhook', typeVersion: 1, position: [250, 300] },
            { parameters: { respondWith: 'json', responseBody: JSON.stringify(args.response || { success: true }) }, id: 'respond', name: 'Respond', type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1, position: [450, 300] }
          ],
          connections: { 'Webhook': { main: [[{ node: 'Respond', type: 'main', index: 0 }]] } },
          active: true,
          settings: { saveExecutionProgress: true, saveManualExecutions: true }
        });
        break;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (error) {
    return { content: [{ type: 'text', text: `Error: ${error.message}` }], isError: true };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error('N8N MCP Server running on stdio');
MCPEOF

    # Install dependencies
    info "Installing MCP server dependencies..."
    cd "${MCP_SERVER_DIR}"
    npm install

    success "MCP Server created"
}

#===============================================================================
# PHASE 4: CONFIGURE CLAUDE
#===============================================================================
configure_claude() {
    header "Configuring Claude MCP"

    mkdir -p "${CLAUDE_CONFIG_DIR}"

    # Create MCP config file
    cat > "${INSTALL_DIR}/claude-mcp-config.json" <<EOF
{
  "mcpServers": {
    "n8n": {
      "command": "node",
      "args": ["${MCP_SERVER_DIR}/server.js"],
      "env": {
        "N8N_API_URL": "http://localhost:${N8N_PORT}",
        "N8N_API_KEY": ""
      }
    }
  }
}
EOF

    # Create Claude settings
    cat > "${CLAUDE_CONFIG_DIR}/settings.json" <<EOF
{
  "mcpServers": {
    "n8n": {
      "command": "node",
      "args": ["${MCP_SERVER_DIR}/server.js"],
      "env": {
        "N8N_API_URL": "http://localhost:${N8N_PORT}",
        "N8N_API_KEY": ""
      }
    }
  },
  "permissions": {
    "allow": ["mcp__n8n__*"]
  }
}
EOF

    success "Claude MCP configuration created"
}

#===============================================================================
# PHASE 5: CREATE MANAGEMENT SCRIPTS
#===============================================================================
create_scripts() {
    header "Creating Management Scripts"

    # Manager script
    cat > "${INSTALL_DIR}/n8n-manager.sh" <<'MANAGER'
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
MANAGER
    chmod +x "${INSTALL_DIR}/n8n-manager.sh"

    success "Management scripts created"
}

#===============================================================================
# PHASE 6: VALIDATION
#===============================================================================
validate() {
    header "Validation"

    local passed=0
    local failed=0

    # Check Node.js
    if check_command node; then
        success "Node.js: $(node -v)"
        ((passed++))
    else
        error "Node.js not found"
        ((failed++))
    fi

    # Check npm
    if check_command npm; then
        success "npm: $(npm -v)"
        ((passed++))
    else
        error "npm not found"
        ((failed++))
    fi

    # Check N8N
    if check_command n8n; then
        success "N8N installed"
        ((passed++))
    else
        error "N8N not found"
        ((failed++))
    fi

    # Check MCP server files
    if [ -f "${MCP_SERVER_DIR}/server.js" ] && [ -d "${MCP_SERVER_DIR}/node_modules" ]; then
        success "MCP server ready"
        ((passed++))
    else
        error "MCP server incomplete"
        ((failed++))
    fi

    # Check Claude config
    if [ -f "${CLAUDE_CONFIG_DIR}/settings.json" ]; then
        success "Claude configuration ready"
        ((passed++))
    else
        error "Claude configuration missing"
        ((failed++))
    fi

    echo ""
    echo -e "${CYAN}Results: ${GREEN}${passed} passed${NC}, ${RED}${failed} failed${NC}"

    return $failed
}

#===============================================================================
# PHASE 7: FINAL SUMMARY
#===============================================================================
show_summary() {
    header "Installation Complete"

    cat <<EOF

${GREEN}╔══════════════════════════════════════════════════════════════╗
║           N8N + Claude MCP Integration Ready!                ║
╚══════════════════════════════════════════════════════════════╝${NC}

${CYAN}QUICK START:${NC}

  1. Start N8N:
     ${YELLOW}${INSTALL_DIR}/n8n-manager.sh start${NC}

  2. Access N8N:
     ${YELLOW}http://localhost:${N8N_PORT}${NC}

  3. Use Claude with MCP:
     ${YELLOW}claude --mcp-config ${INSTALL_DIR}/claude-mcp-config.json${NC}

${CYAN}AVAILABLE MCP TOOLS:${NC}

  - mcp__n8n__list_workflows
  - mcp__n8n__get_workflow
  - mcp__n8n__create_workflow
  - mcp__n8n__execute_workflow
  - mcp__n8n__trigger_webhook
  - mcp__n8n__create_webhook_workflow
  - mcp__n8n__get_n8n_status

${CYAN}MANAGEMENT COMMANDS:${NC}

  Start:   ${INSTALL_DIR}/n8n-manager.sh start
  Stop:    ${INSTALL_DIR}/n8n-manager.sh stop
  Status:  ${INSTALL_DIR}/n8n-manager.sh status
  Logs:    ${INSTALL_DIR}/n8n-manager.sh logs

${CYAN}FILES CREATED:${NC}

  - ${INSTALL_DIR}/n8n-manager.sh
  - ${INSTALL_DIR}/claude-mcp-config.json
  - ${MCP_SERVER_DIR}/server.js
  - ${CLAUDE_CONFIG_DIR}/settings.json

EOF
}

#===============================================================================
# MAIN
#===============================================================================
main() {
    echo -e "${PURPLE}"
    cat <<'BANNER'
    _   _  ___  _   _   ____  _                 _
   | \ | |/ _ \| \ | | / ___|| | __ _ _   _  __| | ___
   |  \| | (_) |  \| | | |   | |/ _` | | | |/ _` |/ _ \
   | |\  |\__, | |\  | | |___| | (_| | |_| | (_| |  __/
   |_| \_|  /_/|_| \_|  \____|_|\__,_|\__,_|\__,_|\___|

         MCP Integration Installer (NPM Version)
BANNER
    echo -e "${NC}"

    install_nodejs
    install_n8n
    create_mcp_server
    configure_claude
    create_scripts
    validate
    show_summary
}

main "$@"
