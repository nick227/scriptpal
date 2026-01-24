## Visibility & Public Script Viewer Roadmap

### Background
Scripts are currently private by default with no visibility metadata or public listing. We want to enable an opt-in public visibility state so creators can publish scripts while retaining edit control. Public scripts still belong to their owners, edits remain limited to the creator, and every script should be private unless explicitly published.

### Strategic goals
1. Formalize a `visibility` field (not `is_public`) as the committed API surface that can later grow to `private | public | unlisted`.
2. Preserve ownership guardrails so only the creator may edit a script while anyone can view a public script.
3. Surface published work through dedicated read-only endpoints/UI backed by an allowlisted public serializer so we never leak sensitive fields.

### Phase 1 – Schema & Persistence
- Extend `Script` in `server/prisma/schema.prisma` with a committed `visibility` field, defaulting to private.
- Add migrations to backfill existing scripts to private and enforce the default at the database level.
- Update data-layer helpers and ORM accessors so the default visibility value is enforced on creation and cannot be bypassed by clients.

### Phase 2 – API & Access Control
- Keep existing edit/save routes strictly owner-only regardless of visibility, and add explicit checks that the requesting user is the owner before permitting updates.
- Add a public script listing route that returns only scripts marked `public`. The route should be filterable/sortable (recent, popular), paginated, and clearly distinguished from edit routes so clients know it is read-only.
- Introduce a public read-only script route separate from any edit endpoints. This route reuses shared serializers but adds a public serializer with an allowlist of safe fields plus owner metadata; no edit tokens or mutation capabilities are included.
- Document the new endpoints in the API reference so frontend teams understand the split between edit and view-only contracts.

#### API route design sketch
- `GET /public/scripts` – no auth required, responds with a paginated list of scripts where `visibility = public`. Accepts query params for `page`, `pageSize`, optional sort by `updatedAt` or other metrics, and optional filters. The response uses the public serializer allowlist and includes owner metadata plus script summary.
- `GET /public/script/:id` – no auth required, returns the public serializer for a single script, including the latest content, metadata, and owner info. If the script is not public, return 403 (or 404 to avoid revealing existence). This route stands apart from `/script/:id`, so clients know they are accessing a read-only copy.
- Continue to gate `/script/:id`, `/script/:id/profile`, `/script/:id/stats`, and other edit-related endpoints behind `validateSession` and ownership guard checks. Return 403 when the authenticated user is not the owner.
- The public routes should reuse shared serialization logic but wrap it with an allowlist that strips private metadata while still returning the fields needed by the UI (title, author, summary, version number).

### Phase 3 – UI Experience
- Create a “Public Scripts” discovery page that consumes the listing route and displays script cards (title, author, tags, publish timestamp, and summary). Include sorting/pagination controls and a badge that identifies this as the public catalog. Render this page together with the shared top bar and auth widget so the session UI stays consistent across the site.
- Build an individual read-only script viewer page that hits the public read-only endpoint, renders the latest content, and overlays read-only cues (header, disabled controls, owner and visibility metadata). Provide tooling to copy the content without editing, and reuse the shared layout so the auth/session UI remains consistent.
- Update the editor listing/management screens to show visibility badges/icons per script and expose visibility toggles only to owners. The toggle should explain that private scripts are private to the user while public scripts are shareable.
- Keep visibility controls within the existing editor modal/side panel so the public list and viewer rely solely on the read-only routes and expose no edit actions.

### Phase 4 – QA & Rollout
- Add backend integration and unit tests for the visibility flag (default private, owner-enforced edits, public listing filters).
- Add UI tests for the public list and reader flows (component or end-to-end) to guard against regressions in rendering or access control.
- Perform a privacy/security review to ensure the public serializer allowlist does not expose any private data.
- Ship the feature behind a feature flag if gradual rollout is desired and monitor for styling or behavioral issues once enabled.

### Next steps
1. Align with the database team on the schema change, migration, and how existing data defaults to private.
2. Nail down the new public routes’ contracts (query params, response shape, pagination) and document the split between edit and read-only flows.
3. Prototype the public scripts UI/reader to validate labels, badges, copy controls, and read-only cues before engineering work begins.
