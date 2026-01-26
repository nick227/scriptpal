# System Prompts Rollout Proposal

## Vision
Deliver proactive, chat-style system prompts that welcome new scripts, check in on progress, and offer idea nudges without introducing websocket infrastructure or server-side schedulers.

## Current platform baseline
- The backend (see server/server.js) boots an Express HTTP server with route-based handlers (server/routes.js) and no websocket layers; every AI interaction flows through /api/chat via server/controllers/chatController.js plus the Chat helper (server/controllers/chat/Chat.js).
- The chat UI uses public/js/widgets/chat/core/ChatManager.js, which already owns rendering assistant replies, maintaining history, and asking the ScriptContextManager for the latest state.
- Editor and script updates publish to EventManager.EVENTS.SCRIPT and EventManager.EVENTS.EDITOR (defined in public/js/core/EventManager.js), giving us hooks to react when scripts change, when content updates, and when line or format events fire.

## Goals for the system prompt feature
1. Define a handful of system prompts (initial welcome, status check, idea probe) with clear triggers and copy.
2. Keep trigger logic on the client for now (based on script selection and content/line thresholds) so we avoid real-time server pushes or websockets.
3. Treat each prompt as a chat-style assistant interaction that can read the same script context we already display in the chat log.
4. Provide visibility into what prompts ran per script and when, leaving room to surface the data in chat history or telemetry later.

## Proposed architecture
### Prompt catalog
- Introduce shared definitions on both sides (for example, public/js/constants/systemPrompts.js and server/constants/systemPrompts.js) describing each prompt's id, display copy, system instruction, and trigger metadata (line counts, script state, whether it fires only once).
- Keep systemInstruction strings ready for the server to prepend before invoking the AI router so the assistant knows whether it is doing a welcome message or a status check.

### Client trigger orchestrator
- Add a SystemPromptOrchestrator that consumes EventManager events (SCRIPT:SELECTED, SCRIPT:CONTENT_CHANGED, EDITOR:LINE_ADDED, and so on) and knows the current script's line counts via ScriptContextManager.getContentStats().
- Track per-script state so we fire:
  * initial when a script is first loaded or created (only once per script).
  * status when crossing configurable line multiples (e.g., every 10 lines) or when script metadata (status, version) shifts.
  * ideas when a large chunk of content is added without any prompts for a configurable cooldown period.
- Emit a SYSTEM_PROMPT:READY event with the prompt definition so other widgets can display placeholders while awaiting the AI reply.
- Implement the status check trigger using simple line multiples (e.g., every 10 lines) and surface a lightweight indicator plus manual buttons so testers can fire prompts and see the result onscreen.

### Server contract and route
- Add POST /api/system-prompts (registered inside server/routes.js) so the concept stays isolated even though the payload ultimately reuses the chat flow; this makes it easier to expand later (analytics, permissions, throttling).
- The request body schema would look like this:
  ```json
  {
    'scriptId': 123,
    'promptType': 'status',
    'context': {
      'lineCount': 88,
      'lastEdited': '2026-01-21T12:00:00Z',
      'metadata': {
        'title': 'Act II'
      }
    }
  }
  ```
- The controller loads the script (if supplied), builds a Chat (or a lighter wrapper that calls router.route), injects the configured systemInstruction for the promptType, and then routes the prompt text to the AI so the assistant response can be returned in the existing schema.
- Return the same payload format as /api/chat so the frontend can reuse ChatManager without new parsing logic.

### Client response handling
- When the orchestrator receives the assistant payload, hand it to ChatManager.processAndRenderMessage with MESSAGE_TYPES.ASSISTANT so the response appears in the chat timeline.
- Optionally persist the generated message by calling chatHistoryManager.addMessage so the prompt is part of the conversational record for the script.
- Emit telemetry events (SYSTEM_PROMPT:FIRED, SYSTEM_PROMPT:FAILED) with metadata such as scriptId, promptType, and lineCount.

### Observability & telemetry
- Log trigger events server-side via the existing logger so failures surface with correlation IDs.
- Provide hooks for future analytics (e.g., tracking how often each prompt type fires per user) via the new SYSTEM_PROMPT events.

## Implementation roadmap
1. Create shared prompt definition modules and keep copy/trigger metadata versioned in one place.
2. Build the SystemPromptOrchestrator on the client and wire it into the editor/chat lifecycle.
3. Add POST /api/system-prompts plus a controller that maps promptType to systemInstruction and reuses the Chat routing infrastructure.
4. Wire the orchestrator to render replies via ChatManager and optionally persist them to history.
5. Document the flows and add tests for the server route and orchestrator behavior.

## Open questions
- Should the server persist system prompt exchanges via chatMessageRepository by default, or keep them transient while we monitor behavior?
- Do we want a UI affordance (banner, badge, toast) that highlights when a system prompt fires, or should it simply appear in the chat log like any other assistant message?
- How conservative should the status/ideas thresholds be to avoid user fatigue? Start low and adjust via the shared config file.
