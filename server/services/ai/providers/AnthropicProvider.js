/* global fetch */
import { BaseAIProvider } from './BaseAIProvider.js';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_MODELS_URL = 'https://api.anthropic.com/v1/models';
const ANTHROPIC_VERSION = '2023-06-01';

const buildAnthropicPayload = (params, config) => {
  const systemMessages = params.messages.filter(message => message.role === 'system');
  const conversation = params.messages
    .filter(message => message.role !== 'system')
    .map(message => ({
      role: message.role,
      content: message.content
    }));

  const systemPrompt = systemMessages.map(message => message.content).join('\n\n');
  const payload = {
    model: config.model,
    max_tokens: config.maxTokens,
    temperature: config.temperature,
    messages: conversation
  };

  if (systemPrompt) {
    payload.system = systemPrompt;
  }

  return payload;
};

const extractTextContent = (content) => {
  return content
    .filter(item => item.type === 'text')
    .map(item => item.text)
    .join('');
};

export class AnthropicProvider extends BaseAIProvider {
  getProviderName() {
    return 'anthropic';
  }

  async healthCheck() {
    const response = await fetch(ANTHROPIC_MODELS_URL, {
      method: 'GET',
      headers: {
        'x-api-key': this.config.apiKey,
        'anthropic-version': ANTHROPIC_VERSION
      }
    });
    if (!response.ok) {
      return false;
    }
    const payload = await response.json();
    return Array.isArray(payload.data);
  }

  async createCompletion(params) {
    const payload = buildAnthropicPayload(params, this.config);
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': ANTHROPIC_VERSION
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      const error = new Error('Anthropic API error');
      error.status = response.status;
      error.message = errorText || error.message;
      throw error;
    }

    return response.json();
  }

  getUsage(completion) {
    const { usage } = completion;
    const promptTokens = Number(usage.input_tokens);
    const completionTokens = Number(usage.output_tokens);
    const totalTokens = Number(promptTokens + completionTokens);
    return {
      promptTokens,
      completionTokens,
      totalTokens
    };
  }

  normalizeResponse(response) {
    const { content, usage } = response;
    const responseContent = extractTextContent(content);
    return {
      choices: [{
        message: {
          content: responseContent
        }
      }],
      usage: {
        prompt_tokens: usage.input_tokens,
        completion_tokens: usage.output_tokens,
        total_tokens: usage.input_tokens + usage.output_tokens
      },
      raw: response
    };
  }
}
