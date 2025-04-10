import { BaseChain } from './BaseChain.js';
import { INTENT_TYPES } from '../../constants.js';

export class DefaultChain extends BaseChain {
    constructor(config = {}) {
        super({
            ...config,
            temperature: 0.7
        });
    }

    async run(context, prompt) {
        try {
            // Create messages array in the format expected by BaseChain
            const messages = [{
                    role: 'system',
                    content: 'You are a helpful script writing assistant. Respond conversationally while staying focused on script writing.'
                },
                {
                    role: 'user',
                    content: `${prompt}`
                }
            ];

            // Execute the chain without schema validation (it returns a string)
            const response = await this.execute(messages, {
                scriptTitle: context.scriptTitle || 'Untitled',
                metadata: {
                    type: 'general_assistance',
                    timestamp: new Date().toISOString(),
                    prompt: prompt
                }
            });

            // If execute returned a string (no questions generated), wrap it
            if (typeof response === 'string') {
                return {
                    response: response,
                    type: 'general_assistance',
                    questions: [{
                            text: "Analyze Your Script",
                            intent: INTENT_TYPES.ANALYZE_SCRIPT,
                            description: "Get a comprehensive analysis of your script"
                        },
                        {
                            text: "List Scenes",
                            intent: INTENT_TYPES.LIST_SCENES,
                            description: "Break down your script into scenes"
                        },
                        {
                            text: "Get Creative Ideas",
                            intent: INTENT_TYPES.GET_INSPIRATION,
                            description: "Generate new ideas for your script"
                        },
                        {
                            text: "What is the story about?",
                            intent: INTENT_TYPES.ANALYZE_SCRIPT,
                            description: "Get a insightful description of the story"
                        }
                    ],
                    metadata: {
                        type: 'general_assistance',
                        timestamp: new Date().toISOString(),
                        prompt: prompt
                    }
                };
            }

            // Return the response from execute which already has the correct format
            return response;

        } catch (error) {
            console.error('DefaultChain execution error:', error);

            // Provide a graceful fallback response
            return {
                response: "I'm here to help with your script writing. Would you like to analyze your script, work on scenes, or get some creative inspiration?",
                type: 'fallback_response',
                questions: [{
                    text: "View Script Writing Features",
                    intent: "view_tutorial",
                    description: "Learn about available features"
                }],
                metadata: {
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    type: 'error'
                }
            };
        }
    }
}