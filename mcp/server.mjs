/**
 * Stdio MCP server → AltaRise Nest API (`/mcp/*`).
 * Env: API_URL (default http://localhost:3000), MCP_API_KEY (required).
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const API_URL = (process.env.API_URL || 'http://localhost:3000').replace(/\/$/, '');
const MCP_API_KEY = process.env.MCP_API_KEY;
if (!MCP_API_KEY) {
  console.error('MCP_API_KEY is required');
  process.exit(1);
}

async function apiFetch(path, init = {}) {
  const url = path.startsWith('http') ? path : `${API_URL}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'x-mcp-api-key': MCP_API_KEY,
      ...init.headers,
    },
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    throw new Error(typeof data === 'string' ? data : JSON.stringify(data));
  }
  return data;
}

const server = new McpServer({
  name: 'altarise-bookings',
  version: '0.1.0',
});

server.registerTool(
  'list_bookings_month',
  {
    description: 'List all bookings for a calendar month (UTC aggregation on API).',
    inputSchema: z.object({
      year: z.number(),
      month: z.number().min(1).max(12),
    }),
  },
  async (args) => {
    const data = await apiFetch(
      `/mcp/bookings?year=${args.year}&month=${args.month}`,
    );
    return {
      content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
    };
  },
);

server.registerTool(
  'create_booking',
  {
    description: 'Create a one-hour appointment (next 3 days only; server-enforced).',
    inputSchema: z.object({
      phoneE164: z.string(),
      clientName: z.string(),
      start: z.string(),
      services: z.array(z.string()).min(1),
    }),
  },
  async (args) => {
    const data = await apiFetch('/mcp/bookings', {
      method: 'POST',
      body: JSON.stringify({
        phoneE164: args.phoneE164,
        clientName: args.clientName,
        start: args.start,
        services: args.services,
        durationMinutes: 60,
      }),
    });
    return {
      content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
    };
  },
);

server.registerTool(
  'cancel_booking',
  {
    description:
      'Cancel an appointment by id (soft cancel; slot freed).',
    inputSchema: z.object({
      bookingId: z.string(),
    }),
  },
  async (args) => {
    const data = await apiFetch(`/mcp/bookings/${encodeURIComponent(args.bookingId)}/cancel`, {
      method: 'POST',
    });
    return {
      content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
    };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
