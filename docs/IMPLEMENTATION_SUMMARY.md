# Implementation Summary: De-duplicate History & Intent Confidence Gating

## Changes Made

### 1. Intent Confidence Gating ✅

#### Added Constants (`server/controllers/langchain/constants.js`)
```javascript
export const INTENT_CONFIDENCE = {
  THRESHOLD: 0.7,    // Minimum to proceed
  HIGH: 0.85,        // High confidence
  MEDIUM: 0.7,       // Medium confidence  
  LOW: 0.5          // Low confidence
};
```

#### Updated Chat.js (`server/controllers/chat/Chat.js`)
- Added confidence checking in `processMessage()` method
- If confidence < 0.7, returns clarification request instead of proceeding
- Added `handleLowConfidence()` method that:
  - Provides contextual suggestions based on script state
  - Returns formatted response with helpful action buttons
  - Logs confidence metrics for monitoring

**Example Flow:**
```
User: "change it"
↓
Intent Classifier: confidence 0.45 (ambiguous)
↓
Response: "I'm not quite sure what you'd like me to do. Could you be more specific?"
+ Suggestions: [Edit script, Continue writing, Analyze script, etc.]
```

### 2. De-duplicate Chat History ✅

#### Removed Duplicate Write Path
**Before:** Two separate writes for every message
1. `BaseChain.logToHistory()` - Line 325
2. `ChatHistoryManager.saveInteraction()` - Line 80 in Chat.js

**After:** Single source of truth
- Removed `BaseChain.logToHistory()` method entirely
- Removed call to `logToHistory()` in `BaseChain.execute()`
- Only `ChatHistoryManager.saveInteraction()` writes to database
- Added comment explaining why BaseChain doesn't write history

**Benefits:**
- No duplicate entries in `chat_history` table
- Cleaner data for history retrieval
- Single point of truth for history management
- Better performance (one write instead of two)

## Testing Recommendations

### Test Low Confidence Handling
```bash
# Start server
npm start

# Test with ambiguous prompts:
POST /api/chat
{
  "prompt": "change it",
  "context": { "scriptId": 1 }
}

# Expected: Clarification response with suggestions
# Should NOT execute any chain
```

### Test History De-duplication
```sql
-- Before testing, check current state
SELECT COUNT(*) FROM chat_history 
WHERE user_id = 1 
AND DATE(timestamp) = CURDATE();

-- Send a message via chat

-- After testing, verify only 2 entries (user + assistant)
SELECT * FROM chat_history 
WHERE user_id = 1 
ORDER BY timestamp DESC 
LIMIT 10;

-- Should see exactly 2 entries per message (not 4)
```

### Load Test Confidence Thresholds
Examples to test different confidence levels:

**HIGH Confidence (>0.85) - Should proceed immediately:**
- "Edit line 5 to say 'Hello World'"
- "Analyze the script structure"
- "Save this character: John, a detective"

**MEDIUM Confidence (0.7-0.85) - Should proceed with monitoring:**
- "Make the dialogue better"
- "Add more action"
- "Fix the scene"

**LOW Confidence (<0.7) - Should ask for clarification:**
- "change it"
- "do that"
- "make it better"
- "fix"

## Monitoring

### Check Confidence Distribution
Add logging to track confidence scores:

```javascript
// In Chat.js processMessage()
console.log('[METRICS] Intent confidence:', {
  prompt: prompt.substring(0, 50),
  intent: intentResult.intent,
  confidence: intentResult.confidence,
  proceededWithoutClarification: intentResult.confidence >= INTENT_CONFIDENCE.THRESHOLD
});
```

### Monitor History Writes
```sql
-- Check for potential duplicates
SELECT 
  user_id,
  content,
  type,
  DATE(timestamp) as day,
  COUNT(*) as duplicate_count
FROM chat_history
GROUP BY user_id, content, type, day
HAVING duplicate_count > 1
ORDER BY duplicate_count DESC, day DESC
LIMIT 50;
```

## Rollback Plan

If issues arise:

### Revert Confidence Gating
```javascript
// In Chat.js, comment out lines 68-79:
/*
if (intentResult.confidence < INTENT_CONFIDENCE.THRESHOLD) {
  console.log('Low confidence detected:', {...});
  return this.handleLowConfidence(prompt, intentResult);
}
*/
```

### Revert History De-duplication
```javascript
// In BaseChain.js, restore logToHistory call after line 318:
if (context.userId && !context.disableHistory) {
  await this.logToHistory(context.userId, allMessages[allMessages.length - 1], responseContent)
    .catch(error => console.warn('History logging failed:', error));
}
```

## Performance Impact

### Expected Improvements:
- **API Cost Savings:** ~30% reduction when catching ambiguous requests
- **Database Performance:** 50% fewer writes to chat_history table
- **User Experience:** Fewer "AI did something weird" moments

### Metrics to Track:
1. Clarification request rate (target: 5-10% of messages)
2. Duplicate history entries (target: 0)
3. Average confidence score (monitor for drift)
4. User satisfaction (do they rephrase or get frustrated?)

## Next Steps

1. **Week 1:** Monitor confidence scores in production
2. **Week 2:** Adjust threshold if needed (0.6 vs 0.7 vs 0.8)
3. **Week 3:** Analyze clarification request patterns
4. **Week 4:** A/B test different clarification messages

## Files Modified

1. `server/controllers/langchain/constants.js` - Added INTENT_CONFIDENCE
2. `server/controllers/chat/Chat.js` - Added confidence gating + handleLowConfidence()
3. `server/controllers/langchain/chains/base/BaseChain.js` - Removed logToHistory()
