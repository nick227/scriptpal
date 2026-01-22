import OpenAI from 'openai';
import config from '../config/index.js';
import { logger } from '../utils/logger.js';

/**
 * Enhanced AI Client with error handling, retries, and monitoring
 */
export class AIClient {
  constructor(_options = {}) {
    this.aiConfig = config.getAIConfig();
    this.logger = logger.child({ context: 'AIClient' });

    // Initialize OpenAI client
    this.client = new OpenAI({
      apiKey: this.aiConfig.apiKey,
      timeout: this.aiConfig.timeout,
      maxRetries: this.aiConfig.maxRetries
    });

    // Metrics tracking
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalTokens: 0,
      totalCost: 0,
      averageResponseTime: 0,
      lastRequestTime: null
    };

    this.responseTimes = [];
    this.maxResponseTimeHistory = 100;
  }

  /**
     * Perform health check
     * @returns {Promise<boolean>} - Whether AI service is healthy
     */
  async healthCheck() {
    try {
      const response = await this.client.models.list();
      return Array.isArray(response.data);
    } catch (error) {
      this.logger.error('AI health check failed', { error: error.message });
      return false;
    }
  }

  /**
     * Generate completion with retry logic
     * @param {Object} params - Completion parameters
     * @param {Object} options - Request options
     * @returns {Promise<Object>} - Completion result
     */
  async generateCompletion(params, options = {}) {
    const startTime = Date.now();
    const maxRetries = options.maxRetries || this.aiConfig.maxRetries;
    const retryDelay = options.retryDelay || 1000;
    let lastError;

    this.metrics.totalRequests++;
    this.metrics.lastRequestTime = new Date().toISOString();

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const completion = await this.client.chat.completions.create({
          model: this.aiConfig.model,
          messages: params.messages,
          max_tokens: this.aiConfig.maxTokens,
          temperature: this.aiConfig.temperature,
          ...params
        });

        const responseTime = Date.now() - startTime;
        this._updateMetrics(completion, responseTime, true);

        this.logger.info('AI completion successful', {
          model: this.aiConfig.model,
          tokens: completion.usage?.total_tokens || 0,
          responseTime,
          attempt
        });

        return {
          success: true,
          data: completion,
          metrics: {
            tokens: completion.usage?.total_tokens || 0,
            cost: this._calculateCost(completion),
            responseTime
          }
        };

      } catch (error) {
        lastError = error;
        this.metrics.failedRequests++;

        const isRetryable = this._isRetryableError(error);

        this.logger.warn('AI completion failed', {
          error: error.message,
          attempt,
          maxRetries,
          isRetryable,
          model: this.aiConfig.model
        });

        if (isRetryable && attempt < maxRetries) {
          const delay = retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
          await this._sleep(delay);
          continue;
        }

        // Non-retryable error or max retries reached
        const responseTime = Date.now() - startTime;
        this._updateMetrics(null, responseTime, false);

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

    throw lastError;
  }

  /**
     * Generate script analysis
     * @param {string} scriptContent - Script content to analyze
     * @param {Object} options - Analysis options
     * @returns {Promise<Object>} - Analysis result
     */
  analyzeScript(scriptContent, options = {}) {
    const messages = [
      {
        role: 'system',
        content: `You are a script analysis AI. Analyze the provided script and provide insights about:
                - Character development
                - Plot structure
                - Dialogue quality
                - Pacing and flow
                - Overall strengths and areas for improvement
                
                Provide a structured analysis in JSON format.`
      },
      {
        role: 'user',
        content: `Please analyze this script:\n\n${scriptContent}`
      }
    ];

    return this.generateCompletion({ messages }, options);
  }

  /**
     * Generate script suggestions
     * @param {string} scriptContent - Current script content
     * @param {string} prompt - User prompt for suggestions
     * @param {Object} options - Request options
     * @returns {Promise<Object>} - Suggestions result
     */
  generateSuggestions(scriptContent, prompt, options = {}) {
    const messages = [
      {
        role: 'system',
        content: `You are a creative writing assistant. Based on the current script and user request, provide helpful suggestions for improvement. Focus on:
                - Character development
                - Plot advancement
                - Dialogue enhancement
                - Scene structure
                - Creative alternatives
                
                Provide specific, actionable suggestions.`
      },
      {
        role: 'user',
        content: `Current script:\n${scriptContent}\n\nUser request: ${prompt}`
      }
    ];

    return this.generateCompletion({ messages }, options);
  }

  /**
     * Generate script edits
     * @param {string} scriptContent - Current script content
     * @param {string} editRequest - Edit request
     * @param {Object} options - Request options
     * @returns {Promise<Object>} - Edit result
     */
  generateEdits(scriptContent, editRequest, options = {}) {
    const messages = [
      {
        role: 'system',
        content: `You are a script editor. Based on the current script and edit request, provide specific line-by-line edits. Return the edits in a structured format with:
                - Line numbers
                - Current content
                - Suggested changes
                - Reasoning for changes
                
                Focus on improving clarity, flow, and impact.`
      },
      {
        role: 'user',
        content: `Current script:\n${scriptContent}\n\nEdit request: ${editRequest}`
      }
    ];

    return this.generateCompletion({ messages }, options);
  }

  /**
     * Check if error is retryable
     * @param {Error} error - Error to check
     * @returns {boolean} - Whether error is retryable
     */
  _isRetryableError(error) {
    const retryableErrors = [
      'ECONNRESET',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'ENOTFOUND',
      'ECONNABORTED'
    ];

    const retryableStatusCodes = [429, 500, 502, 503, 504];

    return retryableErrors.some(code => error.code === code) ||
               retryableStatusCodes.includes(error.status);
  }

  /**
     * Map OpenAI errors to standardized format
     * @param {Error} error - Original error
     * @returns {Object} - Mapped error
     */
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

  /**
     * Update metrics
     * @param {Object} completion - Completion result
     * @param {number} responseTime - Response time in ms
     * @param {boolean} success - Whether request was successful
     */
  _updateMetrics(completion, responseTime, success) {
    if (success) {
      this.metrics.successfulRequests++;

      if (completion?.usage) {
        this.metrics.totalTokens += completion.usage.total_tokens;
        this.metrics.totalCost += this._calculateCost(completion);
      }
    }

    // Update response time metrics
    this.responseTimes.push(responseTime);
    if (this.responseTimes.length > this.maxResponseTimeHistory) {
      this.responseTimes.shift();
    }

    const sum = this.responseTimes.reduce((a, b) => a + b, 0);
    this.metrics.averageResponseTime = Math.round(sum / this.responseTimes.length);
  }

  /**
     * Calculate cost based on token usage
     * @param {Object} completion - Completion result
     * @returns {number} - Cost in USD
     */
  _calculateCost(completion) {
    if (!completion?.usage) return 0;

    // GPT-3.5-turbo pricing (as of 2024)
    const promptCostPer1K = 0.0015;
    const completionCostPer1K = 0.002;

    const promptCost = (completion.usage.prompt_tokens / 1000) * promptCostPer1K;
    const completionCost = (completion.usage.completion_tokens / 1000) * completionCostPer1K;

    return promptCost + completionCost;
  }

  /**
     * Sleep for specified milliseconds
     * @param {number} ms - Milliseconds to sleep
     * @returns {Promise} - Promise that resolves after delay
     */
  _sleep(ms) {
    return new Promise(resolve => {
      setTimeout(resolve, ms);
    });
  }

  /**
     * Get client metrics
     * @returns {Object} - Client metrics
     */
  getMetrics() {
    return {
      ...this.metrics,
      successRate: this.metrics.totalRequests > 0
        ? (this.metrics.successfulRequests / this.metrics.totalRequests) * 100
        : 0,
      averageTokensPerRequest: this.metrics.successfulRequests > 0
        ? Math.round(this.metrics.totalTokens / this.metrics.successfulRequests)
        : 0
    };
  }

  /**
     * Reset metrics
     */
  resetMetrics() {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalTokens: 0,
      totalCost: 0,
      averageResponseTime: 0,
      lastRequestTime: null
    };
    this.responseTimes = [];
  }

  /**
     * Get client configuration
     * @returns {Object} - Client configuration
     */
  getConfig() {
    return {
      model: this.aiConfig.model,
      maxTokens: this.aiConfig.maxTokens,
      temperature: this.aiConfig.temperature,
      timeout: this.aiConfig.timeout,
      maxRetries: this.aiConfig.maxRetries
    };
  }
}

/**
 * AI Client Factory
 */
export class AIClientFactory {
  /**
     * Create AI client instance
     * @param {Object} options - Client options
     * @returns {AIClient} - AI client instance
     */
  static create(options = {}) {
    return new AIClient(options);
  }
}

export default AIClient;
