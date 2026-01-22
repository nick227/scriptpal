# Testing Guide: Intent Confidence Gating & History De-duplication

## Quick Test Scenarios

### Test 1: Low Confidence Detection

```bash
# Terminal - Send ambiguous request
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -H "Cookie: session=your_session_cookie" \
  -d '{
    "prompt": "change it",
    "context": {
      "scriptId": 1
    }
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "intent": "CLARIFICATION_NEEDED",
  "confidence": 0.45,
  "needsClarification": true,
  "response": {
    "response": "I'm not quite sure what you'd like me to do with \"change it\". Could you be more specific?\n\nHere are some things I can help with:",
    "questions": [
      "Edit the script",
      "Continue writing the script",
      "Ask questions about the script",
      "Analyze the script",
      "Save a story element"
    ],
    "metadata": {
      "originalPrompt": "change it",
      "detectedIntent": "EVERYTHING_ELSE",
      "confidence": 0.45,
      "reason": "low_confidence"
    }
  }
}
```

### Test 2: High Confidence - Proceeds Normally

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -H "Cookie: session=your_session_cookie" \
  -d '{
    "prompt": "Edit line 5 to say Hello World",
    "context": {
      "scriptId": 1
    }
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "intent": "EDIT_SCRIPT",
  "confidence": 0.92,
  "scriptId": 1,
  "response": {
    "response": "I've updated line 5...",
    "questions": [...],
    "content": "..."
  }
}
```

### Test 3: Verify No Duplicate History

```sql
-- Run BEFORE sending message
SELECT COUNT(*) as before_count 
FROM chat_history 
WHERE user_id = 1;

-- Send a message via chat API (use Test 2 above)

-- Run AFTER sending message
SELECT COUNT(*) as after_count 
FROM chat_history 
WHERE user_id = 1;

-- Verify: after_count = before_count + 2 (exactly)
-- (1 user message + 1 assistant response)

-- Check for duplicates
SELECT 
  content,
  type,
  timestamp,
  COUNT(*) as duplicate_count
FROM chat_history
WHERE user_id = 1
  AND timestamp > DATE_SUB(NOW(), INTERVAL 1 MINUTE)
GROUP BY content, type, timestamp
HAVING duplicate_count > 1;

-- Expected: 0 rows (no duplicates)
```

## Comprehensive Test Suite

### Frontend Testing (Browser Console)

```javascript
// Test low confidence handling
async function testLowConfidence() {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      prompt: 'fix it',
      context: { scriptId: 1 }
    })
  });
  
  const data = await response.json();
  console.log('Low confidence test:', data);
  console.assert(data.needsClarification === true, 'Should ask for clarification');
  console.assert(data.confidence < 0.7, 'Confidence should be below threshold');
  console.assert(data.response.questions.length > 0, 'Should have suggestions');
}

// Test high confidence proceeding
async function testHighConfidence() {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      prompt: 'Analyze the script structure and pacing',
      context: { scriptId: 1 }
    })
  });
  
  const data = await response.json();
  console.log('High confidence test:', data);
  console.assert(data.intent === 'ANALYZE_SCRIPT', 'Should detect correct intent');
  console.assert(data.confidence >= 0.7, 'Confidence should be above threshold');
  console.assert(!data.needsClarification, 'Should not ask for clarification');
}

// Run tests
testLowConfidence();
testHighConfidence();
```

### Backend Testing (Jest)

Create `server/__tests__/intent-confidence.test.js`:

```javascript
import { Chat } from '../controllers/chat/Chat.js';
import { INTENT_CONFIDENCE } from '../controllers/langchain/constants.js';

describe('Intent Confidence Gating', () => {
  let chat;
  
  beforeEach(() => {
    chat = new Chat(1, 100);
  });

  test('should return clarification for low confidence', async () => {
    // Mock low confidence classification
    chat.classifier.classify = jest.fn().mockResolvedValue({
      intent: 'EVERYTHING_ELSE',
      confidence: 0.4, // Below threshold
      target: null,
      value: null
    });

    const result = await chat.processMessage('change it', {});

    expect(result.needsClarification).toBe(true);
    expect(result.intent).toBe('CLARIFICATION_NEEDED');
    expect(result.response.questions).toBeDefined();
    expect(result.response.questions.length).toBeGreaterThan(0);
  });

  test('should proceed normally for high confidence', async () => {
    // Mock high confidence classification
    chat.classifier.classify = jest.fn().mockResolvedValue({
      intent: 'EDIT_SCRIPT',
      confidence: 0.92, // Above threshold
      target: null,
      value: null
    });

    chat.scriptManager.getScript = jest.fn().mockResolvedValue({
      id: 100,
      content: 'test content',
      title: 'Test Script'
    });

    const result = await chat.processMessage('Edit line 5', {});

    expect(result.needsClarification).toBeUndefined();
    expect(result.intent).toBe('EDIT_SCRIPT');
  });

  test('should use correct threshold from constants', () => {
    expect(INTENT_CONFIDENCE.THRESHOLD).toBe(0.7);
    expect(INTENT_CONFIDENCE.HIGH).toBe(0.85);
    expect(INTENT_CONFIDENCE.LOW).toBe(0.5);
  });
});
```

### History De-duplication Test

Create `server/__tests__/history-deduplication.test.js`:

```javascript
import db from '../db/index.js';
import { Chat } from '../controllers/chat/Chat.js';

describe('Chat History De-duplication', () => {
  let chat;
  let initialCount;

  beforeEach(async () => {
    chat = new Chat(1, 100);
    const [result] = await db.query(
      'SELECT COUNT(*) as count FROM chat_history WHERE user_id = 1'
    );
    initialCount = result[0].count;
  });

  test('should write exactly 2 entries per message', async () => {
    // Mock successful chat interaction
    chat.classifier.classify = jest.fn().mockResolvedValue({
      intent: 'SCRIPT_QUESTIONS',
      confidence: 0.85
    });

    chat.scriptManager.getScript = jest.fn().mockResolvedValue({
      content: 'test',
      title: 'Test'
    });

    await chat.processMessage('Tell me about my script', {});

    // Wait for async history save
    await new Promise(resolve => setTimeout(resolve, 1000));

    const [result] = await db.query(
      'SELECT COUNT(*) as count FROM chat_history WHERE user_id = 1'
    );
    const newCount = result[0].count;

    expect(newCount - initialCount).toBe(2); // Exactly 2 new entries
  });

  test('should not create duplicates', async () => {
    const testContent = `TEST_UNIQUE_${Date.now()}`;

    await chat.historyManager.saveInteraction(
      testContent,
      'Test response',
      100
    );

    // Check for duplicates
    const [result] = await db.query(
      `SELECT COUNT(*) as count 
       FROM chat_history 
       WHERE content = ? 
       AND user_id = 1`,
      [testContent]
    );

    expect(result[0].count).toBe(1); // Should appear exactly once
  });
});
```

## Monitoring Queries

### Check Confidence Score Distribution

```sql
-- Add this to your logging, then query logs
-- This is a sample query structure
SELECT 
  CASE 
    WHEN confidence >= 0.85 THEN 'HIGH (>= 0.85)'
    WHEN confidence >= 0.7 THEN 'MEDIUM (0.7-0.85)'
    ELSE 'LOW (< 0.7)'
  END as confidence_level,
  COUNT(*) as message_count,
  ROUND(AVG(confidence), 3) as avg_confidence
FROM chat_logs
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
GROUP BY confidence_level;
```

### Detect Any Remaining Duplicates

```sql
-- Run daily to catch any edge cases
SELECT 
  user_id,
  content,
  type,
  DATE(timestamp) as day,
  COUNT(*) as occurrences,
  GROUP_CONCAT(id) as entry_ids
FROM chat_history
WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY)
GROUP BY user_id, content, type, day
HAVING occurrences > 1
ORDER BY occurrences DESC, day DESC;
```

### Track Clarification Requests

```sql
-- Create a logging table
CREATE TABLE IF NOT EXISTS chat_metrics (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  original_prompt TEXT,
  intent VARCHAR(50),
  confidence DECIMAL(3,2),
  needed_clarification BOOLEAN,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_timestamp (timestamp),
  INDEX idx_clarification (needed_clarification)
);

-- Daily summary query
SELECT 
  DATE(timestamp) as date,
  COUNT(*) as total_messages,
  SUM(needed_clarification) as clarification_count,
  ROUND(AVG(confidence), 3) as avg_confidence,
  ROUND(SUM(needed_clarification) * 100.0 / COUNT(*), 2) as clarification_rate_percent
FROM chat_metrics
WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY)
GROUP BY DATE(timestamp)
ORDER BY date DESC;
```

## Performance Benchmarks

```javascript
// Add to server code for benchmarking
import { performance } from 'perf_hooks';

async function benchmarkChatProcessing() {
  const iterations = 100;
  const results = {
    lowConfidence: [],
    highConfidence: [],
    historyWrites: []
  };

  // Test low confidence path
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await testLowConfidenceMessage();
    results.lowConfidence.push(performance.now() - start);
  }

  // Test high confidence path  
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await testHighConfidenceMessage();
    results.highConfidence.push(performance.now() - start);
  }

  console.log('Benchmark Results:');
  console.log('Low Confidence Avg:', average(results.lowConfidence), 'ms');
  console.log('High Confidence Avg:', average(results.highConfidence), 'ms');
  console.log('Speedup from early rejection:', 
    (average(results.highConfidence) / average(results.lowConfidence)).toFixed(2) + 'x'
  );
}
```

## Expected Output Examples

### Console Logs (Low Confidence)

```
=== Starting Chat Processing ===
Processing message: { prompt: 'fix it', userId: 1, scriptId: 100 }
Intent classification: { intent: 'EVERYTHING_ELSE', confidence: 0.42 }
Low confidence detected: {
  confidence: 0.42,
  threshold: 0.7,
  intent: 'EVERYTHING_ELSE'
}
Handling low confidence intent: {
  prompt: 'fix it',
  detectedIntent: 'EVERYTHING_ELSE',
  confidence: 0.42
}
=== Operation Complete ===
```

### Console Logs (High Confidence)

```
=== Starting Chat Processing ===
Processing message: { prompt: 'Edit line 5 to say hello', userId: 1, scriptId: 100 }
Intent classification: { intent: 'EDIT_SCRIPT', confidence: 0.94 }
Script Details: { id: 100, content: '...', title: 'My Script' }
ChainHandler.execute called with: { scriptId: 100, intent: 'EDIT_SCRIPT' }
API call completed successfully
=== Operation Complete ===
```

## Success Indicators

✅ **Confidence Gating Working:**
- Ambiguous prompts return `needsClarification: true`
- Clear prompts proceed to chain execution
- No OpenAI API calls for clarification responses

✅ **History De-duplication Working:**
- Exactly 2 database entries per conversation turn
- Zero duplicate content entries
- BaseChain no longer logs to history

✅ **Performance Improved:**
- Faster response times for low-confidence rejections
- 50% reduction in database writes
- Lower API costs overall
