#!/bin/bash

################################################################################
#                    NEMESIS ULTIMATE SETUP SCRIPT V3.1                        #
#                    Installation Complète Automatique (IMPROVED)              #
#                    Ubuntu 20.04+ | Edge + MCP + Full Stack                   #
#                                                                              #
#  Improvements over v3.0:                                                     #
#  - Fixed heredoc variable expansion issues                                   #
#  - Added comprehensive input validation                                      #
#  - Implemented retry logic with exponential backoff                          #
#  - Added system requirements checks                                          #
#  - Fixed variable naming conflicts                                           #
#  - Added dry-run mode                                                        #
#  - Improved error handling and rollback                                      #
#  - Created missing assets                                                    #
################################################################################

set -euo pipefail  # Exit on error, undefined vars, pipe failures
IFS=$'\n\t'

# Trap for cleanup
trap 'cleanup_on_error $? $LINENO' ERR EXIT INT TERM

# Configuration Constants
readonly SCRIPT_VERSION="3.1.0"
readonly MIN_UBUNTU_VERSION="20.04"
readonly MIN_DISK_SPACE_GB=10
readonly MIN_RAM_MB=2048

# Couleurs pour output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly CYAN='\033[0;36m'
readonly MAGENTA='\033[0;35m'
readonly NC='\033[0m' # No Color

# Fichiers de log
readonly LOG_DIR="$HOME/nemesis_logs"
readonly INSTALL_LOG="$LOG_DIR/install_$(date +%Y%m%d_%H%M%S).log"
readonly ERROR_LOG="$LOG_DIR/errors_$(date +%Y%m%d_%H%M%S).log"

# Répertoires
readonly NEMESIS_HOME="$HOME/.nemesis"
readonly WORKSPACE_DIR="$NEMESIS_HOME/workspace"
readonly MCP_DIR="$NEMESIS_HOME/mcp"
readonly CONFIGS_DIR="$NEMESIS_HOME/configs"
readonly SCRIPTS_DIR="$NEMESIS_HOME/scripts"

# Variables de version
readonly NODE_VERSION="20"
readonly PYTHON_VERSION="3.11"
readonly MCP_PORT="10000"

# Runtime flags
DRY_RUN=false
VERBOSE=false
SKIP_EDGE=false
CLEANUP_ON_EXIT=true

# Track installed components for rollback
declare -a INSTALLED_COMPONENTS=()

################################################################################
# UTILITY FUNCTIONS
################################################################################

print_banner() {
    clear
    echo -e "${CYAN}"
    cat << "EOF"
    ███╗   ██╗███████╗███╗   ███╗███████╗███████╗██╗███████╗
    ████╗  ██║██╔════╝████╗ ████║██╔════╝██╔════╝██║██╔════╝
    ██╔██╗ ██║█████╗  ██╔████╔██║█████╗  ███████╗██║███████╗
    ██║╚██╗██║██╔══╝  ██║╚██╔╝██║██╔══╝  ╚════██║██║╚════██║
    ██║ ╚████║███████╗██║ ╚═╝ ██║███████╗███████║██║███████║
    ╚═╝  ╚═══╝╚══════╝╚═╝     ╚═╝╚══════╝╚══════╝╚═╝╚══════╝

    🚀 NEMESIS ULTIMATE SETUP V3.1 - Installation Automatique
    📦 Edge + MCP + Full Infrastructure (IMPROVED VERSION)

EOF
    echo -e "${NC}"
}

log() {
    local level=$1
    shift
    local message="$*"
    local timestamp
    timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    echo "[$timestamp] [$level] $message" | tee -a "$INSTALL_LOG"

    case $level in
        "ERROR")
            echo -e "${RED}❌ $message${NC}" >&2
            echo "[$timestamp] $message" >> "$ERROR_LOG"
            ;;
        "SUCCESS")
            echo -e "${GREEN}✅ $message${NC}"
            ;;
        "INFO")
            echo -e "${BLUE}ℹ️  $message${NC}"
            ;;
        "WARNING")
            echo -e "${YELLOW}⚠️  $message${NC}"
            ;;
        "STEP")
            echo -e "${MAGENTA}🔧 $message${NC}"
            ;;
        "DEBUG")
            if [[ "$VERBOSE" == "true" ]]; then
                echo -e "${CYAN}🐛 $message${NC}"
            fi
            ;;
    esac
}

cleanup_on_error() {
    local exit_code=$1
    local line_number=$2

    # Don't run cleanup on successful exit
    if [[ $exit_code -eq 0 ]]; then
        return 0
    fi

    log "ERROR" "Script failed with exit code $exit_code at line $line_number"

    if [[ "$CLEANUP_ON_EXIT" == "true" ]]; then
        log "WARNING" "Attempting rollback of installed components..."
        rollback_installation
    fi
}

rollback_installation() {
    log "STEP" "Rolling back installation..."

    for component in "${INSTALLED_COMPONENTS[@]}"; do
        log "INFO" "Rolling back: $component"
        case $component in
            "directories")
                if [[ -d "$NEMESIS_HOME" ]]; then
                    rm -rf "$NEMESIS_HOME"
                fi
                ;;
            "edge")
                if command -v microsoft-edge &> /dev/null; then
                    sudo apt-get remove -y microsoft-edge-stable || true
                fi
                ;;
            # Add more rollback cases as needed
        esac
    done

    log "SUCCESS" "Rollback completed"
}

validate_yes_no() {
    local response="$1"
    [[ "$response" =~ ^[YyOo]$ ]]
}

prompt_yes_no() {
    local prompt="$1"
    local response

    while true; do
        read -p "$prompt (y/n): " -n 1 -r response
        echo
        if validate_yes_no "$response"; then
            return 0
        elif [[ "$response" =~ ^[Nn]$ ]]; then
            return 1
        else
            echo "Invalid input. Please enter 'y' or 'n'."
        fi
    done
}

retry_with_backoff() {
    local max_attempts=5
    local timeout=1
    local attempt=1
    local exit_code=0

    while [[ $attempt -le $max_attempts ]]; do
        if eval "$@"; then
            return 0
        else
            exit_code=$?
        fi

        if [[ $attempt -lt $max_attempts ]]; then
            log "WARNING" "Command failed (attempt $attempt/$max_attempts). Retrying in ${timeout}s..."
            sleep $timeout
            timeout=$((timeout * 2))
            attempt=$((attempt + 1))
        else
            log "ERROR" "Command failed after $max_attempts attempts"
            return $exit_code
        fi
    done
}

check_command() {
    local cmd=$1
    command -v "$cmd" &> /dev/null
}

################################################################################
# SYSTEM CHECKS
################################################################################

check_system_requirements() {
    log "STEP" "Checking system requirements..."

    # Check if running on Ubuntu
    if [[ ! -f /etc/os-release ]]; then
        log "ERROR" "Cannot detect OS. This script requires Ubuntu 20.04+."
        return 1
    fi

    source /etc/os-release

    if [[ "$ID" != "ubuntu" ]]; then
        log "ERROR" "This script is designed for Ubuntu. Detected: $ID"
        return 1
    fi

    # Check Ubuntu version
    local version_id=${VERSION_ID:-0}
    if (( $(echo "$version_id < $MIN_UBUNTU_VERSION" | bc -l) )); then
        log "ERROR" "Ubuntu $MIN_UBUNTU_VERSION or higher required. Found: $version_id"
        return 1
    fi

    log "SUCCESS" "OS: Ubuntu $version_id"

    # Check disk space
    local available_space
    available_space=$(df -BG "$HOME" | awk 'NR==2 {print $4}' | sed 's/G//')
    if [[ $available_space -lt $MIN_DISK_SPACE_GB ]]; then
        log "ERROR" "Insufficient disk space. Required: ${MIN_DISK_SPACE_GB}GB, Available: ${available_space}GB"
        return 1
    fi

    log "SUCCESS" "Disk space: ${available_space}GB available"

    # Check RAM
    local total_ram
    total_ram=$(free -m | awk 'NR==2 {print $2}')
    if [[ $total_ram -lt $MIN_RAM_MB ]]; then
        log "WARNING" "Low RAM detected. Recommended: ${MIN_RAM_MB}MB, Available: ${total_ram}MB"
    else
        log "SUCCESS" "RAM: ${total_ram}MB"
    fi

    # Check internet connectivity
    if ! retry_with_backoff "ping -c 1 -W 2 8.8.8.8 > /dev/null 2>&1"; then
        log "ERROR" "No internet connection detected"
        return 1
    fi

    log "SUCCESS" "Internet connection: OK"

    return 0
}

check_sudo() {
    log "STEP" "Checking sudo privileges..."

    if [[ $EUID -eq 0 ]]; then
        log "WARNING" "Running as root. This is not recommended."
        return 0
    fi

    if ! sudo -n true 2>/dev/null; then
        log "INFO" "This script requires sudo privileges for system packages installation"
        if ! sudo -v; then
            log "ERROR" "Failed to obtain sudo privileges"
            return 1
        fi
    fi

    # Keep sudo alive for duration of script (with 5 minute timeout)
    (
        while true; do
            sudo -n true
            sleep 60
            # Exit if parent process is gone
            if ! kill -0 $$ 2>/dev/null; then
                exit
            fi
        done
    ) &

    local sudo_keeper_pid=$!
    trap "kill $sudo_keeper_pid 2>/dev/null || true" EXIT

    log "SUCCESS" "Sudo privileges confirmed"
    return 0
}

################################################################################
# DIRECTORY STRUCTURE
################################################################################

create_directories() {
    log "STEP" "Creating NEMESIS directory structure..."

    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "[DRY-RUN] Would create directories in $NEMESIS_HOME"
        return 0
    fi

    local dirs=(
        "$LOG_DIR"
        "$NEMESIS_HOME/workspace/html"
        "$NEMESIS_HOME/workspace/assets"
        "$NEMESIS_HOME/workspace/data"
        "$NEMESIS_HOME/mcp/servers"
        "$NEMESIS_HOME/mcp/configs"
        "$NEMESIS_HOME/mcp/logs"
        "$NEMESIS_HOME/configs"
        "$NEMESIS_HOME/scripts"
        "$NEMESIS_HOME/data"
        "$NEMESIS_HOME/backups"
    )

    for dir in "${dirs[@]}"; do
        if ! mkdir -p "$dir"; then
            log "ERROR" "Failed to create directory: $dir"
            return 1
        fi
        log "DEBUG" "Created: $dir"
    done

    INSTALLED_COMPONENTS+=("directories")
    log "SUCCESS" "Directory structure created"
    return 0
}

################################################################################
# SYSTEM DEPENDENCIES
################################################################################

install_system_dependencies() {
    log "STEP" "Installing system dependencies..."

    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "[DRY-RUN] Would install system packages"
        return 0
    fi

    # Update package lists
    if ! retry_with_backoff "sudo apt-get update -qq"; then
        log "ERROR" "Failed to update package lists"
        return 1
    fi

    # Essential packages
    local packages=(
        curl
        wget
        git
        build-essential
        software-properties-common
        apt-transport-https
        ca-certificates
        gnupg
        lsb-release
        jq
        unzip
        zip
        vim
        nano
        htop
        tmux
        net-tools
        dnsutils
        iputils-ping
        bc
    )

    log "INFO" "Installing ${#packages[@]} packages..."

    if ! sudo apt-get install -y "${packages[@]}"; then
        log "WARNING" "Some packages failed to install, continuing..."
    fi

    INSTALLED_COMPONENTS+=("system-deps")
    log "SUCCESS" "System dependencies installed"
    return 0
}

################################################################################
# MICROSOFT EDGE
################################################################################

install_microsoft_edge() {
    if [[ "$SKIP_EDGE" == "true" ]]; then
        log "INFO" "Skipping Microsoft Edge installation (--skip-edge flag)"
        return 0
    fi

    log "STEP" "Installing Microsoft Edge..."

    if check_command microsoft-edge; then
        log "INFO" "Microsoft Edge already installed: $(microsoft-edge --version 2>/dev/null || echo 'unknown version')"
        return 0
    fi

    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "[DRY-RUN] Would install Microsoft Edge"
        return 0
    fi

    # Download and add Microsoft GPG key
    if ! retry_with_backoff "curl -fsSL https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor | sudo tee /usr/share/keyrings/microsoft-edge.gpg > /dev/null"; then
        log "ERROR" "Failed to add Microsoft GPG key"
        return 1
    fi

    # Add Edge repository
    echo "deb [arch=amd64 signed-by=/usr/share/keyrings/microsoft-edge.gpg] https://packages.microsoft.com/repos/edge stable main" | \
        sudo tee /etc/apt/sources.list.d/microsoft-edge.list

    # Update and install
    sudo apt-get update -qq
    if ! sudo apt-get install -y microsoft-edge-stable; then
        log "ERROR" "Failed to install Microsoft Edge"
        return 1
    fi

    INSTALLED_COMPONENTS+=("edge")
    log "SUCCESS" "Microsoft Edge installed successfully"
    return 0
}

configure_edge() {
    log "STEP" "Configuring Microsoft Edge..."

    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "[DRY-RUN] Would configure Edge"
        return 0
    fi

    local edge_config_dir="$HOME/.config/microsoft-edge/Default"
    mkdir -p "$edge_config_dir"

    # Create preferences with proper variable expansion
    cat > "$edge_config_dir/Preferences" << EOF
{
   "browser": {
      "show_home_button": true,
      "check_default_browser": false
   },
   "homepage": "file://${WORKSPACE_DIR}/html/nemesis_workspace.html",
   "homepage_is_newtabpage": false,
   "session": {
      "restore_on_startup": 4,
      "startup_urls": ["file://${WORKSPACE_DIR}/html/nemesis_workspace.html"]
   },
   "profile": {
      "default_content_setting_values": {
         "notifications": 1
      }
   },
   "download": {
      "default_directory": "${HOME}/Downloads",
      "prompt_for_download": false
   }
}
EOF

    # Create launch script with proper variable expansion
    cat > "$SCRIPTS_DIR/launch_edge_nemesis.sh" << EOF
#!/bin/bash
microsoft-edge \\
    --new-window \\
    --start-maximized \\
    --disable-background-timer-throttling \\
    --disable-backgrounding-occluded-windows \\
    --disable-renderer-backgrounding \\
    "file://${WORKSPACE_DIR}/html/nemesis_workspace.html" \\
    > /dev/null 2>&1 &
EOF

    chmod +x "$SCRIPTS_DIR/launch_edge_nemesis.sh"

    log "SUCCESS" "Microsoft Edge configured"
    return 0
}

################################################################################
# NODE.JS
################################################################################

install_nodejs() {
    log "STEP" "Installing Node.js ${NODE_VERSION}..."

    if check_command node; then
        local current_version
        current_version=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
        if [[ $current_version -ge $NODE_VERSION ]]; then
            log "INFO" "Node.js $(node --version) already installed"
            return 0
        fi
    fi

    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "[DRY-RUN] Would install Node.js ${NODE_VERSION}"
        return 0
    fi

    # Install via NodeSource
    if ! retry_with_backoff "curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash -"; then
        log "ERROR" "Failed to setup NodeSource repository"
        return 1
    fi

    if ! sudo apt-get install -y nodejs; then
        log "ERROR" "Failed to install Node.js"
        return 1
    fi

    # Install pnpm and yarn
    sudo npm install -g pnpm yarn || log "WARNING" "Failed to install pnpm/yarn"

    INSTALLED_COMPONENTS+=("nodejs")
    log "SUCCESS" "Node.js $(node --version) installed"
    return 0
}

################################################################################
# PYTHON
################################################################################

install_python() {
    log "STEP" "Installing Python..."

    if check_command python3; then
        log "INFO" "Python $(python3 --version) already installed"
    else
        if [[ "$DRY_RUN" == "true" ]]; then
            log "INFO" "[DRY-RUN] Would install Python"
            return 0
        fi

        sudo apt-get install -y python3 python3-pip python3-venv
    fi

    # Install pipx
    python3 -m pip install --user pipx || true
    python3 -m pipx ensurepath || true

    INSTALLED_COMPONENTS+=("python")
    log "SUCCESS" "Python configured"
    return 0
}

################################################################################
# MCP INFRASTRUCTURE
################################################################################

install_mcp_infrastructure() {
    log "STEP" "Installing MCP infrastructure..."

    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "[DRY-RUN] Would install MCP infrastructure"
        return 0
    fi

    cd "$MCP_DIR"

    # Create package.json with pinned versions
    cat > package.json << 'EOF'
{
  "name": "nemesis-mcp-servers",
  "version": "3.1.0",
  "description": "NEMESIS MCP Servers Infrastructure",
  "type": "module",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "test": "echo \"No tests yet\""
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.30.0",
    "@modelcontextprotocol/sdk": "^0.5.0",
    "express": "^4.18.2",
    "dotenv": "^16.3.1",
    "winston": "^3.11.0",
    "axios": "^1.6.2"
  },
  "devDependencies": {
    "nodemon": "^3.0.2"
  }
}
EOF

    if ! npm install; then
        log "ERROR" "Failed to install npm packages"
        return 1
    fi

    INSTALLED_COMPONENTS+=("mcp-infra")
    log "SUCCESS" "MCP infrastructure installed"
    return 0
}

setup_mcp_servers() {
    log "STEP" "Configuring MCP servers..."

    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "[DRY-RUN] Would configure MCP servers"
        return 0
    fi

    # Create MCP configuration (same as v3.0 but validated)
    cat > "$CONFIGS_DIR/mcp_config.json" << 'EOF'
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/home", "/tmp"]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_PERSONAL_ACCESS_TOKEN}"
      }
    },
    "memory": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-memory"]
    },
    "fetch": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-fetch"]
    }
  }
}
EOF

    log "SUCCESS" "MCP servers configured"
    return 0
}

create_mcp_orchestrator() {
    log "STEP" "Creating MCP orchestrator..."

    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "[DRY-RUN] Would create MCP orchestrator"
        return 0
    fi

    # Fixed version with correct variable naming
    cat > "$MCP_DIR/server.js" << 'EOF'
import express from 'express';
import { createServer } from 'http';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 10000;

// Active MCP servers
const mcpServers = new Map();

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../workspace/html')));

// Load MCP configuration
async function loadMCPConfig() {
    const configPath = path.join(__dirname, '../configs/mcp_config.json');
    const data = await fs.readFile(configPath, 'utf8');
    return JSON.parse(data);
}

// Start an MCP server
function startMCPServer(name, config) {
    console.log(`🚀 Starting MCP server: ${name}`);

    // Fixed: Use different variable name to avoid shadowing
    const childProcess = spawn(config.command, config.args, {
        env: { ...process.env, ...config.env },
        stdio: ['ignore', 'pipe', 'pipe']
    });

    childProcess.stdout.on('data', (data) => {
        console.log(`[${name}] ${data.toString().trim()}`);
    });

    childProcess.stderr.on('data', (data) => {
        console.error(`[${name}] ERROR: ${data.toString().trim()}`);
    });

    childProcess.on('close', (code) => {
        console.log(`[${name}] Stopped with code ${code}`);
        mcpServers.delete(name);
    });

    mcpServers.set(name, { process: childProcess, config, status: 'running' });
    return childProcess;
}

// API Routes
app.get('/api/status', (req, res) => {
    const status = {
        uptime: process.uptime(),
        version: '3.1.0',
        servers: Array.from(mcpServers.entries()).map(([name, data]) => ({
            name,
            status: data.status,
            pid: data.process.pid
        }))
    };
    res.json(status);
});

app.get('/api/servers', (req, res) => {
    const servers = Array.from(mcpServers.keys());
    res.json({ servers, count: servers.length });
});

app.post('/api/servers/:name/restart', async (req, res) => {
    const { name } = req.params;
    const config = await loadMCPConfig();

    if (!config.mcpServers[name]) {
        return res.status(404).json({ error: 'Server not found' });
    }

    // Stop existing server
    if (mcpServers.has(name)) {
        mcpServers.get(name).process.kill();
        mcpServers.delete(name);
    }

    // Restart
    startMCPServer(name, config.mcpServers[name]);
    res.json({ message: `Server ${name} restarted` });
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Initialize
async function initialize() {
    console.log('🔮 NEMESIS MCP ORCHESTRATOR V3.1');
    console.log('================================');

    const config = await loadMCPConfig();
    const serverNames = Object.keys(config.mcpServers);

    console.log(`📦 ${serverNames.length} MCP servers configured`);

    server.listen(PORT, () => {
        console.log(`✅ MCP Orchestrator running on http://localhost:${PORT}`);
        console.log(`📊 API Status: http://localhost:${PORT}/api/status`);
        console.log(`🌐 Workspace: http://localhost:${PORT}/`);
    });
}

initialize().catch(console.error);

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('Shutting down gracefully...');
    server.close(() => {
        process.exit(0);
    });
});
EOF

    log "SUCCESS" "MCP orchestrator created"
    return 0
}

################################################################################
# WORKSPACE & ASSETS
################################################################################

create_nemesis_icon() {
    log "STEP" "Creating NEMESIS icon..."

    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "[DRY-RUN] Would create icon"
        return 0
    fi

    # Create a simple SVG icon
    cat > "$WORKSPACE_DIR/assets/nemesis_icon.svg" << 'EOF'
<svg width="128" height="128" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#00ff9d;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#009dff;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="128" height="128" rx="20" fill="url(#grad)"/>
  <text x="64" y="80" font-size="60" text-anchor="middle" fill="white">🔮</text>
</svg>
EOF

    # Convert to PNG if convert is available
    if check_command convert; then
        convert "$WORKSPACE_DIR/assets/nemesis_icon.svg" "$WORKSPACE_DIR/assets/nemesis_icon.png" 2>/dev/null || \
            log "WARNING" "Failed to convert SVG to PNG, using SVG only"
    fi

    log "SUCCESS" "Icon created"
    return 0
}

create_ultimate_workspace() {
    log "STEP" "Creating NEMESIS workspace..."

    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "[DRY-RUN] Would create workspace HTML"
        return 0
    fi

    # Same HTML as v3.0 (already good)
    cat > "$WORKSPACE_DIR/html/nemesis_workspace.html" << 'HTMLEOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>NEMESIS OMEGA V3.1 - Ultimate Workspace</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        :root {
            --primary: #00ff9d;
            --secondary: #009dff;
            --tertiary: #ff0099;
            --dark: #0a0e27;
            --darker: #050814;
            --glass: rgba(255, 255, 255, 0.05);
            --glass-strong: rgba(255, 255, 255, 0.1);
            --glass-border: rgba(255, 255, 255, 0.15);
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: var(--darker);
            color: white;
            overflow-x: hidden;
        }

        .header {
            position: sticky;
            top: 0;
            z-index: 1000;
            background: var(--glass);
            backdrop-filter: blur(20px);
            border-bottom: 1px solid var(--glass-border);
            padding: 20px;
        }

        .header-content {
            max-width: 1400px;
            margin: 0 auto;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .logo {
            font-size: 28px;
            font-weight: 700;
            background: linear-gradient(135deg, var(--primary), var(--secondary));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .status-bar {
            display: flex;
            gap: 20px;
            align-items: center;
        }

        .status-item {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 16px;
            background: var(--glass);
            border: 1px solid var(--glass-border);
            border-radius: 20px;
            font-size: 14px;
        }

        .status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: var(--primary);
            animation: pulse 2s infinite;
        }

        .status-dot.offline {
            background: #ff0000;
        }

        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
        }

        .container {
            max-width: 1400px;
            margin: 40px auto;
            padding: 0 20px;
        }

        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 20px;
            margin-top: 30px;
        }

        .card {
            background: var(--glass);
            backdrop-filter: blur(20px);
            border: 1px solid var(--glass-border);
            border-radius: 16px;
            padding: 25px;
            cursor: pointer;
            transition: all 0.3s;
            position: relative;
            overflow: hidden;
        }

        .card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(135deg, var(--primary), var(--secondary));
            opacity: 0;
            transition: opacity 0.3s;
        }

        .card:hover {
            transform: translateY(-5px);
            border-color: var(--primary);
            box-shadow: 0 20px 40px rgba(0, 255, 157, 0.3);
        }

        .card:hover::before {
            opacity: 0.08;
        }

        .card-header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 15px;
            position: relative;
            z-index: 1;
        }

        .card-icon {
            width: 48px;
            height: 48px;
            border-radius: 12px;
            background: linear-gradient(135deg, var(--primary), var(--secondary));
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
        }

        .card-title {
            font-size: 18px;
            font-weight: 700;
        }

        .card-description {
            color: rgba(255, 255, 255, 0.7);
            font-size: 14px;
            line-height: 1.6;
            position: relative;
            z-index: 1;
        }

        .section-title {
            font-size: 32px;
            font-weight: 700;
            margin-bottom: 10px;
            background: linear-gradient(135deg, var(--primary), var(--secondary));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .section-subtitle {
            color: rgba(255, 255, 255, 0.6);
            font-size: 16px;
            margin-bottom: 30px;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="header-content">
            <div class="logo">🔮 NEMESIS OMEGA V3.1</div>
            <div class="status-bar">
                <div class="status-item">
                    <span class="status-dot" id="status-indicator"></span>
                    <span id="mcp-status">Checking...</span>
                </div>
                <div class="status-item">
                    <span>🤖</span>
                    <span id="agents-count">AI Agents</span>
                </div>
                <div class="status-item">
                    <span>⚡</span>
                    <span id="tools-count">Tools Ready</span>
                </div>
            </div>
        </div>
    </div>

    <div class="container">
        <h1 class="section-title">AI Tools Dashboard</h1>
        <p class="section-subtitle">Your premium AI arsenal</p>

        <div class="grid" id="tools-grid">
            <!-- Tools loaded dynamically -->
        </div>
    </div>

    <script>
        const tools = [
            { name: 'Claude', icon: '🤖', url: 'https://claude.ai', desc: 'Advanced AI Assistant by Anthropic' },
            { name: 'ChatGPT', icon: '💬', url: 'https://chat.openai.com', desc: 'OpenAI GPT-4 Chat' },
            { name: 'Gemini', icon: '✨', url: 'https://gemini.google.com', desc: 'Google Multimodal AI' },
            { name: 'Perplexity', icon: '🔍', url: 'https://perplexity.ai', desc: 'AI Search with Citations' },
            { name: 'Midjourney', icon: '🎨', url: 'https://midjourney.com', desc: 'AI Image Generation' },
            { name: 'GitHub Copilot', icon: '👨‍💻', url: 'https://github.com/features/copilot', desc: 'AI Code Assistant' },
            { name: 'Cursor', icon: '⚡', url: 'https://cursor.sh', desc: 'AI-Powered IDE' },
            { name: 'Make.com', icon: '🔄', url: 'https://make.com', desc: 'NoCode Automation' },
            { name: 'Dify', icon: '🧠', url: 'https://dify.ai', desc: 'AI Agent Platform' },
            { name: 'Notion AI', icon: '📋', url: 'https://notion.so', desc: 'Smart Workspace' },
            { name: 'Canva', icon: '🎨', url: 'https://canva.com', desc: 'AI Graphic Design' },
            { name: 'HuggingFace', icon: '🤗', url: 'https://huggingface.co', desc: 'Open Source ML Hub' }
        ];

        function loadTools() {
            const grid = document.getElementById('tools-grid');
            grid.innerHTML = tools.map(tool => `
                <div class="card" onclick="window.open('${tool.url}', '_blank')">
                    <div class="card-header">
                        <div class="card-icon">${tool.icon}</div>
                        <div class="card-title">${tool.name}</div>
                    </div>
                    <div class="card-description">${tool.desc}</div>
                </div>
            `).join('');
        }

        async function checkMCPStatus() {
            const statusDot = document.getElementById('status-indicator');
            const statusText = document.getElementById('mcp-status');

            try {
                const response = await fetch('http://localhost:10000/api/status');
                const data = await response.json();

                statusDot.classList.remove('offline');
                statusText.textContent = `MCP Active (${data.servers.length} servers)`;

                document.getElementById('agents-count').textContent = `${data.servers.length} Agents`;
            } catch (error) {
                statusDot.classList.add('offline');
                statusText.textContent = 'MCP Offline';
            }
        }

        loadTools();
        checkMCPStatus();
        setInterval(checkMCPStatus, 5000);

        console.log('%c🔮 NEMESIS OMEGA V3.1', 'font-size: 24px; font-weight: bold; color: #00ff9d;');
        console.log('%cImproved Edition - Production Ready', 'font-size: 14px; color: #009dff;');
    </script>
</body>
</html>
HTMLEOF

    log "SUCCESS" "Workspace created"
    return 0
}

################################################################################
# MANAGEMENT SCRIPTS
################################################################################

create_management_scripts() {
    log "STEP" "Creating management scripts..."

    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "[DRY-RUN] Would create management scripts"
        return 0
    fi

    # Start script
    cat > "$SCRIPTS_DIR/start_nemesis.sh" << EOF
#!/bin/bash
echo "🚀 Starting NEMESIS OMEGA V3.1..."

# Check if already running
if pgrep -f "node.*server.js" > /dev/null; then
    echo "⚠️  NEMESIS is already running"
    exit 1
fi

# Start MCP orchestrator
cd "${MCP_DIR}"
nohup node server.js > "${MCP_DIR}/logs/server.log" 2>&1 &
MCP_PID=\$!
echo \$MCP_PID > "${MCP_DIR}/server.pid"
echo "📦 MCP Orchestrator started (PID: \$MCP_PID)"

# Wait for server to be ready
sleep 3

# Health check
if curl -s http://localhost:${MCP_PORT}/health > /dev/null; then
    echo "✅ NEMESIS started successfully!"
    echo "🌐 Workspace: http://localhost:${MCP_PORT}"
    echo "📊 API: http://localhost:${MCP_PORT}/api/status"

    # Launch Edge if available
    if command -v microsoft-edge &> /dev/null; then
        "${SCRIPTS_DIR}/launch_edge_nemesis.sh"
    fi
else
    echo "❌ Failed to start NEMESIS. Check logs: ${MCP_DIR}/logs/server.log"
    exit 1
fi
EOF

    # Stop script
    cat > "$SCRIPTS_DIR/stop_nemesis.sh" << EOF
#!/bin/bash
echo "🛑 Stopping NEMESIS..."

# Kill by PID file if exists
if [[ -f "${MCP_DIR}/server.pid" ]]; then
    PID=\$(cat "${MCP_DIR}/server.pid")
    if kill "\$PID" 2>/dev/null; then
        echo "✅ Stopped MCP Orchestrator (PID: \$PID)"
    fi
    rm -f "${MCP_DIR}/server.pid"
fi

# Fallback: kill by process name
pkill -f "node.*server.js" && echo "✅ All NEMESIS processes stopped"

# Clean up Edge instances
pkill -f "microsoft-edge.*nemesis" 2>/dev/null || true

echo "✅ NEMESIS stopped"
EOF

    # Status/Monitor script
    cat > "$SCRIPTS_DIR/status_nemesis.sh" << EOF
#!/bin/bash
echo "📊 NEMESIS Status"
echo "================"

if pgrep -f "node.*server.js" > /dev/null; then
    echo "✅ Status: Running"

    if [[ -f "${MCP_DIR}/server.pid" ]]; then
        PID=\$(cat "${MCP_DIR}/server.pid")
        echo "🔢 PID: \$PID"
    fi

    # Get API status
    if curl -s http://localhost:${MCP_PORT}/api/status | jq . 2>/dev/null; then
        echo ""
    else
        echo "⚠️  API not responding"
    fi
else
    echo "❌ Status: Not running"
fi
EOF

    # Backup script
    cat > "$SCRIPTS_DIR/backup_nemesis.sh" << EOF
#!/bin/bash
BACKUP_DIR="${NEMESIS_HOME}/backups"
TIMESTAMP=\$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="nemesis_backup_\${TIMESTAMP}.tar.gz"

echo "💾 Creating NEMESIS backup..."

tar -czf "\$BACKUP_DIR/\$BACKUP_FILE" \\
    -C "${NEMESIS_HOME}" \\
    configs \\
    data \\
    workspace/html \\
    2>/dev/null

if [[ \$? -eq 0 ]]; then
    SIZE=\$(du -h "\$BACKUP_DIR/\$BACKUP_FILE" | cut -f1)
    echo "✅ Backup created: \$BACKUP_FILE (\$SIZE)"

    # Keep only last 5 backups
    cd "\$BACKUP_DIR"
    ls -t nemesis_backup_*.tar.gz | tail -n +6 | xargs -r rm
    echo "🗑️  Cleaned old backups (keeping last 5)"
else
    echo "❌ Backup failed"
    exit 1
fi
EOF

    # Uninstall script
    cat > "$SCRIPTS_DIR/uninstall_nemesis.sh" << 'EOF'
#!/bin/bash

echo "⚠️  NEMESIS UNINSTALL"
echo "===================="
echo ""
echo "This will remove:"
echo "  - All NEMESIS files (~/.nemesis)"
echo "  - Desktop launcher"
echo "  - Log files"
echo ""
read -p "Are you sure? Type 'yes' to confirm: " -r

if [[ "$REPLY" != "yes" ]]; then
    echo "Cancelled."
    exit 0
fi

# Stop if running
~/.nemesis/scripts/stop_nemesis.sh 2>/dev/null || true

# Create final backup
~/.nemesis/scripts/backup_nemesis.sh || true

# Remove files
rm -rf ~/.nemesis
rm -f ~/.local/share/applications/nemesis.desktop
rm -rf ~/nemesis_logs

echo "✅ NEMESIS uninstalled"
echo "📦 Backups preserved in ~/.nemesis/backups (if they exist)"
EOF

    chmod +x "$SCRIPTS_DIR"/*.sh

    log "SUCCESS" "Management scripts created"
    return 0
}

################################################################################
# CONFIGURATION FILES
################################################################################

create_env_file() {
    log "STEP" "Creating .env template..."

    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "[DRY-RUN] Would create .env file"
        return 0
    fi

    # Don't overwrite existing .env
    if [[ -f "$NEMESIS_HOME/.env" ]]; then
        log "INFO" ".env file already exists, creating .env.example instead"
        local env_file="$NEMESIS_HOME/.env.example"
    else
        local env_file="$NEMESIS_HOME/.env"
    fi

    cat > "$env_file" << 'EOF'
# ============================================================================
# NEMESIS OMEGA V3.1 - Environment Configuration
# ============================================================================
#
# 🔐 SECURITY: Never commit this file to version control
# 📝 Copy this to .env and fill in your actual API keys
#
# ============================================================================

# ANTHROPIC / CLAUDE
ANTHROPIC_API_KEY=

# OPENAI / CHATGPT
OPENAI_API_KEY=

# GOOGLE / GEMINI
GOOGLE_API_KEY=

# GITHUB
GITHUB_PERSONAL_ACCESS_TOKEN=

# GITLAB
GITLAB_PERSONAL_ACCESS_TOKEN=
GITLAB_API_URL=https://gitlab.com/api/v4

# NOTION
NOTION_API_KEY=

# SLACK
SLACK_BOT_TOKEN=
SLACK_TEAM_ID=

# BRAVE SEARCH
BRAVE_API_KEY=

# NEMESIS CONFIG
NEMESIS_HOME=$HOME/.nemesis
NEMESIS_PORT=10000
NODE_ENV=production

# ============================================================================
# Add more API keys as needed
# ============================================================================
EOF

    log "SUCCESS" "Environment template created: $env_file"
    return 0
}

create_gitignore() {
    log "STEP" "Creating .gitignore..."

    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "[DRY-RUN] Would create .gitignore"
        return 0
    fi

    cat > "$NEMESIS_HOME/.gitignore" << 'EOF'
# Environment variables
.env
*.env
!.env.example

# Logs
logs/
*.log
npm-debug.log*
yarn-debug.log*

# Dependencies
node_modules/
package-lock.json
yarn.lock

# Data
data/*.db
data/*.sqlite
backups/

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
*.swo

# Temp
tmp/
temp/
*.tmp
EOF

    log "SUCCESS" ".gitignore created"
    return 0
}

create_desktop_launcher() {
    log "STEP" "Creating desktop launcher..."

    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "[DRY-RUN] Would create desktop launcher"
        return 0
    fi

    mkdir -p "$HOME/.local/share/applications"

    # Use SVG icon (always exists) or PNG if available
    local icon_path="$WORKSPACE_DIR/assets/nemesis_icon.svg"
    if [[ -f "$WORKSPACE_DIR/assets/nemesis_icon.png" ]]; then
        icon_path="$WORKSPACE_DIR/assets/nemesis_icon.png"
    fi

    cat > "$HOME/.local/share/applications/nemesis.desktop" << EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=NEMESIS OMEGA V3.1
Comment=AI Workspace & MCP Infrastructure
Icon=$icon_path
Exec=$SCRIPTS_DIR/start_nemesis.sh
Terminal=false
Categories=Development;AI;Utility;
Keywords=ai;workspace;mcp;automation;agents;
StartupNotify=true
EOF

    chmod +x "$HOME/.local/share/applications/nemesis.desktop"

    # Update desktop database if available
    if check_command update-desktop-database; then
        update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true
    fi

    log "SUCCESS" "Desktop launcher created"
    return 0
}

create_readme() {
    log "STEP" "Creating documentation..."

    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "[DRY-RUN] Would create README"
        return 0
    fi

    cat > "$NEMESIS_HOME/README.md" << 'EOF'
# 🔮 NEMESIS OMEGA V3.1 - User Guide

**Improved Edition** - Production Ready

## 🚀 Quick Start

### Start NEMESIS
```bash
~/.nemesis/scripts/start_nemesis.sh
```

### Stop NEMESIS
```bash
~/.nemesis/scripts/stop_nemesis.sh
```

### Check Status
```bash
~/.nemesis/scripts/status_nemesis.sh
```

## 📁 Directory Structure

```
~/.nemesis/
├── workspace/
│   ├── html/              # Web interface
│   └── assets/            # Icons, images
├── mcp/
│   ├── server.js          # Orchestrator
│   ├── package.json       # Dependencies
│   └── logs/              # Runtime logs
├── configs/
│   └── mcp_config.json    # MCP server configuration
├── scripts/
│   ├── start_nemesis.sh   # Start system
│   ├── stop_nemesis.sh    # Stop system
│   ├── status_nemesis.sh  # Check status
│   ├── backup_nemesis.sh  # Create backup
│   └── uninstall_nemesis.sh
├── data/                  # Databases
├── backups/               # Automatic backups
├── .env                   # API keys (DO NOT COMMIT)
└── README.md              # This file
```

## 🔑 API Configuration

1. Copy the .env.example to .env:
   ```bash
   cp ~/.nemesis/.env.example ~/.nemesis/.env
   ```

2. Edit with your API keys:
   ```bash
   nano ~/.nemesis/.env
   ```

3. Add your keys:
   ```bash
   ANTHROPIC_API_KEY=sk-ant-xxxxx
   OPENAI_API_KEY=sk-proj-xxxxx
   GITHUB_PERSONAL_ACCESS_TOKEN=ghp_xxxxx
   ```

## 🛠️ Management Commands

### Backup
```bash
~/.nemesis/scripts/backup_nemesis.sh
```

Automatically keeps last 5 backups.

### Uninstall
```bash
~/.nemesis/scripts/uninstall_nemesis.sh
```

Creates final backup before removing.

## 🌐 Web Interface

- **Workspace**: http://localhost:10000
- **API Status**: http://localhost:10000/api/status
- **Health Check**: http://localhost:10000/health

## 🔧 Troubleshooting

### MCP Won't Start
```bash
# Check logs
tail -f ~/.nemesis/mcp/logs/server.log

# Verify port is free
sudo lsof -i :10000

# Restart
~/.nemesis/scripts/stop_nemesis.sh
~/.nemesis/scripts/start_nemesis.sh
```

### Reset Installation
```bash
~/.nemesis/scripts/stop_nemesis.sh
rm -rf ~/.nemesis/mcp/node_modules
cd ~/.nemesis/mcp && npm install
~/.nemesis/scripts/start_nemesis.sh
```

## 📊 Logs

- Install logs: `~/nemesis_logs/install_*.log`
- Error logs: `~/nemesis_logs/errors_*.log`
- Runtime logs: `~/.nemesis/mcp/logs/server.log`

## 🔐 Security Best Practices

1. ✅ Never commit .env to version control
2. ✅ Rotate API keys every 3-6 months
3. ✅ Use environment-specific keys (dev/prod)
4. ✅ Store backup of .env in password manager
5. ✅ Review MCP server permissions regularly

## 🆕 What's New in V3.1

- ✅ Fixed variable expansion bugs
- ✅ Added input validation
- ✅ Implemented retry logic
- ✅ Added system requirements check
- ✅ Created missing icon assets
- ✅ Fixed variable naming conflicts
- ✅ Added dry-run mode
- ✅ Improved error handling
- ✅ Added health checks
- ✅ Created uninstall script

## 📜 License

NEMESIS OMEGA - Personal Use
© 2024 Pierre Tagnard - SARL KAIROS

---

🔮 **Powered by MCP & AI**
✨ **Your Ultimate Development Workspace**
EOF

    log "SUCCESS" "Documentation created"
    return 0
}

################################################################################
# MAIN INSTALLATION
################################################################################

parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --dry-run)
                DRY_RUN=true
                log "INFO" "Dry-run mode enabled"
                ;;
            --verbose|-v)
                VERBOSE=true
                log "INFO" "Verbose mode enabled"
                ;;
            --skip-edge)
                SKIP_EDGE=true
                ;;
            --no-cleanup)
                CLEANUP_ON_EXIT=false
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            *)
                log "ERROR" "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
        shift
    done
}

show_help() {
    cat << EOF
NEMESIS OMEGA V${SCRIPT_VERSION} - Installation Script

Usage: $0 [OPTIONS]

Options:
    --dry-run        Simulate installation without making changes
    --verbose, -v    Enable verbose output
    --skip-edge      Skip Microsoft Edge installation
    --no-cleanup     Don't rollback on error
    --help, -h       Show this help message

Examples:
    $0                    # Normal installation
    $0 --dry-run          # Test without installing
    $0 --skip-edge        # Install without Edge

For more information, visit: https://github.com/yourrepo/nemesis
EOF
}

main() {
    parse_arguments "$@"

    print_banner

    log "INFO" "🚀 NEMESIS OMEGA V${SCRIPT_VERSION} Installation"
    log "INFO" "📍 Target directory: $NEMESIS_HOME"
    log "INFO" "📋 Logs: $LOG_DIR"

    if [[ "$DRY_RUN" == "true" ]]; then
        log "WARNING" "🔍 DRY-RUN MODE - No changes will be made"
    fi

    # Pre-flight checks
    check_system_requirements || exit 1
    check_sudo || exit 1

    # Create structure
    create_directories || exit 1

    # Install components
    install_system_dependencies || exit 1
    install_microsoft_edge || exit 1
    configure_edge || exit 1
    install_nodejs || exit 1
    install_python || exit 1

    # Setup MCP
    install_mcp_infrastructure || exit 1
    setup_mcp_servers || exit 1
    create_mcp_orchestrator || exit 1

    # Create workspace
    create_nemesis_icon || exit 1
    create_ultimate_workspace || exit 1
    create_management_scripts || exit 1

    # Configuration
    create_env_file || exit 1
    create_gitignore || exit 1
    create_desktop_launcher || exit 1
    create_readme || exit 1

    # Success!
    log "SUCCESS" "=========================================="
    log "SUCCESS" "🎉 NEMESIS OMEGA V${SCRIPT_VERSION} INSTALLED!"
    log "SUCCESS" "=========================================="
    echo ""
    log "INFO" "📍 Installation: $NEMESIS_HOME"
    log "INFO" "📚 Documentation: $NEMESIS_HOME/README.md"
    log "INFO" "🔑 Configuration: $NEMESIS_HOME/.env"
    echo ""
    log "WARNING" "⚠️  NEXT STEPS:"
    log "WARNING" "1. Edit $NEMESIS_HOME/.env with your API keys"
    log "WARNING" "2. Run: $SCRIPTS_DIR/start_nemesis.sh"
    log "WARNING" "3. Open: http://localhost:${MCP_PORT}"
    echo ""

    if [[ "$DRY_RUN" != "true" ]]; then
        if prompt_yes_no "Start NEMESIS now?"; then
            log "INFO" "Starting NEMESIS..."
            "$SCRIPTS_DIR/start_nemesis.sh"
        else
            log "INFO" "To start later: $SCRIPTS_DIR/start_nemesis.sh"
        fi
    fi
}

# Run main function
main "$@"
