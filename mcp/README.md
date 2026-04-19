# AltaRise MCP server (stdio)

Proxies tools to the Nest API (`/mcp/bookings`).

## Run

1. Start the API with `MCP_API_KEY` set (same value here and in the API env).
2. From this directory:

```bash
export MCP_API_KEY=your-key
export API_URL=http://localhost:3000
node server.mjs
```

Add the server to your MCP client (e.g. Cursor) as a **stdio** command pointing at `node` with args `/absolute/path/to/mcp/server.mjs` and the env vars above.

## Tools

- `list_bookings_month` — `year`, `month` (1–12)
- `create_booking` — `clientId`, `start` (ISO8601), `services` (string array)
