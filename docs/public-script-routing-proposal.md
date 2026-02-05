# Public Script Display Routing Proposal

## Current state
- Public scripts are displayed via `public-script.html` and fetched through `GET /api/public/scripts/slug/:slug`. Slugs are unique only per user, so multiple authors can publish the same slug and the route cannot distinguish them reliably.
- Because the controller resolves the first matching slug, collisions either show the wrong script or fail entirely when two users publish the same title.

## New direction: IDs drive public routing, slugs are cosmetic
### 1. Add a `publicId` field
- Add `publicId String? @unique @db.VarChar(32)` to the `Script` model.
- Generate it once (e.g., nanoid/base62) the first time `visibility` transitions to `public`. Never change it again.
- This ID becomes the canonical identifier for every public route; slugs stay for readability/SEO but are not required for lookup.

### 2. Canonical public URLs
- Primary route: `/public/:publicId`.
- Pretty route: `/public/:publicId/:slug` (optional). Backend ignores the slug when resolving but returns the canonical slug to the client.
- If the client visits `/public/:publicId/:slug` and the slug differs from the canonical value, respond with JSON containing `{ canonicalSlug }` so the client can `replaceState` to the canonical path—mirroring the private `/mine/:slug` behavior.

### 3. API adjustment
- Introduce `GET /api/public/script/:publicId` (or retrofit existing slug endpoint) that looks up the script by `publicId`, verifies visibility, and returns the script plus the canonical slug.
- No slug lookup is necessary; collisions disappear because each `publicId` is globally unique.

### 4. Client behavior
- When loading a public script, call the `publicId` endpoint.
- If the path contains a slug and it differs from the canonical slug in the response, call `window.history.replaceState` to update to `/public/${publicId}/${canonicalSlug}`.
- Share links always include both parts: `/public/${publicId}/${canonicalSlug}`. Legacy slug-only links are redirected (see below).

### 5. Visibility transitions
- Private → public: generate `publicId` if missing, ensure canonical slug exists (reuse `script_slugs`), and return both from the API so the frontend can update the URL immediately.
- Public → private: keep `publicId` stored if desired, but simply stop serving that script through the public API; no IDs are recycled.

### 6. Backwards compatibility
- Continue honoring `/public/:slug` temporarily (legacy links). Have the route look up `script_slugs` entries filtered by visibility:
  - If exactly one public script matches, respond with `302` redirect to `/public/${publicId}/${canonicalSlug}`.
  - If 0 or >1 matches, return a 404/“ambiguous link” banner.
- This ensures old share links keep working long enough to update them.

### 7. Why this works
- Slugs remain presentation layers, while IDs give us a stable, collision-free key for routing.
- No need for usernames or owner slugs; a single lookup on `publicId` suffices.
- The alias table and slug normalization code remain useful for SEO-friendly URLs without affecting routing correctness.

### Summary
- Private routing: `/mine/:slug` (slug-driven, alias-aware).
- Public routing: `/public/:publicId/:slug` (ID-driven, slug just for display). All new links should emit both segments, and legacy slug-only requests should redirect to the new path once resolved.

Schema change – add publicId String? @unique @db.VarChar(32) to Script, generate it once when visibility flips to public, and include it in migration + Prisma regen.
Public API – add GET /api/public/script/:publicId returning { script, canonicalSlug }, and keep slug-only endpoint to redirect legacy links where there’s a single matching public slug.
Router updates – serve /public/:publicId and optional /public/:publicId/:slug; ignore slug during lookup but return the canonical slug for client-side self-healing.
Frontend link handling – always emit /public/${publicId}/${slug} from widgets/pages; when a loaded slug differs from the canonical slug, replace the URL to the canonical path.
Visibility workflow – ensure private→public transition assigns publicId (and reuses slug logic) while public→private simply stops resolving without deleting the ID.
Backfill/redirects – backfill existing public scripts with publicId (e.g., nanoid), and add a redirect for /public/:slug to the new /public/:publicId/${canonicalSlug} path whenever exactly one match exists.