URL routing control proposal

Goal
- Replace querystring navigation with readable paths like `/public/Script-Name` and `/mine/Script-Name`.
- Keep existing page structure and JS bootstraps intact.
- Minimize frontend refactors and preserve current API usage.

Current state
- Public pages are served as static HTML: `public/public-scripts.html` and `public/public-script.html`.
- Authenticated editor loads from `public/index.html`.
- Script fetches are ID-based (`/api/public/scripts/:id`, `/api/script/:id`).

Decision: Hybrid routing
- Hybrid (server routes + light client parsing) is the approved approach.
- It keeps the current HTML entry points and JS bootstraps unchanged.
- It avoids a client-side router and avoids an SPA rewrite.

Canonical URL scheme (approved)
- Public script list: `/public`
- Public script view: `/public/:slug`
- User script list/editor: `/mine`
- User script view/editor: `/mine/:slug`

Slug strategy
- Add `slug` field to the script record (generated on create).
- Uniqueness: public scripts are globally unique, user scripts are unique per user.
- Format: lowercase, hyphenated, strip punctuation, max length ~80 chars.
- Collision handling: suffix `-2`, `-3`, etc.
- Slug generated once on create, editable later if needed.

Server routing (Express)
- Serve existing HTML files only, no template logic needed.
  - `/public` -> `public/public-scripts.html`
  - `/public/:slug` -> `public/public-script.html`
  - `/mine` -> `public/index.html` (auth required)
  - `/mine/:slug` -> `public/index.html` (auth required)

Client-side change (minimal)
- Each entry script reads the slug from `location.pathname`:
  - `const slug = location.pathname.split('/').pop()`
- If slug exists, fetch by slug; otherwise show the list view.

API strategy (keep IDs, add slugs)
- Do not replace ID-based APIs.
- Add slug lookup endpoints:
  - `GET /api/public/scripts/slug/:slug`
  - `GET /api/script/slug/:slug` (auth required)
- Internal behavior: resolve slug -> ID, reuse existing fetch logic.

Migration plan (safe + reversible)
- Schema: add `slug` column and index.
- Backfill: generate slugs for existing scripts and resolve collisions.
- Endpoints: add slug lookup APIs; keep ID APIs unchanged.
- Frontend: parse slug from pathname and call slug endpoint.
- Redirects:
  - `/public-script.html?id=123` -> `/public/my-script`
  - `/index.html?id=123` -> `/mine/my-script`

404 handling (MVP)
- If slug not found, return the existing HTML and show inline "Script not found".
- Optional later: dedicated 404 page.
