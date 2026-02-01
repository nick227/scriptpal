import { logger } from '../../../utils/logger.js';

const DEFAULT_PRICING_MAP = {
  openai: {
    'gpt-3.5-turbo': {
      prompt: 0.0015,
      completion: 0.002
    }
  }
};

const normalizePricingMap = (pricingMap) => {
  if (!pricingMap || typeof pricingMap !== 'object') {
    return { ...DEFAULT_PRICING_MAP };
  }
  return { ...DEFAULT_PRICING_MAP, ...pricingMap };
};

export class CostCalculator {
  constructor(pricingMap, parentLogger = logger) {
    this.logger = parentLogger.child
      ? parentLogger.child({ context: 'CostCalculator' })
      : parentLogger;
    this.pricingMap = normalizePricingMap(pricingMap);
  }

  getModelPricing(provider, model) {
    const providerPricing = this.pricingMap[provider];
    if (!providerPricing) {
      return null;
    }
    if (model && providerPricing[model]) {
      return providerPricing[model];
    }
    if (providerPricing.default) {
      return providerPricing.default;
    }
    return null;
  }

  calculate({ provider, model, promptTokens, completionTokens }) {
    const pricing = this.getModelPricing(provider, model);
    if (!pricing) {
      const error = new Error('Missing pricing config');
      error.details = { provider, model };
      throw error;
    }

    const promptCostPer1K = Number(pricing.prompt);
    const completionCostPer1K = Number(pricing.completion);
    const promptCost = (Number(promptTokens) / 1000) * promptCostPer1K;
    const completionCost = (Number(completionTokens) / 1000) * completionCostPer1K;

    return promptCost + completionCost;
  }
}
