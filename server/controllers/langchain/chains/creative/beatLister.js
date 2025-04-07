import { BaseChain } from '../base/BaseChain.js';
import { promptManager } from '../../prompts/index.js';
import { ERROR_TYPES } from '../../constants.js';
import { ChainHelper } from '../helpers/ChainHelper.js';

export class BeatListChain extends BaseChain {
    constructor(config = {}) {
        super({
            ...config,
            temperature: 0.7 // Higher creativity for beat generation
        });
    }

    async validateBeatList(result) {
        return ChainHelper.validateStructuredResponse(result, {
            requiredArray: 'beats',
            alternateArrays: ['story_beats', 'narrative_beats'],
            defaultValues: {
                description: 'Story beat',
                purpose: 'Advance the narrative',
                emotional_impact: 'Engage the audience',
                suggested_placement: null
            },
            requireRationale: true
        });
    }

    async saveBeatElements(scriptId, beats) {
        return ChainHelper.saveElements(scriptId, beats, {
            type: 'beat',
            getSubtype: (index) => `beat_${index + 1}`,
            processElement: (beat) => ({
                description: beat.description,
                purpose: beat.purpose,
                emotional_impact: beat.emotional_impact,
                suggested_placement: beat.suggested_placement || null
            })
        });
    }

    async run(input, context = {}) {
        try {
            // Extract context with defaults
            const { scriptId, prompt } = ChainHelper.extractContext(context);
            console.log(`Running beat lister for scriptId: ${scriptId}`);

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
                elementType: 'beats'
            });

            // Validate content
            if (!ChainHelper.validateContent(processedScript.content)) {
                return ChainHelper.getErrorResponse(
                    "I couldn't find enough script content to identify story beats. Please provide more content or start with a basic story outline.",
                    'error_response'
                );
            }

            // Get existing beats if any
            const existingBeats = processedScript.elements.beats || [];

            // Format the prompt
            const fallbackPrompt = [{
                    role: 'system',
                    content: 'You are a skilled story editor specializing in story beats and narrative structure.'
                },
                {
                    role: 'user',
                    content: `Please identify key story beats for this script:\n\n${processedScript.content}`
                }
            ];

            const formattedPrompt = await ChainHelper.handlePromptFormatting(
                promptManager,
                'beatList', {
                    content: processedScript.content,
                    existingBeats: existingBeats.length > 0 ?
                        existingBeats.map(b => b.content).join('\n') : 'No existing beats found',
                    focus: prompt || 'Identify key emotional and narrative beats that drive the story forward'
                },
                fallbackPrompt
            );

            // Execute the chain
            console.log('Executing beat list chain...');
            const response = await this.execute(formattedPrompt);
            console.log('Beat list generation complete, validating format...');

            try {
                // Validate the beat list format
                const validatedBeats = await this.validateBeatList(response);

                // Save if scriptId provided
                if (scriptId) {
                    await this.saveBeatElements(scriptId, validatedBeats.beats);
                }

                return validatedBeats;
            } catch (validationError) {
                console.error('Beat list validation failed:', validationError);
                return ChainHelper.getUnstructuredResponse(response, {
                    type: 'unstructured_beats',
                    emptyArray: 'beats',
                    prefix: "I identified some story beats but couldn't format them properly. Here's what I found: "
                });
            }
        } catch (error) {
            console.error('Beat list generation error:', error);
            return ChainHelper.getErrorResponse(
                "I'm sorry, I encountered an error identifying story beats. Please try again with a more detailed script or outline.",
                'error_response'
            );
        }
    }
}