import { BaseChain } from '../base/BaseChain.js';
import { promptManager } from '../../prompts/index.js';
import { ERROR_TYPES } from '../../constants.js';
import { ChainHelper } from '../helpers/ChainHelper.js';

export class SceneListChain extends BaseChain {
    constructor(config = {}) {
        super({
            ...config,
            temperature: 0.7 // Higher creativity for scene generation
        });
    }

    async validateSceneList(result) {
        return ChainHelper.validateStructuredResponse(result, {
            requiredArray: 'scenes',
            alternateArrays: ['story_scenes', 'script_scenes'],
            defaultValues: {
                description: 'Scene description',
                setting: 'Unknown location',
                characters: [],
                purpose: 'Advance the story',
                suggested_placement: null
            },
            requireRationale: true
        });
    }

    async saveSceneElements(scriptId, scenes) {
        return ChainHelper.saveElements(scriptId, scenes, {
            type: 'scene',
            getSubtype: (index) => `scene_${index + 1}`,
            processElement: (scene) => ({
                description: scene.description,
                setting: scene.setting,
                characters: Array.isArray(scene.characters) ? scene.characters : [],
                purpose: scene.purpose,
                suggested_placement: scene.suggested_placement || null
            })
        });
    }

    async run(input, context = {}) {
        try {
            // Extract context with defaults
            const { scriptId, prompt } = ChainHelper.extractContext(context);

            // Get script content - could be an object, string, or null
            let scriptContent = input;

            // If input seems to be the prompt instead of the script content
            if (typeof input === 'string' && input.length < 500 && context.prompt) {
                scriptContent = context.prompt;
            }

            // Process the script
            const processedScript = ChainHelper.preprocessScript(scriptContent, {
                includeElements: true,
                elementType: 'scenes'
            });

            // Validate content
            if (!ChainHelper.validateContent(processedScript.content)) {
                return ChainHelper.getErrorResponse(
                    "I couldn't find enough script content to identify scenes. Please provide more content or start with a basic story outline.",
                    'error_response'
                );
            }

            // Get existing scenes if any
            const existingScenes = processedScript.elements.scenes || [];

            // Format the prompt
            const fallbackPrompt = [{
                    role: 'system',
                    content: 'You are a skilled script editor specializing in scene structure and dramatic flow.'
                },
                {
                    role: 'user',
                    content: `Please identify key scenes for this script:\n\n${processedScript.content}`
                }
            ];

            const formattedPrompt = await ChainHelper.handlePromptFormatting(
                promptManager,
                'sceneList', {
                    content: processedScript.content,
                    existingScenes: existingScenes.length > 0 ?
                        existingScenes.map(s => s.content).join('\n') : 'No existing scenes found',
                    focus: prompt || 'Identify key scenes that drive the story forward'
                },
                fallbackPrompt
            );

            // Execute the chain
            const response = await this.execute(formattedPrompt);

            try {
                // Validate the scene list format
                const validatedScenes = await this.validateSceneList(response);

                // Save if scriptId provided
                if (scriptId) {
                    await this.saveSceneElements(scriptId, validatedScenes.scenes);
                }

                return validatedScenes;
            } catch (validationError) {
                console.error('Scene list validation failed:', validationError);
                return ChainHelper.getUnstructuredResponse(response, {
                    type: 'unstructured_scenes',
                    emptyArray: 'scenes',
                    prefix: "I identified some scenes but couldn't format them properly. Here's what I found: "
                });
            }
        } catch (error) {
            console.error('Scene list generation error:', error);
            return ChainHelper.getErrorResponse(
                "I'm sorry, I encountered an error identifying scenes. Please try again with a more detailed script or outline.",
                'error_response'
            );
        }
    }
}