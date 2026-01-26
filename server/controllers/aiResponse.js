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

export const buildAiResponse = ({ intentResult, scriptId, scriptTitle, response }) => {
  const normalizedResponse = normalizeAiResponse(response);
  const resolvedTitle = scriptTitle ||
    (normalizedResponse && normalizedResponse.metadata && normalizedResponse.metadata.scriptTitle) ||
    (normalizedResponse && normalizedResponse.title) ||
    'Untitled Script';

  return {
    success: true,
    intent: intentResult.intent,
    confidence: intentResult.confidence,
    target: intentResult.target,
    value: intentResult.value,
    scriptId,
    scriptTitle: resolvedTitle,
    timestamp: new Date().toISOString(),
    response: normalizedResponse
  };
};

export const createIntentResult = (intent) => ({
  intent,
  confidence: 1,
  target: null,
  value: null
});
