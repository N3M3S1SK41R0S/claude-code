#!/usr/bin/env node
/**
 * NEMESIS Hub - Workflow Validator
 * Validates all workflow JSON files for correct structure
 * Does NOT require n8n to be running
 *
 * Usage: node validate-workflows.js
 */

const fs = require('fs');
const path = require('path');

// Colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m'
};

// Required fields for a valid n8n workflow
const REQUIRED_FIELDS = ['name', 'nodes', 'connections'];
const REQUIRED_NODE_FIELDS = ['id', 'name', 'type', 'position'];

// Validate a single workflow
function validateWorkflow(filePath) {
  const result = {
    file: path.basename(filePath),
    valid: true,
    errors: [],
    warnings: [],
    stats: {}
  };

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const workflow = JSON.parse(content);

    // Check required fields
    for (const field of REQUIRED_FIELDS) {
      if (!workflow[field]) {
        result.errors.push(`Missing required field: ${field}`);
        result.valid = false;
      }
    }

    // Validate nodes
    if (workflow.nodes && Array.isArray(workflow.nodes)) {
      result.stats.nodeCount = workflow.nodes.length;
      result.stats.webhooks = [];

      for (let i = 0; i < workflow.nodes.length; i++) {
        const node = workflow.nodes[i];

        // Check required node fields
        for (const field of REQUIRED_NODE_FIELDS) {
          if (!node[field]) {
            result.errors.push(`Node ${i}: Missing field '${field}'`);
            result.valid = false;
          }
        }

        // Track webhooks
        if (node.type === 'n8n-nodes-base.webhook' && node.webhookId) {
          result.stats.webhooks.push(node.webhookId);
        }

        // Check for problematic patterns
        if (node.parameters?.functionCode) {
          const code = node.parameters.functionCode;

          // Check for require() which doesn't work in n8n
          if (code.includes("require('") || code.includes('require("')) {
            const match = code.match(/require\(['"]([^'"]+)['"]\)/);
            if (match) {
              result.warnings.push(`Node '${node.name}': Uses require('${match[1]}') - may not work in n8n`);
            }
          }
        }
      }
    }

    // Check connections reference valid nodes
    if (workflow.connections) {
      const nodeNames = workflow.nodes?.map(n => n.name) || [];
      for (const [sourceName, targets] of Object.entries(workflow.connections)) {
        if (!nodeNames.includes(sourceName)) {
          result.warnings.push(`Connection from unknown node: ${sourceName}`);
        }
      }
    }

    // Check for webhook
    if (!result.stats.webhooks || result.stats.webhooks.length === 0) {
      result.warnings.push('No webhook trigger found - workflow cannot be called via HTTP');
    }

    // Stats
    result.stats.name = workflow.name;
    result.stats.tags = workflow.tags || [];
    result.stats.hasNotes = !!workflow.notes;

  } catch (error) {
    result.valid = false;
    if (error instanceof SyntaxError) {
      result.errors.push(`Invalid JSON: ${error.message}`);
    } else {
      result.errors.push(`Error reading file: ${error.message}`);
    }
  }

  return result;
}

// Main
function main() {
  console.log(`\n${colors.cyan}╔════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.cyan}║     NEMESIS Hub - Workflow Validator               ║${colors.reset}`);
  console.log(`${colors.cyan}╚════════════════════════════════════════════════════╝${colors.reset}\n`);

  const workflowDir = path.join(__dirname, '..', 'workflows');

  if (!fs.existsSync(workflowDir)) {
    console.log(`${colors.red}Error: Workflow directory not found: ${workflowDir}${colors.reset}`);
    process.exit(1);
  }

  const files = fs.readdirSync(workflowDir).filter(f => f.endsWith('.json'));
  console.log(`${colors.blue}Found ${files.length} workflow files${colors.reset}\n`);

  const results = [];
  let valid = 0;
  let invalid = 0;
  let warnings = 0;

  for (const file of files) {
    const filePath = path.join(workflowDir, file);
    const result = validateWorkflow(filePath);
    results.push(result);

    const icon = result.valid
      ? (result.warnings.length > 0 ? `${colors.yellow}⚠${colors.reset}` : `${colors.green}✓${colors.reset}`)
      : `${colors.red}✗${colors.reset}`;

    const webhookInfo = result.stats.webhooks?.length > 0
      ? `${colors.dim}[/${result.stats.webhooks[0]}]${colors.reset}`
      : '';

    console.log(`${icon} ${result.stats.name || result.file} ${webhookInfo}`);

    if (result.errors.length > 0) {
      result.errors.forEach(e => console.log(`  ${colors.red}└─ ERROR: ${e}${colors.reset}`));
    }
    if (result.warnings.length > 0) {
      result.warnings.forEach(w => console.log(`  ${colors.yellow}└─ WARNING: ${w}${colors.reset}`));
    }

    if (result.valid) valid++;
    else invalid++;
    if (result.warnings.length > 0) warnings++;
  }

  // Summary
  console.log(`\n${colors.cyan}════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.blue}Summary:${colors.reset}`);
  console.log(`  ${colors.green}Valid: ${valid}${colors.reset}`);
  console.log(`  ${colors.red}Invalid: ${invalid}${colors.reset}`);
  console.log(`  ${colors.yellow}With Warnings: ${warnings}${colors.reset}`);
  console.log(`  Total: ${files.length}`);

  // List all webhooks
  console.log(`\n${colors.blue}Webhook Endpoints:${colors.reset}`);
  const allWebhooks = results
    .flatMap(r => r.stats.webhooks || [])
    .sort();
  allWebhooks.forEach(w => console.log(`  /webhook/${w}`));

  console.log('');
  process.exit(invalid > 0 ? 1 : 0);
}

main();
