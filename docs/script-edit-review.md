# Script Editing Access Review

## Status

### Route-level ownership
- equireScriptOwnership() now guards every /script/:id and /script/:scriptId/* route plus the chat message endpoints, so any request that could read or mutate script data fails fast at the router if the script does not belong to eq.userId. 
ext-lines, ppend-page, and AI/system prompt endpoints all rely on the same guard or shareable helpers so that script ownership is verified before heavy processing begins.

### Controller-level safeguards
- Controllers re-use the ownership helpers (erifyScriptOwnership, ensureElementOwnership, ensurePersonaOwnership) before performing database work. The script controller no longer trusts raw script IDs, the story-element/persona mutation paths query the parent script, and the chat/system-prompt flows now fail with 403/404 instead of returning another user’s data.

### Client cache + slug UX
- ScriptStore tracks the currently authenticated user, clears scripts/patches whenever the identity changes or auth events fire, and rejects cached scripts whose userId no longer matches. loadScriptBySlug maps 404 responses into StateManager.KEYS.CURRENT_SCRIPT_ERROR, so ScriptsController can publish a “Script not found” banner instead of reusing stale documents. Banner dismissals rewrite the URL to /mine and reset the editor state.

### First-time experience
- Registration still creates an initial “Untitled Script” on the server, and ScriptStore.ensureUserHasScripts only lets the editor start after the user has at least one owned script, guaranteeing new accounts never begin inside a previous user’s cache.

## Next steps
1. Add integration tests that log in as User A, attempt /mine/<A-slug> and /script/<A-id>/… calls from User B, and assert every protected API returns 403/404.
2. Smoke-test /mine/:slug and /public/:slug navigation workflows (valid slugs, invalid slugs, route refreshes) to confirm the banner and cache logic behave as expected.
3. Keep monitoring ScriptStore around auth lifecycle changes (login/register/logout/token rotation) to ensure no stale caches leak into the editor.
