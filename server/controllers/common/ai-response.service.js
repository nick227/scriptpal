/**
 * Normalize AI response to canonical shape (v2 - no legacy aliases).
 * Extracts message and script from canonical fields only.
 */
const extractField = (payload, field) => {
  if (!payload) return null;

  if (typeof payload === 'string') {
    return field === 'message' ? payload : null;
  }

  if (payload[field]) {
    return payload[field];
  }

  if (payload.response) {
    return extractField(payload.response, field);
  }

  return null;
};

const extractMetadata = (payload) => {
  if (!payload || typeof payload !== 'object') {
    return {};
  }

  const direct = payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {};
  const nested = payload.response && typeof payload.response === 'object'
    ? extractMetadata(payload.response)
    : {};

  return { ...nested, ...direct };
};

export const normalizeAiResponse = (response) => {
  if (!response) return { message: null, script: null, metadata: {} };

  if (typeof response === 'string') {
    return { message: response, script: null, metadata: {} };
  }

  if (typeof response === 'object') {
    const message = extractField(response, 'message');
    const script = extractField(response, 'script');
    const metadata = extractMetadata(response);

    return {
      message,
      script,
      metadata,
      type: response.type
    };
  }

  return { message: null, script: null, metadata: {} };
};

/**
 * Build canonical API response (v2 - no legacy aliases).
 * 
 * CANONICAL SHAPE:
 *   response.message  → chat display
 *   response.script   → editor content
 *   response.metadata → additional info
 */
export const buildAiResponse = ({
  intentResult,
  intent,
  scriptId,
  scriptTitle,
  response,
  result,
  mode,
  validation,
  metadata
}) => {
  const normalized = normalizeAiResponse(response || result);
  
  const resolvedTitle = scriptTitle ||
    normalized.metadata?.scriptTitle ||
    'Untitled Script';
  const resolvedIntent = intentResult ? intentResult.intent : intent;
  const resolvedMode = mode || normalized.metadata?.generationMode || null;
  const resolvedValidation = validation || normalized.metadata?.contractValidation || null;

  // CANONICAL RESPONSE SHAPE (v2 - no legacy aliases)
  return {
    success: true,
    intent: resolvedIntent,
    confidence: intentResult ? intentResult.confidence : null,
    target: intentResult ? intentResult.target : null,
    value: intentResult ? intentResult.value : null,
    scriptId,
    scriptTitle: resolvedTitle,
    timestamp: new Date().toISOString(),
    mode: resolvedMode,
    validation: resolvedValidation,
    metadata: metadata || null,
    response: {
      message: normalized.message,
      script: normalized.script,
      metadata: normalized.metadata,
      type: normalized.type
    }
  };
};

export const createIntentResult = (intent) => ({
  intent,
  confidence: 1,
  target: null,
  value: null
});
