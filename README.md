# Booking demo

Local development guide for the Nest API (`api/`), Vue dashboard (`web/`), and optional MCP bridge (`mcp/`).

## Prerequisites

- **Node.js** 20.x (LTS recommended)
- **npm** (bundled with Node)

## Install dependencies

The repository root [`package.json`](package.json) only defines convenience scripts; install dependencies inside each package:

```bash
cd api && npm install
cd ../web && npm install
cd ../mcp && npm install
```

Skip `mcp` if you do not need the MCP stdio server.

## Configuration

1. Copy [`.env.example`](.env.example) to **`.env` in the repository root** (recommended). The API loads `.env` from `api/.env` or the parent directory, so a root `.env` is picked up when you run the API from `api/`.

2. Adjust values as needed. For local dashboard + API:

   - **`STATE_ROOT`** — Example value `../state` is relative to the `api/` working directory and points at the repo [`state/`](state/) folder.
   - **`JWT_SECRET`** — Set a non-default value for anything beyond local experimentation.
   - **`ADMIN_USERNAME` / `ADMIN_PASSWORD`** — Used for web login.
   - **`MCP_API_KEY`** — Required if you run the MCP server; must match between API and MCP.

3. **Twilio** and **OpenAI** variables are optional for browsing the dashboard locally; WhatsApp and AI features need them configured.

4. **Web (optional)** — Create `web/.env` if you want to override defaults:

   ```env
   VITE_API_URL=http://localhost:3000
   VITE_BOOKING_TIMEZONE=Europe/Berlin
   ```

   If `VITE_API_URL` is omitted, the app defaults to `http://localhost:3000` (see `web/src/api/client.ts`). Keep `VITE_BOOKING_TIMEZONE` aligned with `BOOKING_TIMEZONE` on the API so booking columns match.

## Run locally

Use two terminals from the **repository root**:

| Process | Command | URL |
|--------|---------|-----|
| API | `npm run dev:api` | `http://localhost:3000` (override with `PORT` in `.env`) |
| Web | `npm run dev:web` | `http://localhost:5173` (Vite default) |

Then open the web app in your browser. The SPA calls the API using `VITE_API_URL` (or the default above).

### Optional: MCP server

After the API is running, from the repo root:

```bash
export MCP_API_KEY=your-same-key-as-in-env
# optional: export API_URL=http://localhost:3000
npm run mcp
```

`MCP_API_KEY` is required. `API_URL` defaults to `http://localhost:3000` if unset.

## Production builds

From the repo root:

- `npm run build:api` — Nest build output under `api/dist/`
- `npm run build:web` — Vite output under `web/dist/`

To preview the built SPA locally: `cd web && npm run preview`.

## Docker (API)

Build the image from the **repository root** (build context is `api/`):

```bash
docker build -t booksy-api:latest -f api/Dockerfile api
```

Or from `api/`:

```bash
cd api
docker build -t booksy-api:latest .
```

The image sets a default **`STATE_ROOT=/app/state`** in the Dockerfile and creates that directory (writable by the `node` user). Persist data across container restarts by mounting a volume, for example:

```bash
docker run --rm -p 3000:3000 \
  -v booksy-state:/app/state \
  --env-file .env \
  booksy-api:latest
```

If your env file includes **`STATE_ROOT=../state`** (meant for local dev from `api/`), the API now maps that to **`/app/state`** inside the container so it does not try to write to **`/state`**. You can still set **`STATE_ROOT=/app/state`** explicitly.

Map the host port to whatever **`PORT`** you set in the env file (default **3000**), e.g. `-p 4000:4000` only if **`PORT=4000`**.

If you prefer not to use an env file, pass variables with `-e` (see [`.env.example`](.env.example)). At minimum you typically need **`JWT_SECRET`**, **`ADMIN_USERNAME`**, **`ADMIN_PASSWORD`**, and any integrations (**`TWILIO_*`**, **`OPENAI_API_KEY`**, **`MCP_API_KEY`**, etc.) for full behavior.

**Note:** Runtime configuration is **not** copied from your repo `.env` into the image; inject env vars or secrets at `docker run` / orchestrator (Cloud Run, Kubernetes, etc.).

## Troubleshooting

- **`STATE_ROOT` / missing data** — Ensure `STATE_ROOT` in `.env` resolves correctly for your current working directory when starting the API (typically run `npm run dev:api` from the repo root so `api/` is the cwd for the Nest process and `../state` matches the example).

- **Web cannot reach API** — Confirm the API is listening on the host/port in `VITE_API_URL`, and that no firewall is blocking localhost.

## Further reading

Nested `api/README.md` and `web/README.md` are upstream framework templates; this file is the main entry for running the whole project.
