# AI Script Content Generation Plan

## Goal
Enable the AI to generate a correctly formatted next-page screenplay (20–22 lines) based on the current script, and return it for the client to append to the editor for user approval.

## Behavior: Does the AI Generate New Content?
Yes. When the user asks for a continuation (for example “add a new exciting page”), the append-page endpoint sends the **current script** to the AI and asks it to **generate new screenplay lines** that continue the script. The response is the newly generated lines only, which the client appends into the editor so the user can keep or delete them.

## Current Flow (Reference)
- Entry point: `POST /chat` in `server/routes.js` → `chatController.startChat`.
- `Chat.processMessage()` (`server/controllers/chat/Chat.js`) fetches the script, classifies intent, builds context, and routes to a chain.
- Intents today:
  - `GENERAL_CONVERSATION` → `DefaultChain`
  - `SCRIPT_CONVERSATION` → `AppendScriptChain`
- Script context is only attached for `SCRIPT_CONVERSATION` in `Chat.buildContext()` and is appended in `AppendScriptChain.buildMessages()`.

## Accuracy Discussion: Bake Into Existing Route vs Dedicated Route
- **Existing `/chat` route + intent**: relies on `IntentClassifier` and fallback intent resolution. This introduces misrouting risk for prompts like “write the next page,” especially if the classifier misses context or the general pattern triggers `GENERAL_CONVERSATION`.
- **Dedicated route**: bypasses intent classification entirely, guarantees script context is attached, and can enforce stricter output format (20–22 lines) for predictable client appending.

**Recommendation:** Use a **dedicated route** for “generate next page.” It yields more accurate results because it removes classification ambiguity and allows a more constrained prompt and output format without affecting normal chat flows.

## Decision: Keep It Dedicated and Direct
- ✅ **Dedicated endpoint**: Keep `POST /script/:id/append-page`.
- ✅ **Direct chain call**: Call the append chain directly in the controller.
- ✅ **No classifier / no router**: Do not use `IntentClassifier` or the chat router.
- ✅ **Plain screenplay text output**: Return raw 20–22 line screenplay text for client append.

## Decision: Drop Chat Intent Additions
- ❌ **No new chat intent**: Do not add `SCRIPT_APPEND_PAGE` to the global chat intent system.
- ❌ **No router registration**: Skip registry updates for this flow.
- ❌ **No chat-wide prompt instruction changes**: Keep chat behavior unchanged.

If you want an intent label for logging/telemetry only, add a **local constant** inside the append-page controller/chain (not in global intent constants).

## Server-Side Detection (No Client Heuristics)
- `/chat` now detects append-page requests with a simple server-side pattern match.
- If a request looks like “add a new page,” the server **bypasses the chat router** and calls the append-page chain directly.
- This keeps the client unaware of intent selection while still letting the server decide when to generate new script content.

## Proposed API Shape (Dedicated Route)
`POST /script/:id/append-page`

**Request**
```json
{
  "prompt": "Write the next page for me"
}
```

**Response**
```json
{
  "success": true,
  "scriptId": 123,
  "intent": "SCRIPT_APPEND_PAGE",
  "response": "INT. LOCATION - DAY\n...\n(20–22 lines total)"
}
```

## Server-Side Plan
1. **Local constant (optional)**: add `SCRIPT_APPEND_PAGE` only for logging/telemetry.
2. **New chain**: `AppendPageChain` (or rename/refine existing `AppendScriptChain`) that:
   - always includes full script text
   - instructs the model to generate **20–22 lines** of screenplay format only
   - returns plain text (no JSON) for client append simplicity
   - validates line count/format and retries if needed
3. **New controller method**: `scriptController.appendPage` (or `chatController.appendPage`) to:
   - load script by `scriptId`
   - normalize script content (reuse `ChainHelper.extractTextFromStructuredContent`)
   - call the chain directly (no intent classifier)
4. **Route wiring**: `POST /script/:id/append-page` with `validateSession`

## Prompt/Format Constraints (Chain System Instruction)
- Follow existing screenplay format conventions used in ScriptPal.
- Output **only** the new lines, exactly **20–22 lines**, no commentary.
- Continue from the last visible line; do not rewrite prior content.

## Client Behavior (unchanged, explicit)
- Client appends the returned text to the editor.
- User decides to keep or delete the appended block.

## Notes
- This plan keeps normal chat behavior intact and isolates “append page” into a deterministic, format-constrained flow.
- If you later want to support insert/modify, add separate routes and chains rather than extending this one.
