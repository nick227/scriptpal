import { INTENT_TYPES, ERROR_TYPES } from '../constants.js';
import { chainRegistry } from '../chains/registry.js';
import scriptModel from '../../../models/script.js';
// Import ChainFactory to ensure it's initialized
import '../chains/ChainFactory.js';

/**
 * Handles routing of intents to appropriate chains
 */
export class IntentRouter {
  constructor() {
    this.chainRegistry = chainRegistry;
    // Verify chain initialization
    if (!this.chainRegistry.isInitialized()) {
      console.error('Chain registry not initialized during router construction');
      throw new Error('Chain registry not properly initialized');
    }
  }

  /**
     * Gets full script context including elements and personas
     */
  async getScriptContext(scriptId) {
    try {
      // Get script profile (includes basic script info and elements)
      const scriptProfile = await scriptModel.getScriptProfile(scriptId);
      if (!scriptProfile) return null;

      // Get script statistics
      const stats = await scriptModel.getScriptStats(scriptId);

      return {
        ...scriptProfile,
        stats
      };
    } catch (error) {
      console.error('Error getting script context:', error);
      return null;
    }
  }

  /**
     * Logs the chain activity
     */
  async logActivity(scriptId, intent, prompt, response) {
    try {
      void scriptId;
      void intent;
      void prompt;
      void response;
    } catch (error) {
      console.error('Error logging activity:', error);
    }
  }

  /**
     * Route the request to appropriate chain
     */
  async route(intentResult, context, prompt) {
    try {
      const { intent } = intentResult;
      console.log('[IntentRouter] routing intent', {
        intent,
        chatRequestId: context?.chatRequestId
      });

      // Get the chain class
      const ChainClass = this.chainRegistry.getChain(intent);
      if (!ChainClass) {
        console.log(`No chain found for intent ${intent}, falling back to default`);
        const DefaultChainClass = this.chainRegistry.getChain(INTENT_TYPES.GENERAL_CONVERSATION);
        if (!DefaultChainClass) {
          throw new Error('Default chain not registered');
        }
        const defaultChain = new DefaultChainClass();
        return await defaultChain.run(context, prompt);
      }

      // Create chain instance and run
      const chain = new ChainClass();
      return await chain.run(context, prompt);

    } catch (error) {
      console.error('Router error:', error);
      throw error;
    }
  }

}

// Export router instance
export const router = new IntentRouter();
