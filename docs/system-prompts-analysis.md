# System Prompts Analysis

## Scope
This document reviews the five system prompt buttons, their request flow, and the unique characteristics of each prompt definition.

## Button-to-prompt mapping
The chat toolbar renders one button per entry in `SYSTEM_PROMPTS`. Each button uses the first character of the label as its visible text and fires the matching prompt `id` on click.

Buttons (5 total):
- `initial` — label: "Welcome / Orientation"
- `status` — label: "Status Check"
- `ideas` — label: "Ideas"
- `structure` — label: "Structure & Pacing"
- `production` — label: "Production Readiness"

Source: `shared/systemPrompts.js`, `public/js/widgets/chat/ui/PromptHelperWidget.js`

## End-to-end flow
1. UI renders the toolbar in the chat container and wires each button to a prompt id.
2. Button click flows through `PromptHelperBridge.handleHelperClick`, which routes system buttons to `SystemPromptOrchestrator.firePrompt`.
3. Bridge gets the current script id from `StateManager` and calls `SystemPromptOrchestrator.firePrompt`.
4. Orchestrator publishes `SYSTEM_PROMPT.READY`, fingerprints the script context, and calls `api.triggerSystemPrompt(promptId, scriptId, context)`.
5. Client API posts to the system prompt endpoint with `promptType`, `scriptId`, and `context`.
6. Server controller looks up the prompt definition, enriches the context with script metadata and `systemInstruction`, then calls the LangChain router with the `userPrompt`.
7. Response returns to the orchestrator, which renders it in chat and stores it in history.

Key modules:
- UI: `public/js/widgets/chat/ui/PromptHelperWidget.js`
- Bridge: `public/js/widgets/chat/integration/PromptHelperBridge.js`
- Orchestrator: `public/js/widgets/chat/integration/SystemPromptOrchestrator.js`
- Client API: `public/js/classes/api.js`
- Server controller: `server/controllers/systemPromptController.js`
- Prompt definitions: `shared/systemPrompts.js`

## Auto-trigger behavior (non-button)
The orchestrator also triggers prompts automatically based on script context updates:
- `status`: every 10 lines (line count >= 10, 20, 30, ...)
- `ideas`: after 150 lines, with a 10‑minute cooldown between triggers

Source: `public/js/widgets/chat/integration/SystemPromptOrchestrator.js`

## Prompt characteristics
Each prompt definition includes:
- `clientCopy` shown in the UI event payload.
- `userPrompt` used as the input prompt.
- `systemInstruction` injected into server-side context for the router.

### `initial` (Welcome / Orientation)
- Purpose: short, friendly onboarding for the current script.
- Must reflect script state (title, empty, early draft).
- Must not ask questions.
- Tone: calm, helpful, concise.

### `status` (Status Check)
- Purpose: factual summary of current script state.
- Must suggest exactly one next focus area.
- Must not propose rewrites or new ideas.
- Tone: concise, report-like.

### `ideas` (Ideas)
- Purpose: provide momentum with two distinct idea nudges.
- Must avoid summarizing the script.
- Must not rewrite scenes or dialogue.
- Must provide exactly two ideas, clearly differentiated.

### `structure` (Structure & Pacing)
- Purpose: structural and pacing review.
- Must identify concrete structural issues.
- Must suggest 2–3 specific adjustments (reorder/expand/compress/relocate).
- Must not introduce new story ideas or rewrite content.

### `production` (Production Readiness)
- Purpose: surface production considerations and gaps.
- Must identify production implications only if present.
- Must explicitly say when details are missing.
- Must not invent logistics.
- Notes should stay concise and actionable.
