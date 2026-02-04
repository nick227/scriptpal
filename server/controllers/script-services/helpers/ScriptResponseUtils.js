export const extractChainResponse = (response) => {
  const payload = response?.response || response;
  const baseText = typeof payload === 'string'
    ? payload
    : payload?.message ?? payload?.script ?? payload?.response ?? '';
  const formattedScript = typeof payload === 'string'
    ? payload
    : payload?.script ?? baseText;
  const assistantResponse = typeof payload === 'string'
    ? payload
    : payload?.message ?? baseText;
  return {
    responseText: baseText,
    formattedScript,
    assistantResponse
  };
};
