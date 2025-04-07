import { BaseChain } from './BaseChain.js';
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { INTENT_TYPES } from '../../constants.js';

export class DefaultChain extends BaseChain {
    constructor(config = {}) {
        super(config);

        // Initialize prompt template for general assistance
        this.promptTemplate = ChatPromptTemplate.fromMessages([
            ["system", `You are a helpful script writing assistant. For non-script related queries or unclear requests:
1. Keep responses brief and focused
2. Guide users back to script-related topics
3. Suggest relevant script-writing features

Available features:
- Script Analysis: Comprehensive analysis of story, structure, and characters
- Scene Listing: Break down and organize script scenes
- Beat Listing: Analyze major story beats and plot points
- Creative Inspiration: Generate ideas and break writer's block

Always maintain a helpful, professional tone.`],
            ["user", "{input}"]
        ]);
    }

    async run(input, context = {}) {
        try {
            // Format the prompt with input
            const messages = await this.promptTemplate.formatMessages({
                input: typeof input === 'string' ? input : context.prompt || ''
            });

            // Execute the chain without schema validation (it returns a string)
            const response = await this.execute(messages);

            // Return formatted response with suggestions
            return {
                response: response, // Already a string from BaseChain.execute()
                type: 'general_assistance',
                suggestions: [{
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
                    }
                ]
            };

        } catch (error) {
            console.error('DefaultChain execution error:', error);

            // Provide a graceful fallback response
            return {
                response: "I'm here to help with your script writing. Would you like to analyze your script, work on scenes, or get some creative inspiration?",
                type: 'fallback_response',
                suggestions: [{
                    text: "View Script Writing Features",
                    intent: "view_tutorial",
                    description: "Learn about available features"
                }]
            };
        }
    }
}