import { INTENT_TYPES, ERROR_TYPES } from '../constants.js';
import { chainFactory } from '../chains/ChainFactory.js';
import { classifyIntent } from '../chains/system/classifyIntent.js';
import { splitIntent } from '../chains/system/intentSplitter.js';
import db from '../../../db/index.js';

/**
 * Handles routing of intents to appropriate chains
 */
class IntentRouter {
    constructor() {
        this.chainFactory = chainFactory;
    }

    /**
     * Gets full script context including elements and personas
     */
    async getScriptContext(scriptId) {
        try {
            // Get script profile (includes basic script info and elements)
            const scriptProfile = await db.getScriptProfile(scriptId);
            if (!scriptProfile) return null;

            // Get script personas
            const personas = await db.getScriptPersonas(scriptId);

            // Get script statistics
            const stats = await db.getScriptStats(scriptId);

            return {
                ...scriptProfile,
                personas,
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
            // Create conversation log
            await db.query(
                'INSERT INTO conversations (script_id, intent, prompt, response) VALUES (?, ?, ?, ?)', [scriptId, intent, prompt, JSON.stringify(response)]
            );
        } catch (error) {
            console.error('Error logging activity:', error);
        }
    }

    /**
     * Route the request to the appropriate chain
     * @param {Object} intentResult - Result from intent classification
     * @param {Object} context - Context object containing script info and content
     * @param {string} prompt - Original user prompt
     * @returns {Promise<Object>} Chain response
     */
    async route(intentResult, context, prompt) {
        try {
            if (!intentResult || !intentResult.intent) {
                throw new Error(ERROR_TYPES.INVALID_INTENT);
            }

            if (!context || !context.scriptId) {
                throw new Error(ERROR_TYPES.MISSING_REQUIRED + ': Script context is required');
            }

            console.log('\n=========================================');
            console.log('Requested intent:', intentResult.intent);

            // Get the appropriate chain
            const chain = this.chainFactory.getChain(intentResult.intent);
            if (!chain) {
                throw new Error(ERROR_TYPES.ROUTING_ERROR + `: No chain found for intent ${intentResult.intent}`);
            }

            // Execute the chain with context
            return await this.chainFactory.executeChain(chain, context, prompt);

        } catch (error) {
            console.error('Routing error:', error);
            throw new Error(ERROR_TYPES.ROUTING_ERROR);
        }
    }

    /**
     * Handles multiple intents by splitting and processing sequentially
     */
    async handleMultiIntent(scriptContext, prompt, context) {
        try {
            // Split the intent into individual requests
            const splitIntents = await splitIntent(prompt);

            // Process each intent in sequence
            const results = [];
            for (const intent of splitIntents.intents) {
                // Classify the individual intent
                const classification = await classifyIntent(intent.prompt);

                // Route and execute
                const result = await chainFactory.executeChain(
                    classification.intent,
                    scriptContext || intent.prompt, {
                        prompt: intent.prompt,
                        context: intent.context
                    }
                );

                results.push({
                    order: intent.order,
                    result
                });
            }

            // Sort results by order and return
            return results.sort((a, b) => a.order - b.order);

        } catch (error) {
            console.error('Multi-intent handling error:', error);
            throw new Error(ERROR_TYPES.ROUTING_ERROR);
        }
    }
}

// Export router instance
export const router = new IntentRouter();