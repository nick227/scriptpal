import { CHAIN_CONFIG, ERROR_TYPES as _ERROR_TYPES, INTENT_TYPES } from '../constants.js';
import { BaseChain } from './base/BaseChain.js';

/**
 * Chain configuration type that defines how a chain should behave
 * @typedef {Object} ChainConfig
 * @property {string} intent - The intent type this chain handles
 * @property {boolean} [requiresAuth=false] - Whether this chain requires authentication
 * @property {boolean} [shouldGenerateQuestions=true] - Whether to generate follow-up questions
 * @property {Object} [modelConfig={}] - OpenAI model configuration
 * @property {Function} [preProcess] - Function to run before chain execution
 * @property {Function} [postProcess] - Function to run after chain execution
 * @property {Function} [condition] - Function to determine if chain should run
 */

class ChainRegistry {
  constructor() {
    this.chains = new Map();
    this.configs = new Map();
    this.initialized = false;
    this.registrationComplete = false;
  }

  /**
     * Register a new chain with its configuration
     */
  register(intent, ChainClass, config = {}) {
    if (this.registrationComplete) {
      throw new Error('Cannot register new chains after initialization is complete');
    }

    if (!(ChainClass.prototype instanceof BaseChain)) {
      throw new Error(`Chain class must extend BaseChain: ${ChainClass.name}`);
    }

    // Create chain instance with merged config
    const chain = new ChainClass({
      type: intent,
      ...CHAIN_CONFIG,
      ...config.modelConfig
    });

    // Store chain and its config
    this.chains.set(intent, chain);
    this.configs.set(intent, {
      intent,
      requiresAuth: false,
      shouldGenerateQuestions: true,
      ...config
    });

    return this;
  }

  /**
     * Complete the registration process and validate required chains
     */
  completeRegistration() {
    // Verify we have required chains
    if (!this.chains.has(INTENT_TYPES.EVERYTHING_ELSE)) {
      throw new Error('Default chain (EVERYTHING_ELSE) must be registered');
    }

    const registeredIntents = Array.from(this.chains.keys());
    console.log('Completing chain registration with intents:', registeredIntents);

    this.registrationComplete = true;
    this.initialized = true;
    return this;
  }

  /**
     * Check if a chain can handle the request
     */
  async canHandle(intent, context) {
    if (!this.initialized) {
      console.error('Registry not initialized. Status:', this.getStatus());
      return false;
    }

    // Always allow EVERYTHING_ELSE if we're initialized
    if (intent === INTENT_TYPES.EVERYTHING_ELSE) {
      return true;
    }

    const config = this.configs.get(intent);
    if (!config) {
      console.log(`No configuration found for intent: ${intent}`);
      return false;
    }

    if (config.requiresAuth && !context.userId) {
      console.log(`Chain ${intent} requires auth but no userId provided`);
      return false;
    }

    if (config.condition && !await config.condition(context)) {
      console.log(`Chain ${intent} condition check failed`);
      return false;
    }

    return true;
  }

  /**
     * Execute a chain
     */
  async execute(intent, context, prompt) {
    if (!this.initialized || !this.registrationComplete) {
      const status = this.getStatus();
      console.error('Cannot execute chains before initialization is complete. Status:', status);
      throw new Error(`Chain registry not properly initialized: ${JSON.stringify(status)}`);
    }

    const chain = this.chains.get(intent);
    const config = this.configs.get(intent);

    // If no chain found or auth required but not provided, fall back to default
    if (!chain || !config || (config.requiresAuth && (!context || !context.userId))) {
      console.log(`Falling back to default chain. Reason: ${!chain ? 'No chain found' : !config ? 'No config found' : 'Auth required but not provided'}`);
      const defaultChain = this.chains.get(INTENT_TYPES.EVERYTHING_ELSE);
      if (!defaultChain) {
        throw new Error('Default chain not registered for EVERYTHING_ELSE intent');
      }
      return defaultChain.run(context, prompt);
    }

    try {
      // Add intent to context for chain-specific handling
      context.intent = intent;

      // Run pre-processing if configured
      if (config.preProcess) {
        await config.preProcess(context, prompt);
      }

      // Apply chain configuration and preserve script metadata
      context.chainConfig = {
        ...context.chainConfig,
        ...config,
        shouldGenerateQuestions: config.shouldGenerateQuestions
      };

      // Ensure script metadata is preserved at the top level
      const enrichedContext = {
        ...context,
        scriptId: context.scriptId || (context.metadata && context.metadata.scriptId),
        scriptTitle: context.scriptTitle || (context.metadata && context.metadata.scriptTitle)
      };

      // Execute the chain with enriched context
      const result = await chain.run(enrichedContext, prompt);

      // Run post-processing if configured
      if (config.postProcess) {
        await config.postProcess(enrichedContext, result);
      }

      // Ensure consistent response format
      if (typeof result === 'string') {
        return {
          response: result,
          type: intent,
          metadata: {
            scriptId: enrichedContext.scriptId,
            scriptTitle: enrichedContext.scriptTitle,
            timestamp: new Date().toISOString()
          }
        };
      }

      return result;

    } catch (error) {
      console.error(`Chain execution failed for: ${intent}`, error);

      // Handle insufficient content error specifically
      if (error.message === 'insufficient_content' && intent === INTENT_TYPES.ANALYZE_SCRIPT) {
        return {
          response: 'I couldn\'t find enough script content to analyze. Please provide a script or outline to analyze.',
          type: intent,
          metadata: {
            error: 'insufficient_content',
            scriptId: context.scriptId,
            scriptTitle: context.scriptTitle,
            timestamp: new Date().toISOString()
          }
        };
      }

      // Fall back to default chain on other errors
      const defaultChain = this.chains.get(INTENT_TYPES.EVERYTHING_ELSE);
      return defaultChain.run(context, prompt);
    }
  }

  /**
     * Get detailed registry status
     */
  getStatus() {
    return {
      initialized: this.initialized,
      registrationComplete: this.registrationComplete,
      chainCount: this.chains.size,
      hasDefaultChain: this.chains.has(INTENT_TYPES.EVERYTHING_ELSE),
      registeredChains: Array.from(this.chains.keys())
    };
  }

  /**
     * Check if registry is properly initialized
     */
  isInitialized() {
    const status = this.getStatus();
    console.log('Registry status:', status);
    return this.initialized &&
            this.registrationComplete &&
            status.hasDefaultChain;
  }

  getRegisteredIntents() {
    return Array.from(this.chains.keys());
  }
}

export { ChainRegistry };
