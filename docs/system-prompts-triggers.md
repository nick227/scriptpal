# System Prompt Triggers

This document explains how the client detects when to fire each system prompt so the environment can surface proactive nudges without depending on server push notifications.

## Trigger inputs
- **Script events** – The orchestrator listens to `EventManager.EVENTS.SCRIPT.SELECTED`, `SCRIPT.CONTEXT_UPDATED`, and `SCRIPT.DELETED`. Selecting or loading a script seeds the prompt state, context updates report new line counts, and deletions clean up memory.
- **Script context** – Each context payload provides `contentStats`/`contentLength`. The orchestrator reads `contentStats.lines` first and falls back to raw content length when necessary.
- **Line multiples** – Status checks happen when the script crosses multiples of 10 lines. The orchestrator tracks the next target line (starting at 10) and only fires when the current line count meets or exceeds that target; it then advances to the next multiple so status prompts remain spaced evenly.
- **Cooldowns** – Idea prompts require at least 150 lines and cannot fire more often than every 10 minutes per script.
- **Manual triggers** – System prompt buttons in the chat UI let testers manually call `SystemPromptOrchestrator.firePrompt(promptId, scriptId, { manual: true })`, which reuses the same routing logic and UI indicator events.

## Prompt lifecycle
1. When the script first loads, `initial` fires immediately (once per script) and stamps `initialTriggeredAt`.
2. Each status trigger compares `lineCount` to `state.statusNextLine`. Crossing the threshold fires `status` and advances `statusNextLine` to the next multiple of 10 (derived from the current line count or `state.statusNextLine + 10`).
3. Idea prompts check the cooldown timestamp. They fire only when `lineCount >= 150` and the last idea trigger was more than 10 minutes ago.
4. Every trigger emits `SYSTEM_PROMPT:READY`/`FIRED`/`FAILED`, updating the indicator badge in `ChatIntegration`.
5. Responses are annotated with `promptType` metadata so the chat renderer and history clearly associate them with the initiating trigger.

## Visual feedback
- The chat UI adds a floating indicator/ticker that temporarily shows the prompt type, color-coded status, and a minimal spinner whenever a system prompt is pending.
- A small toolbar of buttons labeled with each prompt label lets QA trigger them and observe responses without waiting for automatic thresholds.

## Extensibility
- Future prompts can augment the catalog in `shared/systemPrompts.js` and rely on the orchestrator’s `firePrompt` method to handle line counts, cooldowns, and publishing events with minimal additional wiring.
