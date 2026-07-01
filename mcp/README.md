# ortho-mcp

An [MCP](https://modelcontextprotocol.io) server that lets Claude (or any MCP
client) read and write OrthoReminder — search/create/update patients, adjust
aligner status, and pull Dentalink data. It is a thin adapter over the
OrthoReminder REST API; all validation and per-user scoping stay in the API.

## Setup

1. **Mint an API key** (from `api/`):

   ```sh
   pnpm mint-key --email you@example.com --name "MCP server"
   ```

   Copy the printed `ork_...` key — it is shown only once. The key acts as that
   user, so its data scope matches that account.

2. **Install & build** (from `mcp/`):

   ```sh
   pnpm install
   pnpm build
   ```

3. **Configure** — copy `.env.example` to `.env` and set `ORTHO_API_KEY` (and
   `ORTHO_API_BASE_URL` if not the local default `http://localhost:3001`).

## Register with Claude Code

```sh
claude mcp add ortho-mcp \
  --env ORTHO_API_BASE_URL=http://localhost:3001 \
  --env ORTHO_API_KEY=ork_your_key \
  -- node /absolute/path/to/mcp/dist/index.js
```

Or add to `.mcp.json`:

```json
{
  "mcpServers": {
    "ortho-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/mcp/dist/index.js"],
      "env": {
        "ORTHO_API_BASE_URL": "http://localhost:3001",
        "ORTHO_API_KEY": "ork_your_key"
      }
    }
  }
}
```

During development you can point `args` at `["tsx", "src/index.ts"]` instead of
the built file.

## Tools

**Patients:** `patient_search`, `patient_list`, `patient_get`, `patient_create`,
`patient_update`, `patient_adjust_aligner`, `patient_start_treatment`,
`patient_start_tracking`, `patient_set_last_appointment`.

**Dentalink:** `dentalink_list_clinics`, `dentalink_controles`,
`dentalink_patient_summary`, `dentalink_patient_history`,
`dentalink_patient_profile`, `dentalink_link_patient`.

**Composite:** `patient_create_from_dentalink` — fetches demographics from
Dentalink, creates the internal patient, and (by default) links them.

## Security

The API key is a long-lived credential that acts as a real user. Keep it out of
git (see `.gitignore`). Revoke a key with `DELETE /api-keys/:id` (admin) or by
removing the row.
