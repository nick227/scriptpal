/**
 * Tests for AI Client service
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock dependencies
jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    models: {
      list: jest.fn()
    },
    chat: {
      completions: {
        create: jest.fn()
      }
    }
  }))
}));

const aiConfigFixture = {
  apiKey: 'test-api-key',
  model: 'gpt-3.5-turbo',
  maxTokens: 1000,
  temperature: 0.7,
  timeout: 30000,
  maxRetries: 3
};

jest.mock('../../config/index.js', () => ({
  __esModule: true,
  default: {
    getAIConfig: jest.fn(() => aiConfigFixture)
  },
  getAIConfig: jest.fn(() => aiConfigFixture)
}));

jest.mock('../../utils/logger.js', () => ({
  logger: {
    child: jest.fn(() => ({
      error: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    }))
  }
}));

describe('AIClient', () => {
  let AIClient;
  let mockOpenAI;
  let mockConfig;
  let _mockLogger;

  beforeEach(async() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Import the service after mocking
    const openai = await import('openai');
    mockOpenAI = openai.default;
    mockConfig = await import('../../config/index.js');
    _mockLogger = await import('../../utils/logger.js');

    AIClient = (await import('../../services/AIClient.js')).AIClient;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      const client = new AIClient();

      expect(mockConfig.default.getAIConfig).toHaveBeenCalled();
      expect(mockOpenAI).toHaveBeenCalledWith({
        apiKey: 'test-api-key',
        timeout: 30000,
        maxRetries: 3
      });
      expect(client.metrics).toBeDefined();
      expect(client.metrics.totalRequests).toBe(0);
      expect(client.metrics.successfulRequests).toBe(0);
      expect(client.metrics.failedRequests).toBe(0);
    });

    it('should initialize metrics correctly', () => {
      const client = new AIClient();

      expect(client.metrics).toEqual({
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        totalTokens: 0,
        totalCost: 0,
        averageResponseTime: 0,
        lastRequestTime: null
      });
    });
  });

  describe('healthCheck', () => {
    it('should return true when AI service is healthy', async() => {
      const client = new AIClient();
      const mockResponse = { data: ['model1', 'model2'] };
      client.client.models.list.mockResolvedValue(mockResponse);

      const result = await client.healthCheck();

      expect(result).toBe(true);
      expect(client.client.models.list).toHaveBeenCalled();
    });

    it('should return false when AI service is unhealthy', async() => {
      const client = new AIClient();
      const error = new Error('API connection failed');
      client.client.models.list.mockRejectedValue(error);

      const result = await client.healthCheck();

      expect(result).toBe(false);
    });

    it('should return false when response data is invalid', async() => {
      const client = new AIClient();
      const mockResponse = { data: null };
      client.client.models.list.mockResolvedValue(mockResponse);

      const result = await client.healthCheck();

      expect(result).toBe(false);
    });
  });

  describe('generateCompletion', () => {
    it('should generate completion successfully', async() => {
      const client = new AIClient();
      const mockResponse = {
        choices: [{
          message: {
            content: 'Generated response'
          }
        }],
        usage: {
          total_tokens: 100,
          prompt_tokens: 60,
          completion_tokens: 40
        }
      };
      client.client.chat.completions.create.mockResolvedValue(mockResponse);

      const result = await client.generateCompletion({
        messages: [{ role: 'user', content: 'Test prompt' }]
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResponse);
      expect(client.metrics.totalRequests).toBe(1);
      expect(client.metrics.successfulRequests).toBe(1);
      expect(client.metrics.totalTokens).toBe(100);
    });

    it('should handle completion errors', async() => {
      const client = new AIClient();
      const error = new Error('API error');
      client.client.chat.completions.create.mockRejectedValue(error);

      const result = await client.generateCompletion({
        messages: [{ role: 'user', content: 'Test prompt' }]
      });

      expect(result.success).toBe(false);
      expect(result.error.message).toBe('API error');
      expect(client.metrics.totalRequests).toBe(1);
      expect(client.metrics.failedRequests).toBe(1);
    });

    it('should handle empty response', async() => {
      const client = new AIClient();
      const mockResponse = {
        choices: [],
        usage: { total_tokens: 0 }
      };
      client.client.chat.completions.create.mockResolvedValue(mockResponse);

      const result = await client.generateCompletion({
        messages: [{ role: 'user', content: 'Test prompt' }]
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResponse);
    });
  });

  describe('analyzeScript', () => {
    it('should analyze script content', async() => {
      const client = new AIClient();
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              analysis: 'Script analysis result',
              score: 8.5
            })
          }
        }],
        usage: {
          total_tokens: 150,
          prompt_tokens: 90,
          completion_tokens: 60
        }
      };
      client.client.chat.completions.create.mockResolvedValue(mockResponse);

      const result = await client.analyzeScript('Script content');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResponse);
    });

    it('should handle invalid JSON response', async() => {
      const client = new AIClient();
      const mockResponse = {
        choices: [{
          message: {
            content: 'Invalid JSON response'
          }
        }],
        usage: {
          total_tokens: 50,
          prompt_tokens: 30,
          completion_tokens: 20
        }
      };
      client.client.chat.completions.create.mockResolvedValue(mockResponse);

      const result = await client.analyzeScript('Script content');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResponse);
    });
  });

  describe('generateSuggestions', () => {
    it('should generate suggestions for script', async() => {
      const client = new AIClient();
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              suggestions: ['Suggestion 1', 'Suggestion 2'],
              category: 'dialogue'
            })
          }
        }],
        usage: {
          total_tokens: 200,
          prompt_tokens: 120,
          completion_tokens: 80
        }
      };
      client.client.chat.completions.create.mockResolvedValue(mockResponse);

      const result = await client.generateSuggestions('Script content', 'dialogue');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResponse);
    });
  });

  describe('generateEdits', () => {
    it('should generate edits for script', async() => {
      const client = new AIClient();
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              edits: [
                { line: 1, original: 'Old text', suggested: 'New text' }
              ],
              reason: 'Improve dialogue'
            })
          }
        }],
        usage: {
          total_tokens: 180,
          prompt_tokens: 110,
          completion_tokens: 70
        }
      };
      client.client.chat.completions.create.mockResolvedValue(mockResponse);

      const result = await client.generateEdits('Script content', 'Improve dialogue');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResponse);
    });
  });

  describe('getMetrics', () => {
    it('should return current metrics', () => {
      const client = new AIClient();
      client.metrics.totalRequests = 10;
      client.metrics.successfulRequests = 8;
      client.metrics.failedRequests = 2;

      const metrics = client.getMetrics();

      expect(metrics.totalRequests).toBe(10);
      expect(metrics.successfulRequests).toBe(8);
      expect(metrics.failedRequests).toBe(2);
      expect(metrics.successRate).toBe(80);
    });
  });

  describe('resetMetrics', () => {
    it('should reset all metrics to zero', () => {
      const client = new AIClient();
      client.metrics.totalRequests = 10;
      client.metrics.successfulRequests = 8;
      client.metrics.failedRequests = 2;

      client.resetMetrics();

      expect(client.metrics.totalRequests).toBe(0);
      expect(client.metrics.successfulRequests).toBe(0);
      expect(client.metrics.failedRequests).toBe(0);
    });
  });
});
