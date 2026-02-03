# Script Comments Proposal

## Background
- The public script viewer (`public/public-script.html` + `public/js/pages/publicScriptViewerPage.js`) currently renders a title, metadata string, and the read-only content for any visitor. Logged-in users already see the shared top bar and auth widget, which gives us access to session state via `AuthWidget` and `ScriptPalUser`.
- Adding a small "Comments: N" link inside `.public-script-viewer__metadata` unlocks a lightweight survey of feedback without collapsing the existing layout. The request is to show that link, surface the current comment count, and toggle a drawer (right sidebar on desktop, bottom sheet on mobile) that lets authenticated visitors view and post comments tied to that script.
- Comments should stay scoped to scripts with `visibility = public` and reuse the existing public serializer so we do not leak private data.

## Objectives
1. Surface a comment count and toggle button inside the metadata bar so that readers know feedback exists and can open the panel in one click.
2. Deliver a responsive comments panel that slides in from the right on large screens and rises from the bottom on handheld devices, with a clear composer for logged-in users and a login CTA for guests.
3. Keep the public script payload lean while shipping the freshest `commentCount` so metadata can update without extra requests.

## Backend plan

### Data model
- Introduce a `ScriptComment` table (via `server/prisma/schema.prisma`) with fields: `id`, `scriptId`, `userId`, `content` (`LongText`), `isDeleted` (default `false`), `createdAt`, and `updatedAt`.
- Add relations to `Script` and `User`, plus an index on `scriptId` (and optionally `isDeleted`) for efficient listing.

### Repository/controller responsibilities
- Create `server/repositories/scriptCommentRepository.js` (or extend the script repo) that exposes `countByScript(scriptId)` and `listByScript(scriptId, { limit, offset })` (joining the commenter email) plus `createForPublicScript(scriptId, userId, content)`.
- Build `server/controllers/public/public-script-comment.controller.js` with two protected routes registered in `server/routes.js`:
  - `GET /public/scripts/:id/comments`: returns `{ comments: [...], count, page, pageSize }`; requires `validateSession` and verifies the script exists and is public.
  - `POST /public/scripts/:id/comments`: accepts `{ content }`, sanitizes/limits length (e.g., 500 characters), creates the comment, and returns the new comment plus refreshed count; it also requires `validateSession` and the script to remain public.
- Enforce input validation, log errors with the same structure as other controllers, and return `404`/`403` when the target script is missing or private.

### Serializer updates
- Extend `serializePublicScript` (`server/serializers/publicScriptSerializer.js`) to include `commentCount` (default `0`).
- Update `scriptModel.getPublicScript`/`getPublicScriptBySlug` to fetch the associated comment count (using `scriptCommentRepository.countByScript`) and pass it to the serializer so the JSON payload includes the new field.
- Ensure `publicScriptController` propagates this field without altering existing callers.

## Front-end plan

### API surface
- Add to `public/js/services/api/ScriptPalAPI.js`:
  - `getPublicScriptComments(scriptId, { limit = 20, offset = 0 })` for the GET route.
  - `addPublicScriptComment(scriptId, content)` for the POST route.
- Responses should include credentials (cookie-based session) and return parsed JSON with comment objects containing `id`, `content`, `createdAt`, and `authorLabel` (currently the commenter’s email).
```json
{
  "id": "...",
  "content": "...",
  "createdAt": "...",
  "authorLabel": "user@example.com"
}
```

### Metadata toggle
- Render the metadata paragraph as:
  ```html
  <p class="public-script-viewer__metadata">
    <span class="public-script-version">Version …</span>
    <button type="button" class="public-script-comments-toggle" aria-controls="public-script-comments-panel" aria-expanded="false">
      Comments: <span class="public-script-comments-count">0</span>
    </button>
  </p>
  ```
- Clicking the button should:
  1. If the user is not logged in, open the login widget (`AuthWidget`) instead of opening the panel.
  2. If the user is logged in, toggle a `public-script-comments-panel--open` class, fetch the first page of comments via `getPublicScriptComments`, and focus trap if necessary.
- After a new comment is posted, refresh both the panel list and the metadata count so the label matches the latest total.

### Comments panel layout
- Insert an `<aside id="public-script-comments-panel" class="public-script-comments-panel" aria-hidden="true">` next to the viewer section.
- Panel sections:
  - Header: “Comments” title and a close button.
  - Body: scrollable `<ul>` listing each comment with author email, relative timestamp (e.g., `Intl.DateTimeFormat`), and sanitized content; show a skeleton/loader when fetching.
  - Footer composer: `<textarea>` plus `Submit` button (disabled when empty or while posting) and helper text describing character limit.
  - States: empty list messaging, error messaging, and a login CTA when there’s no session.
- Desktop behavior: fix the panel to the right (max width 360px), overlay a semi-transparent backdrop on the script pane, and manage `aria-hidden` accordingly.
- Mobile behavior (`@media (max-width: 900px)`): anchor the panel to the bottom as a sheet covering ~60% of the viewport; include a draggable handle; close when tapping outside or on the close button.

### Interaction flow
1. Viewer loads; metadata draws `Comments: {{commentCount}}` from the serialized script.
2. Viewer toggles panel via the new button (opens only for authenticated users).
3. Panel fetches comments lazily; `addPublicScriptComment` posts new entries and triggers optimistic UI updates + metadata refresh.
4. Panel retains a simple cache of the latest page but re-fetches if reopened after a while to capture remote additions.

### Accessibility & styling
- Use `aria-expanded` on the toggle and `aria-hidden` on the panel to keep assistive tech synchronized.
- Provide focus trapping inside the panel when open (optional but recommended) and return focus to the toggle when the panel closes.
- Style the new components in `public/css/components/public-scripts.css` with visual cues matching the rest of the site, adding the necessary `@media` overrides for the bottom sheet.

## QA and rollout
- Server tests (`server/__tests__`) verifying comment listing/creation, 401 rejection when unauthenticated, and 403 when targeting non-public scripts.
- API integration tests to ensure `commentCount` increments and that metadata payload includes the new field.
- Manual/front-end tests covering the metadata toggle in desktop and mobile layouts, the login gate, and the composer submission + loader states.
- Monitor performance for large scripts (the panel fetches paginated comments, so start with a small default page size and allow `load more` if needed later).

## Next steps
1. Finalize the Prisma migration for `ScriptComment`, build the repository/controller, and wire the new routes with middleware checks.
2. Update the public serializer and viewer API so each script payload ships the `commentCount` used by the metadata button.
3. Implement the UI work in `public/public-script.html`, `public/js/pages/publicScriptViewerPage.js`, and the CSS module, then validate across desktop/mobile and login states.
4. After the MVP is stable, consider enhancements such as pagination controls, reactions, or author badges inside the panel.
