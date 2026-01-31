export const buildChatChainConfig = () => ({
  shouldGenerateQuestions: true,
  modelConfig: {
    temperature: 0.7,
    response_format: { type: 'text' }
  }
});

export const buildNextFiveLinesChainConfig = () => ({
  shouldGenerateQuestions: false,
  modelConfig: {
    temperature: 0.3,
    response_format: { type: 'json_object' }
  }
});
