# Script Data → Prompt Binding Review

## 1. Client-side context shaping

- **ScriptContextManager → AI context**  
  `public/js/widgets/editor/context/ScriptContextManager.js` builds script metadata, plain text, page/chapter info, and lightweight analysis stats before caching them (`getScriptContext`). `getAIChatContext` extends that payload with an AI timestamp and version tag so the chat UI has one source of truth for everything the model might need (`#L351`).
- **ChatManager call site**  
  `public/js/widgets/chat/ChatManager.js` gathers the context above inside `getApiResponseWithTimeout` (`#L346`), races the call against a 30 s timer, and then hands both prompt + context to `API.getChatResponse`.
- **API helpers**  
  `public/js/classes/api.js` injects the current scriptId/title/version from local storage into `context` before serializing the request body to `/api/chat` (`#L367`). The same helper family also publishes system prompts via `/api/system-prompts`, wrapping every payload with `promptType`, a timestamp, and any inbound trigger context (`#L406`).
- **System prompt orchestration**  
  `public/js/widgets/chat/SystemPromptOrchestrator.js` watches script events, evaluates line-count/cooldown rules, and then calls `api.triggerSystemPrompt` with the last cached context plus `promptId` / `lineCount` metadata (`#L134`). `shared/systemPrompts.js` keeps the canonical `systemInstruction` + `userPrompt` pair aligned between client buttons/indicators and the backend catalog.

## 2. Server-side fusion points

- **Entry points**  
  `server/routes.js` wires `/chat` to `chatController.startChat` (`#L40`) and `/system-prompts` to `systemPromptController.trigger` (`#L62`), both guarded by `validateSession`.
- **chatController + Chat**  
  `chatController.startChat` validates the payload, normalizes scriptId between the body/context, and instantiates `Chat` with the resolved script (`server/controllers/chatController.js#L144`). `Chat.processMessage` loads the latest script, determines whether the prompt is an edit/analysis request, and then calls `buildContext` to merge metadata, preprocessed content (`ChainHelper.extractTextFromStructuredContent`), historic chat messages, and any protected enhanced context keys (`server/controllers/chat/Chat.js#L68` and `#L113`).
- **Intent routing + prompt templates**  
  The router reads the intent and hands the enriched context to the appropriate chain. `EditScriptMessages.buildMessages` injects the validated script content into the prompt template so the assistant can reason about specific line numbers and XML tags (`server/controllers/langchain/chains/edit/EditScriptMessages.js#L103`). `ScriptAnalyzerChain.buildMessages` reuses the same context, enforces the analysis-specific system instructions, and falls back to the prompt text when `scriptContent` is absent (`server/controllers/langchain/chains/analysis/scriptAnalyzer.js#L96`).
- **System prompt controller**  
  The system prompt endpoint pulls definitions from `shared/systemPrompts.js`, loads the script (if any), then reuses the router with a sanitized `intent` plus `systemInstruction`/`userPrompt` so the assistant sees the same script context as a regular chat message (`server/controllers/systemPromptController.js#L1`).

## 3. Prompt analysis script outline

When you need to replicate the server-side analysis flow outside of the UI, you can reuse the same building blocks:

```javascript
import { Chat } from '../server/controllers/chat/Chat.js';
import { ScriptManager } from '../server/controllers/scripts/ScriptManager.js';

async function runPromptAnalysis (userId, scriptId, prompt = 'Please analyze this script.') {
  const script = scriptId ? await new ScriptManager().getScript(scriptId) : null;
  const chat = new Chat(userId, scriptId);

  const enhancedContext = {
    scriptContent: script?.content || '',
    scriptTitle: script?.title || 'Untitled Script',
    scriptMetadata: {
      versionNumber: script?.versionNumber || 1,
      status: script?.status || 'Draft'
    },
    chainConfig: {
      shouldGenerateQuestions: false,
      modelConfig: { temperature: 0.2, response_format: { type: 'text' } }
    }
  };

  const result = await chat.processMessage(prompt, enhancedContext);
  console.log('Analysis response:', result.response);
  return result;
}
```

This mirrors `Chat.buildContext` and ultimately arrives at `ScriptAnalyzerChain` (see above). You can adapt the prompt, modelConfig, or history handling for experimentation without touching the UI paths.

## Next steps

- Keep `ScriptContextManager` and the client API in sync (all the metadata/statistics it exposes are eventually relied on by `SystemPromptOrchestrator` and the backend chains).
- When adding new prompt types, update both `shared/systemPrompts.js` and the router/chain pairing so the system instruction and script context stay consistent.
