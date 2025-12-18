#!/usr/bin/env node
/**
 * NEMESIS Hub - Automated Workflow Test Suite
 * Tests all 39 n8n workflows via their webhook endpoints
 *
 * Usage: node test-all-workflows.js [--verbose] [--filter=workflow-name]
 */

const http = require('http');
const https = require('https');

// Configuration
const CONFIG = {
  n8n_base_url: process.env.N8N_URL || 'http://localhost:5678',
  webhook_path: '/webhook',
  timeout_ms: 30000,
  verbose: process.argv.includes('--verbose') || process.argv.includes('-v'),
  filter: process.argv.find(a => a.startsWith('--filter='))?.split('=')[1] || null
};

// Test definitions for each workflow
const WORKFLOW_TESTS = [
  // ============ CORE INFRASTRUCTURE ============
  {
    name: 'NEMESIS Hub Master',
    webhook: 'nemesis-hub',
    payload: { action: 'status' },
    expect: { field: 'status', notEmpty: true }
  },
  {
    name: 'Connection Validator',
    webhook: 'connection-validator',
    payload: { action: 'check', targets: ['n8n'] },
    expect: { field: 'results', notEmpty: true }
  },
  {
    name: 'Error Handler',
    webhook: 'error-handler',
    payload: { error: 'Test error', source: 'test-suite' },
    expect: { field: 'logged', value: true }
  },
  {
    name: 'Webhook Relay',
    webhook: 'webhook-relay',
    payload: { target: 'echo', data: { test: true } },
    expect: { field: 'relayed', notEmpty: true }
  },
  {
    name: 'Queue Manager',
    webhook: 'queue-manager',
    payload: { action: 'status' },
    expect: { field: 'queue_status', notEmpty: true }
  },
  {
    name: 'Backup System',
    webhook: 'backup',
    payload: { type: 'test' },
    expect: { field: 'backup_id', notEmpty: true }
  },
  {
    name: 'ETL Pipeline',
    webhook: 'etl-pipeline',
    payload: { action: 'transform', data: [{ a: 1 }] },
    expect: { field: 'transformed', notEmpty: true }
  },
  {
    name: 'Orchestrator',
    webhook: 'orchestrator',
    payload: { command: 'status' },
    expect: { field: 'hub_status', notEmpty: true }
  },
  {
    name: 'Dashboard',
    webhook: 'dashboard',
    payload: { action: 'summary' },
    expect: { field: 'summary', notEmpty: true }
  },

  // ============ AI & CONTENT ============
  {
    name: 'Multi-AI Gateway',
    webhook: 'ai-gateway',
    payload: { provider: 'test', prompt: 'Hello', action: 'validate' },
    expect: { field: 'request_id', notEmpty: true }
  },
  {
    name: 'AI Content Pipeline',
    webhook: 'ai-content',
    payload: { topic: 'Test Topic', type: 'test' },
    expect: { field: 'request_id', notEmpty: true }
  },
  {
    name: 'Translation Service',
    webhook: 'translation',
    payload: { text: 'Hello', target_lang: 'fr' },
    expect: { field: 'request_id', notEmpty: true }
  },

  // ============ PLATFORM CONNECTORS ============
  {
    name: 'Google AI Studio',
    webhook: 'google-ai-studio',
    payload: { action: 'validate', prompt: 'test' },
    expect: { field: 'request_id', notEmpty: true }
  },
  {
    name: 'Notion Sync',
    webhook: 'notion-sync',
    payload: { action: 'status' },
    expect: { field: 'request_id', notEmpty: true }
  },
  {
    name: 'GitHub Integration',
    webhook: 'github',
    payload: { action: 'status' },
    expect: { field: 'request_id', notEmpty: true }
  },
  {
    name: 'Discord Webhooks',
    webhook: 'discord',
    payload: { action: 'validate', channel_id: 'test' },
    expect: { field: 'request_id', notEmpty: true }
  },
  {
    name: 'Telegram Bot',
    webhook: 'telegram-bot',
    payload: { action: 'status' },
    expect: { field: 'request_id', notEmpty: true }
  },
  {
    name: 'WhatsApp (Twilio)',
    webhook: 'whatsapp',
    payload: { action: 'validate', to: '+1234567890' },
    expect: { field: 'request_id', notEmpty: true }
  },
  {
    name: 'YouTube Automation',
    webhook: 'youtube',
    payload: { action: 'validate' },
    expect: { field: 'request_id', notEmpty: true }
  },
  {
    name: 'Midjourney (GoAPI)',
    webhook: 'midjourney',
    payload: { action: 'validate', prompt: 'test' },
    expect: { field: 'request_id', notEmpty: true }
  },
  {
    name: 'HeyGen Video',
    webhook: 'heygen',
    payload: { action: 'status' },
    expect: { field: 'request_id', notEmpty: true }
  },
  {
    name: 'Stability AI',
    webhook: 'stability-ai',
    payload: { action: 'validate' },
    expect: { field: 'request_id', notEmpty: true }
  },
  {
    name: 'ElevenLabs Voice',
    webhook: 'elevenlabs',
    payload: { action: 'voices' },
    expect: { field: 'request_id', notEmpty: true }
  },
  {
    name: 'Bubble Connector',
    webhook: 'bubble',
    payload: { action: 'status' },
    expect: { field: 'request_id', notEmpty: true }
  },
  {
    name: 'Make/Zapier Bridge',
    webhook: 'make-zapier',
    payload: { action: 'status' },
    expect: { field: 'request_id', notEmpty: true }
  },

  // ============ DATA & DATABASE ============
  {
    name: 'Google Sheets Sync',
    webhook: 'google-sheets',
    payload: { action: 'validate' },
    expect: { field: 'request_id', notEmpty: true }
  },
  {
    name: 'Google Calendar',
    webhook: 'google-calendar',
    payload: { action: 'validate' },
    expect: { field: 'request_id', notEmpty: true }
  },
  {
    name: 'MongoDB/PostgreSQL',
    webhook: 'database',
    payload: { action: 'validate', database: 'test' },
    expect: { field: 'request_id', notEmpty: true }
  },
  {
    name: 'Airtable Sync',
    webhook: 'airtable-sync',
    payload: { action: 'status' },
    expect: { field: 'request_id', notEmpty: true }
  },
  {
    name: 'PDF Processing',
    webhook: 'pdf-processing',
    payload: { action: 'validate' },
    expect: { field: 'request_id', notEmpty: true }
  },
  {
    name: 'Web Scraper',
    webhook: 'web-scraper',
    payload: { url: 'https://example.com', method: 'validate' },
    expect: { field: 'request_id', notEmpty: true }
  },

  // ============ COMMERCE & CRM ============
  {
    name: 'Stripe Payments',
    webhook: 'stripe',
    payload: { action: 'status' },
    expect: { field: 'request_id', notEmpty: true }
  },
  {
    name: 'Shopify E-commerce',
    webhook: 'shopify',
    payload: { action: 'validate' },
    expect: { field: 'request_id', notEmpty: true }
  },
  {
    name: 'HubSpot CRM',
    webhook: 'hubspot-crm',
    payload: { action: 'validate' },
    expect: { field: 'request_id', notEmpty: true }
  },

  // ============ COMMUNICATION ============
  {
    name: 'Email Automation',
    webhook: 'email',
    payload: { action: 'validate' },
    expect: { field: 'request_id', notEmpty: true }
  },
  {
    name: 'Twilio SMS',
    webhook: 'twilio-sms',
    payload: { action: 'validate' },
    expect: { field: 'request_id', notEmpty: true }
  },
  {
    name: 'Team Notifications',
    webhook: 'notifications',
    payload: { content: 'Test notification', type: 'test' },
    expect: { field: 'id', notEmpty: true }
  },
  {
    name: 'Universal API Router',
    webhook: 'api-router',
    payload: { target: 'test', action: 'validate' },
    expect: { field: 'request_id', notEmpty: true }
  }
];

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m'
};

// Helper: Make HTTP request
function makeRequest(url, payload) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;
    const data = JSON.stringify(payload);

    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      },
      timeout: CONFIG.timeout_ms
    };

    const req = client.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, data: body, parseError: true });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.write(data);
    req.end();
  });
}

// Helper: Validate response
function validateResponse(response, expect) {
  if (!response.data) return { valid: false, reason: 'No response data' };

  if (expect.field) {
    const value = response.data[expect.field];
    if (expect.notEmpty && !value) {
      return { valid: false, reason: `Field '${expect.field}' is empty` };
    }
    if (expect.value !== undefined && value !== expect.value) {
      return { valid: false, reason: `Field '${expect.field}' expected ${expect.value}, got ${value}` };
    }
  }

  return { valid: true };
}

// Run single test
async function runTest(test) {
  const url = `${CONFIG.n8n_base_url}${CONFIG.webhook_path}/${test.webhook}`;
  const startTime = Date.now();

  try {
    const response = await makeRequest(url, test.payload);
    const duration = Date.now() - startTime;
    const validation = validateResponse(response, test.expect);

    return {
      name: test.name,
      webhook: test.webhook,
      success: response.status >= 200 && response.status < 300 && validation.valid,
      status: response.status,
      duration,
      error: validation.valid ? null : validation.reason,
      response: CONFIG.verbose ? response.data : undefined
    };
  } catch (error) {
    return {
      name: test.name,
      webhook: test.webhook,
      success: false,
      duration: Date.now() - startTime,
      error: error.message
    };
  }
}

// Print results
function printResult(result) {
  const icon = result.success ? `${colors.green}✓${colors.reset}` : `${colors.red}✗${colors.reset}`;
  const duration = `${colors.dim}${result.duration}ms${colors.reset}`;
  const status = result.status ? `[${result.status}]` : '';

  console.log(`  ${icon} ${result.name} ${status} ${duration}`);

  if (!result.success && result.error) {
    console.log(`    ${colors.red}└─ ${result.error}${colors.reset}`);
  }

  if (CONFIG.verbose && result.response) {
    console.log(`    ${colors.dim}└─ Response: ${JSON.stringify(result.response).substring(0, 100)}...${colors.reset}`);
  }
}

// Main execution
async function main() {
  console.log(`\n${colors.cyan}╔════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.cyan}║     NEMESIS Hub - Workflow Test Suite              ║${colors.reset}`);
  console.log(`${colors.cyan}╚════════════════════════════════════════════════════╝${colors.reset}\n`);

  console.log(`${colors.blue}Configuration:${colors.reset}`);
  console.log(`  n8n URL: ${CONFIG.n8n_base_url}`);
  console.log(`  Timeout: ${CONFIG.timeout_ms}ms`);
  console.log(`  Verbose: ${CONFIG.verbose}`);
  if (CONFIG.filter) console.log(`  Filter: ${CONFIG.filter}`);
  console.log('');

  // Filter tests if needed
  let tests = WORKFLOW_TESTS;
  if (CONFIG.filter) {
    tests = tests.filter(t =>
      t.name.toLowerCase().includes(CONFIG.filter.toLowerCase()) ||
      t.webhook.toLowerCase().includes(CONFIG.filter.toLowerCase())
    );
  }

  console.log(`${colors.blue}Running ${tests.length} tests...${colors.reset}\n`);

  const results = [];
  const categories = {
    'Core Infrastructure': [],
    'AI & Content': [],
    'Platform Connectors': [],
    'Data & Database': [],
    'Commerce & CRM': [],
    'Communication': []
  };

  // Run tests sequentially
  for (const test of tests) {
    const result = await runTest(test);
    results.push(result);
    printResult(result);
  }

  // Summary
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const avgDuration = Math.round(results.reduce((sum, r) => sum + r.duration, 0) / results.length);

  console.log(`\n${colors.cyan}════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.blue}Summary:${colors.reset}`);
  console.log(`  ${colors.green}Passed: ${passed}${colors.reset}`);
  console.log(`  ${colors.red}Failed: ${failed}${colors.reset}`);
  console.log(`  Total: ${results.length}`);
  console.log(`  Average Duration: ${avgDuration}ms`);
  console.log(`  Success Rate: ${Math.round((passed / results.length) * 100)}%`);

  if (failed > 0) {
    console.log(`\n${colors.yellow}Failed Tests:${colors.reset}`);
    results.filter(r => !r.success).forEach(r => {
      console.log(`  ${colors.red}✗${colors.reset} ${r.name}: ${r.error}`);
    });
  }

  console.log('');
  process.exit(failed > 0 ? 1 : 0);
}

// Check if n8n is running first
async function checkN8n() {
  try {
    await makeRequest(`${CONFIG.n8n_base_url}/healthz`, {});
    return true;
  } catch (e) {
    return false;
  }
}

// Entry point
(async () => {
  const n8nRunning = await checkN8n();
  if (!n8nRunning) {
    console.log(`${colors.red}Error: n8n is not running at ${CONFIG.n8n_base_url}${colors.reset}`);
    console.log(`${colors.yellow}Please start n8n first: npx n8n${colors.reset}`);
    process.exit(1);
  }
  await main();
})();
