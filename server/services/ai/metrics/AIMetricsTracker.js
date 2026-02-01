export class AIMetricsTracker {
  constructor() {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalTokens: 0,
      totalCost: 0,
      averageResponseTime: 0,
      lastRequestTime: null,
      lastFailureAttempts: 0
    };
    this.responseTimes = [];
    this.maxResponseTimeHistory = 100;
  }

  markRequestStart() {
    this.metrics.totalRequests += 1;
    this.metrics.lastRequestTime = new Date().toISOString();
  }

  trackSuccess({ usage, costUsd, responseTime }) {
    this.metrics.successfulRequests += 1;
    if (usage) {
      this.metrics.totalTokens += Number(usage.totalTokens);
    }
    if (typeof costUsd === 'number') {
      this.metrics.totalCost += costUsd;
    }
    this.recordResponseTime(responseTime);
  }

  trackFailure({ responseTime, attempts }) {
    this.metrics.failedRequests += 1;
    this.metrics.lastFailureAttempts = Number(attempts || 0);
    this.recordResponseTime(responseTime);
  }

  recordResponseTime(responseTime) {
    this.responseTimes.push(responseTime);
    if (this.responseTimes.length > this.maxResponseTimeHistory) {
      this.responseTimes.shift();
    }
    const sum = this.responseTimes.reduce((a, b) => a + b, 0);
    this.metrics.averageResponseTime = Math.round(sum / this.responseTimes.length);
  }

  getMetrics() {
    const { totalRequests, successfulRequests } = this.metrics;
    const successRate = totalRequests > 0
      ? (successfulRequests / totalRequests) * 100
      : 0;
    const averageTokensPerRequest = successfulRequests > 0
      ? Math.round(this.metrics.totalTokens / successfulRequests)
      : 0;
    return {
      ...this.metrics,
      successRate,
      averageTokensPerRequest
    };
  }

  reset() {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalTokens: 0,
      totalCost: 0,
      averageResponseTime: 0,
      lastRequestTime: null,
      lastFailureAttempts: 0
    };
    this.responseTimes = [];
  }
}
