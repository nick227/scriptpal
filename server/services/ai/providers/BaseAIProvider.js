export class BaseAIProvider {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
  }

  getProviderName() {
    throw new Error('getProviderName() not implemented');
  }

  getModel() {
    return this.config.model;
  }

  async healthCheck() {
    throw new Error('healthCheck() not implemented');
  }

  async createCompletion(_params) {
    throw new Error('createCompletion() not implemented');
  }

  getUsage(_completion) {
    throw new Error('getUsage() not implemented');
  }

  normalizeResponse(response) {
    return response;
  }
}
