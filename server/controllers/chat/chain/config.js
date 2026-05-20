export const buildChatChainConfig = () => ({
  shouldGenerateQuestions: false,
  modelConfig: {
    temperature: 0.7,
    response_format: { type: 'text' }
  }
});

export const buildNextFiveLinesChainConfig = () => ({
  shouldGenerateQuestions: false,
  maxAttempts: 3,
  modelConfig: {
    temperature: 0.4
  }
});
