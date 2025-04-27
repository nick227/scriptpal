import { INTENT_TYPES, ERROR_TYPES } from '../constants.js';
import { classifyIntent } from '../chains/system/classifyIntent.js';
import { chainRegistry } from '../chains/registry.js';
import db from '../../../db/index.js';
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
     * Route the request to appropriate chain
     */
    async route(intentResult, context, prompt) {
        try {
            const { intent } = intentResult;

            // Get the chain class
            const ChainClass = this.chainRegistry.getChain(intent);
            if (!ChainClass) {
                console.log(`No chain found for intent ${intent}, falling back to default`);
                const DefaultChainClass = this.chainRegistry.getChain(INTENT_TYPES.EVERYTHING_ELSE);
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
                const result = await chainRegistry.execute(
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