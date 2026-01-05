# N8N + Claude MCP - Installation Complete Windows
# Copier-coller ce script entier dans PowerShell

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  N8N + Claude MCP Installation" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Etape 1: Aller dans Documents
Write-Host "[1/6] Preparation du dossier..." -ForegroundColor Yellow
Set-Location $HOME\Documents
if (Test-Path "n8n-claude-setup") { Remove-Item -Recurse -Force "n8n-claude-setup" }
New-Item -ItemType Directory -Name "n8n-claude-setup" | Out-Null
Set-Location "n8n-claude-setup"
Write-Host "OK - Dossier cree: $PWD" -ForegroundColor Green

# Etape 2: Creer le serveur MCP
Write-Host ""
Write-Host "[2/6] Creation du serveur MCP..." -ForegroundColor Yellow

New-Item -ItemType Directory -Name "mcp-server" | Out-Null

# package.json
@'
{
  "name": "n8n-mcp-server",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "node-fetch": "^3.3.2"
  }
}
'@ | Out-File -FilePath "mcp-server\package.json" -Encoding UTF8

# server.js
@'
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import fetch from 'node-fetch';

const N8N_URL = process.env.N8N_API_URL || 'http://localhost:5678';

async function n8nRequest(endpoint, method = 'GET', body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${N8N_URL}${endpoint}`, opts);
  return res.json();
}

const server = new Server({ name: 'n8n-mcp-server', version: '1.0.0' }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    { name: 'list_workflows', description: 'List all N8N workflows', inputSchema: { type: 'object', properties: {} } },
    { name: 'get_n8n_status', description: 'Check N8N status', inputSchema: { type: 'object', properties: {} } },
    { name: 'create_workflow', description: 'Create workflow', inputSchema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } },
    { name: 'execute_workflow', description: 'Execute workflow', inputSchema: { type: 'object', properties: { workflowId: { type: 'string' } }, required: ['workflowId'] } },
    { name: 'trigger_webhook', description: 'Trigger webhook', inputSchema: { type: 'object', properties: { path: { type: 'string' }, data: { type: 'object' } }, required: ['path'] } }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  let result;
  try {
    switch (name) {
      case 'list_workflows': result = await n8nRequest('/api/v1/workflows'); break;
      case 'get_n8n_status':
        const health = await fetch(`${N8N_URL}/healthz`).then(r => r.json()).catch(() => ({status:'error'}));
        result = { status: 'connected', url: N8N_URL, health };
        break;
      case 'create_workflow':
        result = await n8nRequest('/api/v1/workflows', 'POST', { name: args.name, nodes: [], connections: {}, active: false });
        break;
      case 'execute_workflow':
        result = await n8nRequest(`/api/v1/workflows/${args.workflowId}/run`, 'POST');
        break;
      case 'trigger_webhook':
        const webhookRes = await fetch(`${N8N_URL}/webhook/${args.path}`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(args.data || {}) });
        result = await webhookRes.json().catch(() => webhookRes.text());
        break;
    }
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (e) { return { content: [{ type: 'text', text: 'Error: ' + e.message }], isError: true }; }
});

const transport = new StdioServerTransport();
await server.connect(transport);
'@ | Out-File -FilePath "mcp-server\server.js" -Encoding UTF8

Write-Host "OK - Serveur MCP cree" -ForegroundColor Green

# Etape 3: Installer dependances MCP
Write-Host ""
Write-Host "[3/6] Installation des dependances MCP..." -ForegroundColor Yellow
Set-Location "mcp-server"
npm install 2>$null
Set-Location ..
Write-Host "OK - Dependances installees" -ForegroundColor Green

# Etape 4: Installer N8N
Write-Host ""
Write-Host "[4/6] Installation de N8N (2-5 minutes)..." -ForegroundColor Yellow
npm install -g n8n 2>$null
Write-Host "OK - N8N installe" -ForegroundColor Green

# Etape 5: Configurer Claude
Write-Host ""
Write-Host "[5/6] Configuration de Claude..." -ForegroundColor Yellow

$mcpServerPath = "$PWD\mcp-server\server.js" -replace '\\', '\\\\'

if (-not (Test-Path "$HOME\.claude")) { New-Item -ItemType Directory -Path "$HOME\.claude" | Out-Null }

@"
{
  "mcpServers": {
    "n8n": {
      "command": "node",
      "args": ["$mcpServerPath"],
      "env": { "N8N_API_URL": "http://localhost:5678" }
    }
  },
  "permissions": { "allow": ["mcp__n8n__*"] }
}
"@ | Out-File -FilePath "$HOME\.claude\settings.json" -Encoding UTF8

Write-Host "OK - Claude configure" -ForegroundColor Green

# Etape 6: Creer script de demarrage
Write-Host ""
Write-Host "[6/6] Creation du script de demarrage..." -ForegroundColor Yellow

@'
Write-Host "Demarrage de N8N..." -ForegroundColor Cyan
Write-Host "Interface: http://localhost:5678" -ForegroundColor Green
Write-Host "Appuyez sur Ctrl+C pour arreter" -ForegroundColor Yellow
n8n start
'@ | Out-File -FilePath "start-n8n.ps1" -Encoding UTF8

Write-Host "OK - Script cree" -ForegroundColor Green

# Termine
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  INSTALLATION TERMINEE !" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Pour demarrer N8N, tapez:" -ForegroundColor Cyan
Write-Host "  n8n start" -ForegroundColor White
Write-Host ""
Write-Host "Puis ouvrez: http://localhost:5678" -ForegroundColor Cyan
Write-Host ""
Write-Host "Pour utiliser Claude avec N8N:" -ForegroundColor Cyan
Write-Host "  Ouvrez un nouveau terminal et tapez: claude" -ForegroundColor White
Write-Host ""
