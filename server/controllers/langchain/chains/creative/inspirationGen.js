import { BaseChain } from '../base/BaseChain.js';
import { promptManager } from '../../prompts/index.js';
import { ERROR_TYPES } from '../../constants.js';
import { ChainHelper } from '../helpers/ChainHelper.js';

export class InspirationChain extends BaseChain {
    constructor(config = {}) {
        super({
            ...config,
            temperature: 0.8 // Higher creativity for inspiration
        });
    }

    async validateInspiration(result) {
        return ChainHelper.validateStructuredResponse(result, {
            requiredArray: 'suggestions',
            alternateArrays: ['ideas', 'inspirations'],
            defaultValues: {
                idea: 'Creative suggestion',
                rationale: 'This could enhance the story',
                implementation: 'Consider incorporating this element',
                impact: 'Could improve audience engagement'
            },
            requireRationale: true
        });
    }

    async saveInspirationElements(scriptId, suggestions) {
        return ChainHelper.saveElements(scriptId, suggestions, {
            type: 'inspiration',
            getSubtype: (index) => `inspiration_${index + 1}`,
            processElement: (suggestion) => ({
                idea: suggestion.idea,
                rationale: suggestion.rationale,
                implementation: suggestion.implementation,
                impact: suggestion.impact
            })
        });
    }

    async run(input, context = {}) {
        try {
            // Extract context with defaults
            const { scriptId, prompt } = ChainHelper.extractContext(context);
            console.log(`Running inspiration generator for scriptId: ${scriptId}`);

            // Get script content - could be an object, string, or null
            let scriptContent = input;

            // If input seems to be the prompt instead of the script content
            if (typeof input === 'string' && input.length < 500 && context.prompt) {
                console.log('Input appears to be the prompt, using context as input');
                scriptContent = context.prompt;
            }

            // Process the script
            const processedScript = ChainHelper.preprocessScript(scriptContent, {
                includeElements: true,
                elementType: 'inspirations'
            });

            // Validate content
            if (!ChainHelper.validateContent(processedScript.content)) {
                return ChainHelper.getErrorResponse(
                    "I couldn't find enough script content to generate inspiration. Please provide more content or start with a basic story outline.",
                    'error_response'
                );
            }

            // Get existing inspirations if any
            const existingInspirations = processedScript.elements.inspirations || [];

            // Format the prompt
            const fallbackPrompt = [{
                    role: 'system',
                    content: 'You are a creative writing consultant specializing in story enhancement and creative inspiration.'
                },
                {
                    role: 'user',
                    content: `Please suggest creative ideas to enhance this script:\n\n${processedScript.content}`
                }
            ];

            const formattedPrompt = await ChainHelper.handlePromptFormatting(
                promptManager,
                'inspiration', {
                    content: processedScript.content,
                    existingInspirations: existingInspirations.length > 0 ?
                        existingInspirations.map(i => i.content).join('\n') : 'No existing inspirations found',
                    focus: prompt || 'Generate creative ideas to enhance the story'
                },
                fallbackPrompt
            );

            // Execute the chain
            console.log('Executing inspiration chain...');
            const response = await this.execute(formattedPrompt);
            console.log('Inspiration generation complete, validating format...');

            try {
                // Validate the inspiration format
                const validatedInspirations = await this.validateInspiration(response);

                // Save if scriptId provided
                if (scriptId) {
                    await this.saveInspirationElements(scriptId, validatedInspirations.suggestions);
                }

                return validatedInspirations;
            } catch (validationError) {
                console.error('Inspiration validation failed:', validationError);
                return ChainHelper.getUnstructuredResponse(response, {
                    type: 'unstructured_inspirations',
                    emptyArray: 'suggestions',
                    prefix: "I generated some creative ideas but couldn't format them properly. Here's what I found: "
                });
            }
        } catch (error) {
            console.error('Inspiration generation error:', error);
            return ChainHelper.getErrorResponse(
                "I'm sorry, I encountered an error generating creative ideas. Please try again with a more detailed script or outline.",
                'error_response'
            );
        }
    }
}