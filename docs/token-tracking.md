# Token Tracking Post Op

## Summary
- Added per-message AI usage capture (`prompt_tokens`, `completion_tokens`, `total_tokens`, `cost_usd`) in `chat_messages` so every LangChain completion persists the OpenAI `usage` payload.
- Introduced a lightweight `tokenUsageRepository` plus `GET /api/user/token-watch`, wired through session validation, to surface aggregated totals (prompt/completion/total tokens and USD cost) back to authenticated users.
- Built a shared top-bar `TokenWatchWidget` that polls the new endpoint, listens for chat writes, and renders the latest totals in the global header alongside the existing auth controls.

## Verification steps
1. Run `npx prisma migrate dev` (or the equivalent migration tooling) so the new columns exist in MySQL and Prisma's client reflects them.
2. Start the server, log in as a user, trigger an AI completion, and confirm `/api/user/token-watch` returns non-zero tokens/cost plus the widget updates in the top-right.
3. Exercise logout/login flows to ensure the widget hides when unauthenticated and resets state on sign-out.

## Follow-up work
- Add Prisma seed/migration tests that assert the new columns exist and default to zero so future schema drift is caught early.
- Expand the widget to show interval breakdowns (e.g., today vs. lifetime) once backend aggregation offers those slices.
- Surface token usage data in admin dashboards or alerts to monitor collective spend and flag spikes.
