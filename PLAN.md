# AltaRise Beauty Salon – booking demo plan

This file is a copy of the development plan for convenience. The canonical plan may also live under `.cursor/plans/`.

See the repository implementation: `api/` (NestJS), `web/` (Vue 3), `state/` (JSON files), `mcp/` (stdio MCP → HTTP API).

## Summary

- **Public page**: QR + WhatsApp sandbox instructions (`qr_code.svg`).
- **Admin**: Login → dashboard: calendar, WhatsApp threads, 24h session rule, template reminders, admin OpenAI chat with booking tools.
- **API**: NestJS + Swagger at `/docs`, per-file state under `state/chats/*.json` and `state/bookings/*.json`.
- **Twilio**: Webhook with mandatory signature validation (`TWILIO_WEBHOOK_BASE_URL` + path).
- **OpenAI**: `gpt-4o-mini`, tools call Nest services in-process; MCP server calls REST with `MCP_API_KEY`.

Full detail: see `.cursor/plans/altarise_booking_demo_b6a50711.plan.md` if present.
