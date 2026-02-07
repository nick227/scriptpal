# Chat Architectural Roadmap

Remaining simplification and naming cleanup (not redesign). System is stable.

---

## 1. Dual Message Identity Fields

**Smell:** `role` and `type` always mirror each other (`'user' | 'assistant'`).

**Risk:** Drift if one side changes; extra logic in `determineMessageType`.

**Recommendation:** Pick `role` as canonical. Treat `type` as deprecated output-only until removed. Update client to use `role` only.

---

## 2. History Query Semantics

**Smell:** `listByUser(userId, scriptId, limit, offset)` — name implies per-user history, but it's script conversation history.

**Risk:** Future dev assumes per-user scoping; bugs in collaborative scripts later.

**Recommendation:** Rename to `listByScript(scriptId, limit, offset)`. Internally still filter by `userId` if needed for auth.

---

## 3. Two Persistence Paths

**Smell:** BaseChain.execute saves directly, OR chain.persistAssistantMessage saves. Two code paths.

**Risk:** Slight schema divergence over time; serializer assumptions break.

**Recommendation:** Single write gateway:
```js
ChatMessageRepository.saveExchange({
  userPrompt,
  assistantContent,
  metadata
})
```
Everything funnels through this. BaseChain and chains call it.

---

## 4. Serializer Legacy Interpretation

**Smell:** `normalizeContent` does `JSON.parse(content)` and uses `parsed.response`.

**Risk:** Hides corruption; makes debugging harder; serializer should not interpret historical formats.

**Recommendation:** Move legacy normalization to a migration script or one-time repair job. Serializer becomes dumb: `content: string`, `metadata: object | null`.

---

## Canonical Contract (Target)

```ts
type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  scriptId: number
  metadata?: object
  intent?: string
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
  costUsd?: number
}
```

No `type`. No polymorphic content.

---

## Canonical Server Response Shapes (Target)

**startChat:**
```js
{
  success: true,
  response: Message,     // newest assistant message
  history: Message[],    // chronological
  intent, metadata
}
```

**addChatMessage:**
```js
{
  history: Message[]     // Stop returning "messages"
}
```

**system-prompts:**
```js
{
  success: true,
  response: Message
}
```

---

## Client Consumption Rule (Simple)

```js
if (data.history) appendServerMessages(data.history)
else if (data.response) renderMessage(data.response)
```

Nothing else.

---

## Contract Test

`server/__tests__/contracts/chatMessageContract.test.js` — validates message shape against `MESSAGE_CONTRACT`. Prevents silent drift.
