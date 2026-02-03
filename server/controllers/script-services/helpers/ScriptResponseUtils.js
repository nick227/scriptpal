export const extractChainResponse = (response) => {
  const responseText = response?.response || response;
  const formattedScript = response?.metadata?.formattedScript || responseText;
  const assistantResponse = response?.assistantResponse || responseText;
  return {
    responseText,
    formattedScript,
    assistantResponse
  };
};
