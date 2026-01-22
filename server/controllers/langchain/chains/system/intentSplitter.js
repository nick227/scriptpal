import { ai } from '../../../../lib/ai.js';
import { CHAIN_CONFIG, ERROR_TYPES } from '../../constants.js';

/**
 * Validates the split intents
 */
function validateSplitIntents(result) {
  if (!result || !Array.isArray(result.intents)) {
    throw new Error(ERROR_TYPES.INVALID_FORMAT);
  }

  // Validate each intent has required fields
  result.intents.forEach(intent => {
    if (!intent.prompt || intent.order === undefined) {
      throw new Error(ERROR_TYPES.MISSING_REQUIRED);
    }
  });

  return result;
}

/**
 * Splits a multi-intent request into individual intents
 */
export async function splitIntent(input) {
  try {
    const systemPrompt = `You are an AI script writing assistant. The user has provided a request with multiple intents.
Break down their request into separate, individual intents that can be processed independently.

For each intent, provide:
1. The specific request
2. Any relevant context
3. The order of operations

Return ONLY a JSON object in this exact format:

{
    "intents": [
        {
            "prompt": "the specific request",
            "context": "relevant contextual information",
            "order": number,
            "depends_on": [array of order numbers this intent depends on]
        }
    ]
}`;

    // Get split intents from AIClient
    const result = await ai.generateCompletion({
      model: CHAIN_CONFIG.MODEL,
      temperature: CHAIN_CONFIG.TEMPERATURE,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `User Input: ${input}` }
      ]
    });

    if (!result.success) {
      throw new Error(`AI completion failed: ${result.error.message}`);
    }

    const content = result.data.choices[0].message.content;
    const splitIntents = JSON.parse(content);
    
    return validateSplitIntents(splitIntents);

  } catch (error) {
    console.error('Intent splitting error:', error);
    throw new Error(ERROR_TYPES.CHAIN_ERROR);
  }
}
