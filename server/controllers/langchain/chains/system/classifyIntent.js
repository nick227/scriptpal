import { ai } from '../../../../lib/ai.js';
import { INTENT_TYPES, INTENT_DESCRIPTIONS } from '../../constants.js';
import { chainRegistry } from '../registry.js';

let registeredIntents = Object.values(INTENT_TYPES);
let intentDescriptions = '';

function refreshIntentDescriptions() {
  try {
    const registryIntents = chainRegistry.getRegisteredIntents();
    if (!registryIntents || !Array.isArray(registryIntents)) {
      console.error('Invalid registry intents:', registryIntents);
      return;
    }

    registeredIntents = [...new Set([...Object.values(INTENT_TYPES), ...registryIntents])]
      .filter(intent => intent && typeof intent === 'string')
      .map(intent => intent.toUpperCase());

    intentDescriptions = registeredIntents
      .map(intent => {
        const description = INTENT_DESCRIPTIONS[intent] || 'No description available';
        return `${intent}: ${description}`;
      })
      .join('\n');

  } catch (error) {
    console.error('Error refreshing intent descriptions:', error);
  }
}

function processResponse(intent) {
  try {
    refreshIntentDescriptions();

    if (!intent || typeof intent !== 'string') {
      console.error('Invalid response format:', intent);
      return defaultResponse('Invalid response format');
    }

    const normalizedIntent = (intent || '').toUpperCase();
    if (!normalizedIntent) {
      console.error('Missing intent in response');
      return defaultResponse('Missing intent in response');
    }

    if (!registeredIntents.includes(normalizedIntent)) {
      console.log(`Invalid intent ${normalizedIntent}, defaulting to EVERYTHING_ELSE`);
      return defaultResponse(`Invalid intent: ${normalizedIntent}`);
    }

    return {
      intent: normalizedIntent,
      confidence: 1.0,
      target: null,
      value: null
    };

  } catch (error) {
    console.error('Intent classification error:', error);
    return defaultResponse(error.message);
  }
}

function defaultResponse(reason = 'Unknown error') {
  return {
    intent: INTENT_TYPES.EVERYTHING_ELSE,
    confidence: 0.5,
    target: null,
    value: null,
    reason
  };
}

export async function classifyIntent(input) {
  if (!input) {
    console.error('Empty input provided to classifyIntent');
    return defaultResponse('Empty input');
  }

  const processedInput = typeof input === 'string' ? input : JSON.stringify(input);

  try {
    refreshIntentDescriptions();

    // Dynamically build prompt to include current intents
    const systemPrompt = `You are an intent classifier for a script writing assistant.
Your job is to classify the user prompt into one of the available commands.

AVAILABLE INTENTS:
${intentDescriptions}

INSTRUCTIONS:
- Analyze the user prompt below
- Classify it into exactly one of the above intents
- Return the intent string ONLY (e.g. "EDIT_SCRIPT")
- Do not include any explanation or extra text`;

    const result = await ai.generateCompletion({
      model: 'gpt-4-turbo-preview',
      temperature: 0.3,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: processedInput }
      ]
    });

    if (!result.success) {
      throw new Error(result.error.message);
    }

    const intent = result.data.choices[0].message.content.trim();
    console.log('Final Intent Classification:', intent);
    
    return processResponse(intent);

  } catch (error) {
    console.error('Intent classification error:', error);
    return defaultResponse(error.message);
  }
}
