import { INTENT_TYPES, ERROR_TYPES } from '../constants.js';
import { chainFactory } from '../chains/ChainFactory.js';
import { classifyIntent } from '../chains/system/classifyIntent.js';
import { splitIntent } from '../chains/system/intentSplitter.js';
import db from '../../../db/index.js';

/**
 * Handles routing of intents to appropriate chains
 */
class IntentRouter {
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
     * Routes the intent to appropriate chain
     */
    async route(intent, scriptId, prompt, context = '') {
        try {
            // Get full script context if scriptId provided
            const scriptContext = scriptId ? await this.getScriptContext(scriptId) : null;

            // Handle multi-intent requests
            if (intent.intent === INTENT_TYPES.MULTI_INTENT) {
                return this.handleMultiIntent(scriptContext, prompt, context);
            }

            const response = await chainFactory.executeChain(
                intent.intent,
                scriptContext || prompt, {
                    scriptId,
                    prompt,
                    context
                }
            );

            // Log the activity
            if (scriptId) {
                await this.logActivity(scriptId, intent.intent, prompt, response);
            }

            return response;

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

// Export singleton instance
export const router = new IntentRouter();