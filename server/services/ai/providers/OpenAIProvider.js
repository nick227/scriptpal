import OpenAI from 'openai';
import { BaseAIProvider } from './BaseAIProvider.js';

export class OpenAIProvider extends BaseAIProvider {
  constructor(config, logger) {
    super(config, logger);
    this.client = new OpenAI({
      apiKey: this.config.apiKey,
      timeout: this.config.timeout,
      maxRetries: this.config.maxRetries
    });
  }

  getProviderName() {
    return 'openai';
  }

  async healthCheck() {
    const response = await this.client.models.list();
    return Array.isArray(response.data);
  }

  async createCompletion(params) {
    const { model, maxTokens, temperature } = this.config;
    const { messages } = params;
    return this.client.chat.completions.create({
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
      ...params
    });
  }

  getUsage(completion) {
    const { usage } = completion;
    const promptTokens = Number(usage.prompt_tokens);
    const completionTokens = Number(usage.completion_tokens);
    const totalTokens = Number(usage.total_tokens);
    return {
      promptTokens,
      completionTokens,
      totalTokens
    };
  }
}
