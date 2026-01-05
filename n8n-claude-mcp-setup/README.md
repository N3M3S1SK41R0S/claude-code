# N8N + Claude MCP Integration

Complete solution to integrate N8N workflow automation with Claude via MCP (Model Context Protocol).

## Quick Installation

### Option 1: NPM Installation (Recommended)

```bash
cd /home/user/claude-code/n8n-claude-mcp-setup
chmod +x install-n8n-npm.sh
./install-n8n-npm.sh
```

### Option 2: Docker Installation (Requires Docker)

```bash
cd /home/user/claude-code/n8n-claude-mcp-setup
chmod +x install-n8n-claude-mcp.sh
sudo ./install-n8n-claude-mcp.sh
```

## Starting N8N

```bash
./n8n-manager.sh start
```

Access N8N at: http://localhost:5678

## Using with Claude

### Method 1: Via Command Line

```bash
claude --mcp-config /home/user/claude-code/n8n-claude-mcp-setup/claude-mcp-config.json
```

### Method 2: Via Settings (Auto-loaded)

The MCP configuration is automatically added to `~/.claude/settings.json`.

## Available MCP Tools

| Tool | Description |
|------|-------------|
| `mcp__n8n__list_workflows` | List all workflows |
| `mcp__n8n__get_workflow` | Get workflow details by ID |
| `mcp__n8n__create_workflow` | Create a new workflow |
| `mcp__n8n__update_workflow` | Update an existing workflow |
| `mcp__n8n__delete_workflow` | Delete a workflow |
| `mcp__n8n__activate_workflow` | Activate a workflow |
| `mcp__n8n__deactivate_workflow` | Deactivate a workflow |
| `mcp__n8n__execute_workflow` | Execute a workflow |
| `mcp__n8n__list_executions` | List workflow executions |
| `mcp__n8n__trigger_webhook` | Trigger a webhook |
| `mcp__n8n__create_webhook_workflow` | Create a simple webhook workflow |
| `mcp__n8n__get_n8n_status` | Check N8N connection status |

## Configuration

### N8N API Key (Optional)

For production use, generate an API key in N8N:
1. Go to N8N Settings
2. Navigate to API Keys
3. Generate a new key
4. Update the configuration:

```bash
# Edit ~/.claude/settings.json or claude-mcp-config.json
"env": {
  "N8N_API_URL": "http://localhost:5678",
  "N8N_API_KEY": "your-api-key-here"
}
```

### Disable API Authentication (Development Only)

For testing, you can disable API authentication by setting environment variable:

```bash
export N8N_PUBLIC_API_DISABLED=false
```

## Management Commands

```bash
# Start N8N
./n8n-manager.sh start

# Stop N8N
./n8n-manager.sh stop

# Check status
./n8n-manager.sh status

# View logs
./n8n-manager.sh logs

# Run tests
./n8n-manager.sh test
```

## File Structure

```
n8n-claude-mcp-setup/
├── install-n8n-npm.sh          # NPM-based installation
├── install-n8n-claude-mcp.sh   # Docker-based installation
├── quick-start.sh              # Quick management commands
├── n8n-manager.sh              # N8N service manager
├── start-n8n.sh                # Direct N8N starter
├── claude-mcp-config.json      # Claude MCP configuration
├── docker-compose.yml          # Docker setup (if using Docker)
├── mcp-server/
│   ├── server.js               # MCP server implementation
│   ├── package.json            # Dependencies
│   └── node_modules/           # Installed packages
└── README.md                   # This file
```

## Example Usage with Claude

Once configured, you can ask Claude:

- "List all N8N workflows"
- "Create a webhook workflow named 'my-api' that responds with { success: true }"
- "Execute workflow with ID abc123"
- "What's the status of N8N?"

## Troubleshooting

### N8N won't start
```bash
# Check logs
./n8n-manager.sh logs

# Restart
./n8n-manager.sh stop
./n8n-manager.sh start
```

### MCP connection fails
```bash
# Test MCP server
cd mcp-server && node server.js

# Check N8N is running
curl http://localhost:5678/healthz
```

### API authentication required
Generate an API key in N8N UI (Settings > API) and update your configuration.

## License

MIT
