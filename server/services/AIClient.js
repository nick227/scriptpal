import config from '../config/index.js';
import { logger } from '../utils/logger.js';
import { CostCalculator } from './ai/cost/CostCalculator.js';
import { ScriptAIService } from './ai/domain/ScriptAIService.js';
import { AIMetricsTracker } from './ai/metrics/AIMetricsTracker.js';
import { createProvider } from './ai/providers/ProviderFactory.js';

export class AIClient {
  constructor(_options = {}) {
    this.aiConfig = _options.aiConfig || config.getAIConfig();
    this.logger = logger.child({ context: 'AIClient' });
    this.providerName = _options.provider || this.aiConfig.provider;
    this.providerConfig = this.aiConfig.providers[this.providerName];
    if (!this.providerConfig) {
      throw new Error(`Unknown AI provider: ${this.providerName}`);
    }
    this.provider = _options.providerInstance || createProvider(this.providerName, this.providerConfig, this.logger);
    this.metricsTracker = new AIMetricsTracker();
    this.metrics = this.metricsTracker.metrics;
    this.costCalculator = new CostCalculator(this.aiConfig.pricing, this.logger);
    this.scriptService = new ScriptAIService(this);
  }

  async healthCheck() {
    try {
      const response = await this.provider.healthCheck();
      return Boolean(response);
    } catch (error) {
      this.logger.error('AI health check failed', { error: error.message });
      return false;
    }
  }

  async generateCompletion(params, options = {}) {
    const startTime = Date.now();
    const maxRetries = options.maxRetries || this.providerConfig.maxRetries;
    const retryDelay = options.retryDelay || 1000;
    const chatRequestId = options.chatRequestId;
    let lastError;

    this.metricsTracker.markRequestStart();

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const completion = await this.provider.createCompletion(params);
        const normalized = this.provider.normalizeResponse(completion);

        const responseTime = Date.now() - startTime;
        const usage = this.provider.getUsage(completion);
        const promptTokens = usage ? usage.promptTokens : 0;
        const completionTokens = usage ? usage.completionTokens : 0;
        const costUsd = this.costCalculator.calculate({
          provider: this.providerName,
          model: this.provider.getModel(),
          promptTokens,
          completionTokens
        });
        this.metricsTracker.trackSuccess({ usage, costUsd, responseTime });

        this.logger.info('AI completion successful', {
          model: this.provider.getModel(),
          tokens: usage.totalTokens,
          responseTime,
          attempt,
          chatRequestId
        });

        return {
          success: true,
          data: normalized,
          metrics: {
            tokens: usage.totalTokens,
            cost: costUsd,
            responseTime
          }
        };

      } catch (error) {
        lastError = error;
        const isRetryable = this._isRetryableError(error);

        this.logger.warn('AI completion failed', {
          error: error.message,
          attempt,
          maxRetries,
          isRetryable,
          model: this.provider.getModel(),
          chatRequestId
        });

        if (isRetryable && attempt < maxRetries) {
          const delay = retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
          await this._sleep(delay);
          continue;
        }

        // Non-retryable error or max retries reached
        const responseTime = Date.now() - startTime;
        this.metricsTracker.trackFailure({ responseTime, attempts: attempt });

        return {
          success: false,
          error: this._mapError(error),
          metrics: {
            tokens: 0,
            cost: 0,
            responseTime
          }
        };
      }
    }
    return {
      success: false,
      error: this._mapError(lastError),
      metrics: {
        tokens: 0,
        cost: 0,
        responseTime: Date.now() - startTime
      }
    };
  }

  analyzeScript(scriptContent, options = {}) {
    return this.scriptService.analyzeScript(scriptContent, options);
  }

  generateSuggestions(scriptContent, prompt, options = {}) {
    return this.scriptService.generateSuggestions(scriptContent, prompt, options);
  }

  generateEdits(scriptContent, editRequest, options = {}) {
    return this.scriptService.generateEdits(scriptContent, editRequest, options);
  }

  _isRetryableError(error) {
    const retryableErrors = [
      'ECONNRESET',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'ENOTFOUND',
      'ECONNABORTED'
    ];

    const retryableStatusCodes = [429, 500, 502, 503, 504];
    const status = error.status ||
      error.statusCode ||
      (error.response && error.response.status);

    return retryableErrors.some(code => error.code === code) ||
               retryableStatusCodes.includes(status);
  }

  _mapError(error) {
    const errorMap = {
      400: 'Invalid request parameters',
      401: 'Invalid API key',
      403: 'Access forbidden',
      404: 'Model not found',
      429: 'Rate limit exceeded',
      500: 'Internal server error',
      502: 'Bad gateway',
      503: 'Service unavailable',
      504: 'Gateway timeout'
    };

    return {
      code: error.code || error.status,
      message: errorMap[error.status] || error.message || 'Unknown error',
      type: error.type || 'api_error',
      originalError: error.message
    };
  }

  _sleep(ms) {
    return new Promise(resolve => {
      setTimeout(resolve, ms);
    });
  }

  getMetrics() {
    return this.metricsTracker.getMetrics();
  }

  resetMetrics() {
    this.metricsTracker.reset();
    this.metrics = this.metricsTracker.metrics;
  }

  getConfig() {
    return {
      provider: this.providerName,
      model: this.provider.getModel(),
      maxTokens: this.providerConfig.maxTokens,
      temperature: this.providerConfig.temperature,
      timeout: this.providerConfig.timeout,
      maxRetries: this.providerConfig.maxRetries
    };
  }
}

export class AIClientFactory {
  static create(options = {}) {
    return new AIClient(options);
  }
}

export default AIClient;
