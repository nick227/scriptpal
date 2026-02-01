import { OpenAIProvider } from './OpenAIProvider.js';
import { AnthropicProvider } from './AnthropicProvider.js';

export const createProvider = (providerName, config, logger) => {
  if (!providerName) {
    throw new Error('AI provider name is required');
  }
  if (!config) {
    throw new Error(`Missing configuration for provider: ${providerName}`);
  }

  if (providerName === 'openai') {
    return new OpenAIProvider(config, logger);
  }
  if (providerName === 'anthropic') {
    return new AnthropicProvider(config, logger);
  }

  throw new Error(`Unsupported AI provider: ${providerName}`);
};
