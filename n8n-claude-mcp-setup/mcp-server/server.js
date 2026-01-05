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
