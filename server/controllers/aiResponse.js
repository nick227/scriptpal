export const normalizeAiResponse = (response) => {
  if (typeof response === 'string') {
    return { content: response };
  }

  if (response && typeof response === 'object') {
    if (Object.prototype.hasOwnProperty.call(response, 'content')) {
      return response;
    }

    if (Object.prototype.hasOwnProperty.call(response, 'response')) {
      const { response: content, ...rest } = response;
      return { content, ...rest };
    }
  }

  return response;
};

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
  const normalizedResponse = normalizeAiResponse(response || result);
  const resolvedTitle = scriptTitle ||
    (normalizedResponse && normalizedResponse.metadata && normalizedResponse.metadata.scriptTitle) ||
    (normalizedResponse && normalizedResponse.title) ||
    'Untitled Script';
  const resolvedIntent = intentResult ? intentResult.intent : intent;
  const resolvedMode = mode || normalizedResponse?.metadata?.generationMode || null;
  const resolvedValidation = validation || normalizedResponse?.metadata?.contractValidation || null;

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
    result: normalizedResponse,
    response: normalizedResponse
  };
};

export const createIntentResult = (intent) => ({
  intent,
  confidence: 1,
  target: null,
  value: null
});
