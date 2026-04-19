# AltaRise Beauty Salon – plans

**Canonical plan files for this repository** live under **[`.agent/plans/`](.agent/plans/)** (versioned with the repo).

| Document | Description |
| -------- | ----------- |
| [`.agent/plans/README.md`](.agent/plans/README.md) | Index of local plans |
| [`.agent/plans/altarise_booking_demo.md`](.agent/plans/altarise_booking_demo.md) | Original demo architecture (Nest + Vue + Twilio + MCP) |
| [`.agent/plans/booking_feedback_follow-up.md`](.agent/plans/booking_feedback_follow-up.md) | Follow-up work: PATCH, logging, 3-day calendar, phone/name model, Twilio confirmation |

Implementation layout: [`api/`](api/) (NestJS), [`web/`](web/) (Vue 3), [`state/`](state/) (JSON files), [`mcp/`](mcp/) (stdio MCP → HTTP API).
