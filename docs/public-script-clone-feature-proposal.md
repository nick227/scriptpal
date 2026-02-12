# Public Script Clone Feature Proposal

## Goal
Add a `Clone` link in `public-script-viewer__metadata` so a signed-in user can copy the viewed public script version into their own account, with automatic name collision handling.

## Current System Review

### Schema and Data Model
- `Script` has owner (`userId`), metadata (`title`, `author`, `description`, `status`), visibility, canonical slug, and optional `publicId` in `server/prisma/schema.prisma`.
- `ScriptVersion` stores immutable versioned content and `versionNumber` per script in `server/prisma/schema.prisma`.
- `ScriptSlug` already supports per-user slug history and canonical slug switching in `server/prisma/schema.prisma`.
- Slug uniqueness is enforced at DB level with `@@unique([userId, slug])` on both `scripts` and `script_slugs` in `server/prisma/schema.prisma`.
- Title uniqueness is not enforced in DB today, so collision handling must be done in application logic.

### Public and Script Routes
- Public read routes exist in `server/routes.js`:
  - `GET /api/public/scripts`
  - `GET /api/public/scripts/public/:publicId`
  - `GET /api/public/scripts/slug/:slug`
  - `GET /api/public/scripts/:id`
- Authenticated script write routes exist in `server/routes.js`:
  - `POST /api/script`
  - `PUT /api/script/:id`
  - version routes for restore/list.
- No clone endpoint exists yet.

### Existing Public Viewer UX
- Public script metadata is rendered in `public/public-script.html` under `.public-script-viewer__metadata`.
- Viewer page logic lives in `public/js/pages/publicScriptViewerPage.js`.
- The page already loads script by `publicId` or legacy slug and normalizes canonical URL.
- The page already has auth context via shared top bar widgets and `StateManager.KEYS.AUTHENTICATED`.

### Existing Slug Collision Infrastructure
- Slugs are generated with `generateUniqueSlug` in `server/lib/slug.js`.
- `scriptModel.createScript` and `scriptModel.updateScript` already use `scriptSlugRepository` to avoid collisions and maintain canonical history in `server/models/script.js`.
- This should be reused for clone creation.

## Feature Scope

### In Scope
- Add clone action to public script viewer metadata.
- Clone from the viewed public script version into current user account.
- Resolve title collisions for the target user.
- Reuse existing script creation/version/slug patterns.
- Redirect user to cloned script editor URL after success.

### Out of Scope (Phase 1)
- Cloning comments.
- Cloning media attachments (cover/gallery).
- Cloning scenes/characters/locations/themes/outlines.
- Multi-version import history (clone will create a new script with version `1` only).

## Proposed API and Backend Design

### New Endpoint
- `POST /api/public/scripts/public/:publicId/clone`
- Middleware: `validateSession` only.
- Request body:
  - `versionNumber` (optional number). If absent, clone latest public version.
- Response: `201 Created` with cloned script payload (same shape as `POST /api/script` response, including `id`, `slug`, `versionNumber`, `title`, `content`).

### Error Contract
- `401` if not authenticated.
- `404` if source public script or requested version does not exist.
- `409` only if collision retries are exhausted (unexpected edge case).
- `500` for unhandled server errors.

### Backend Flow
1. Resolve source via `publicId` and verify `visibility = public`.
2. Resolve source version:
   - If `versionNumber` provided, fetch that version.
   - Else fetch latest version.
3. Build clone title with collision-safe naming.
4. Create new private script for `req.userId` inside transaction:
   - Copy title (resolved unique copy title), author, description, status.
   - `visibility = private`.
   - `publicId = null`.
   - Create canonical slug via existing `generateUniqueSlug` + `scriptSlugRepository`.
   - Insert first `ScriptVersion` with selected source content as `versionNumber = 1`.
   - Insert `ScriptCommand` with type `clone_script`.
5. Return cloned script object via existing `toScriptWithVersion` shape.

### Collision Handling Strategy
- Goal: no title collision in target user's script list.
- Algorithm:
  - Base clone title: `${sourceTitle} (Copy)`.
  - If taken by same user, try `${sourceTitle} (Copy 2)`, `${sourceTitle} (Copy 3)`, etc.
  - Cap attempts (for example 200) and return `409` if exhausted.
- Slug collision is already handled by current slug generator and slug repository checks.
- Note: without a DB unique constraint on `(userId, title)`, two concurrent clone requests can still race. Optional strict mode is listed in the migration section.

### Suggested New Server Methods
- `scriptModel.clonePublicScript({ publicId, targetUserId, versionNumber })`
- `scriptRepository.listTitlesByUserPrefix(userId, baseTitle)` for fast suffix detection.
- `scriptController` or `publicScriptController` handler `cloneByPublicId`.

## Frontend Design

### UI Placement
- Add clone control inside `.public-script-viewer__metadata` next to version/comments in `public/public-script.html`.
- Use a button-like link style, e.g. `.public-script-clone-toggle`.

### UX Rules
- Authenticated: show enabled `Clone` action.
- Anonymous: show disabled clone action with text `Sign in to clone`.
- On click:
  - optimistic state `Cloning...`
  - call new clone endpoint using current `publicId` and current script `versionNumber`
  - redirect to `/mine/:slug` of clone on success
  - show inline error message on failure and reset button state

### Frontend Files to Update
- `public/public-script.html` for metadata control markup.
- `public/js/pages/publicScriptViewerPage.js` for clone action wiring and auth state toggling.
- `public/js/services/api/PublicScriptService.js` for `clonePublicScriptByPublicId(...)`.
- `public/js/constants.js` for new endpoint constant.
- `public/css/components/public-scripts.css` for metadata clone link styles.

## Security and Abuse Controls
- Clone endpoint must only accept sources currently public.
- Endpoint requires valid session.
- Clone target ownership is always current session user.
- Preserve existing input validation for structured content where relevant.
- Add lightweight rate limiting for clone route if needed (same pattern used by script update rate limiter).

## Migration and Schema Considerations

### Phase 1 Recommendation
- No schema migration required.
- Implement best-effort title collision handling in application logic.

### Optional Phase 2 (Strict Title Uniqueness)
- Add normalized title key column and DB unique index for `(userId, normalizedTitle)` if strict no-collision is required across concurrency.
- Requires backfill and duplicate remediation strategy before enforcing.

## Testing Plan

### Backend Tests
- Add route/controller tests for:
  - `401` unauthenticated clone attempt.
  - `404` missing/non-public source.
  - `404` missing requested version.
  - `201` successful clone returns new owner and version `1`.
  - collision naming produces `(Copy)`, `(Copy 2)`, `(Copy 3)`.
- Add model tests for transaction behavior and slug/title collision outcomes.

### Frontend Tests
- Viewer clone control visibility for authenticated vs unauthenticated states.
- Clone request success redirects to `/mine/:slug`.
- Clone request failure shows error and restores control state.

## Rollout Plan
1. Implement backend endpoint and model/repository logic.
2. Add frontend metadata clone control and integration.
3. Add automated tests.
4. Ship behind a short-lived feature flag if needed.
5. Monitor clone usage and collision/error rates in logs.

## Open Decisions
1. Should clone preserve source `status` or always set `draft`?
2. Should clone keep source `author` or default to current user identity?
3. Should we include source attribution metadata in script command payload only, or expose `clonedFrom` on script API responses?

