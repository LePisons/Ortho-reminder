#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { OrthoClient } from './client.js';
import { registerTools } from './tools.js';

const baseUrl = process.env.ORTHO_API_BASE_URL ?? 'http://localhost:3001';
const apiKey = process.env.ORTHO_API_KEY;

if (!apiKey) {
  // stderr, not stdout — stdout is the MCP transport.
  console.error(
    'ORTHO_API_KEY is required. Mint one with `pnpm mint-key` in api/.',
  );
  process.exit(1);
}

async function main() {
  const client = new OrthoClient({ baseUrl, apiKey: apiKey! });
  const server = new McpServer({ name: 'ortho-mcp', version: '0.1.0' });

  registerTools(server, client);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`ortho-mcp connected (API: ${baseUrl})`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
