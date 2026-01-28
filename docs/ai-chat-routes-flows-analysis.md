# AI Chat Routes Flows (Current Analysis)

## Overview
AI flows currently branch through chat, next-lines, append-page, full-script, and idea routes. Context building has been centralized in `contextBuilder`, and script collections (scenes/characters/outlines/themes) are injected wherever script context is attached.

## Primary Entry Points
- **Chat**: `POST /chat`
  - Controller: `server/controllers/chatController.js`
  - Class: `server/controllers/chat/Chat.js`
- **Next Five Lines**: `POST /script/:scriptId/next-lines`
  - Controller: `server/controllers/nextLinesController.js`
- **Append Page**: `POST /script/:scriptId/append-page`
  - Service: `server/controllers/scripts/AppendPageService.js`
- **Full Script**: `POST /script/:scriptId/full-script` (internally uses `FullScriptService`)
- **Idea Routes**:
  - `POST /script/:scriptId/scenes(/:sceneId)/ai/scene-idea`
  - `POST /script/:scriptId/characters(/:characterId)/ai/character-idea`
  - `POST /script/:scriptId/locations(/:locationId)/ai/location-idea`
  - `POST /script/:scriptId/themes(/:themeId)/ai/theme-idea`

## Context Assembly (Centralized)
- **Builder**: `server/controllers/contextBuilder.js`
  - `buildPromptContext()` and `buildScriptContextBundle()`
  - Handles script title/description/content/metadata + scriptCollections
  - Policy: `collectionsPolicy` (`when-include` default)

## Chat Flow (High Level)
1. `chatController` receives `/chat`.
2. Detects special modes:
   - `next-five-lines` → builds context via `buildPromptContext` and routes to `ScriptNextLinesChain`.
   - `append-page` → uses `AppendPageService`.
   - `full-script` → uses `FullScriptService`.
3. Fallback → `Chat` class builds context and routes to chain via `IntentRouter`.
4. Response validated and normalized (when applicable).

## Chains & Validation
- **ScriptNextLinesChain** → validates via `validateAiResponse` and attaches `contractValidation`.
- **ScriptPageAppendChain** → returns contract metadata (append-page).
- **ScriptFullChain** → returns contract metadata (full-script).
- **DefaultChain** and **ScriptReflectionChain** are non-structured text responses.
- **Idea Chains** (scene/character/outline/theme/location) use JSON function output.

## Script Collections Usage
Injected into:
- `DefaultChain`
- `ScriptAppendChain`
- `ScriptNextLinesChain`
- `ScriptPageAppendChain`
- `ScriptFullChain`
- `SceneIdeaChain`
- `TaggedItemIdeaChain` (character/outline/theme/location)

## Observations
- Context and collections are now consistent across flows.
- Contract metadata is standardized for structured responses.
- Idea routes are unified in `routes.js`.

## Next Steps (Value Discussion)
### High Value (low risk)
- Unify **ownership checks** in controllers via a shared helper.
- Centralize **scriptId required** handling for all AI endpoints.
- Add **single response wrapper** for AI metadata to avoid ad-hoc fields.

### Medium Value
- Add a **single “AI route dispatcher”** for chat-related actions instead of branching in `chatController`.
- Introduce a **typed contract map** for AI responses (intent → schema) to keep metadata uniform.

### Low Value / High Risk (avoid for now)
- Unifying Prisma tables for item types (guardrail).
- Over-generalizing UI state.
