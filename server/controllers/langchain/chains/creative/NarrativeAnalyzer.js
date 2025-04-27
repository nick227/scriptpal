import { BaseChain } from '../base/BaseChain.js';
import { promptManager } from '../../prompts/index.js';
import { ERROR_TYPES } from '../../constants.js';
import { ChainHelper } from '../helpers/ChainHelper.js';

export class NarrativeAnalyzerChain extends BaseChain {
    constructor(config = {}) {
        super({
            ...config,
            temperature: 0.5 // Lower temperature for more analytical responses
        });
    }

    async validateAnalysis(result) {
        return ChainHelper.validateStructuredResponse(result, {
            requiredFields: [
                'narrative_analysis',
                'character_analysis',
                'theme_analysis',
                'pacing_analysis',
                'dialog_analysis',
                'recommendations'
            ],
            defaultValues: {
                narrative_analysis: 'Analysis of story structure and plot',
                character_analysis: 'Analysis of character development and arcs',
                theme_analysis: 'Analysis of thematic elements',
                pacing_analysis: 'Analysis of story pacing and flow',
                dialog_analysis: 'Analysis of dialog effectiveness',
                recommendations: []
            },
            requireRationale: true
        });
    }

    async saveAnalysisElements(scriptId, analysis) {
        return ChainHelper.saveElements(scriptId, [analysis], {
            type: 'analysis',
            getSubtype: () => 'narrative',
            processElement: (analysis) => ({
                narrative: analysis.narrative_analysis,
                characters: analysis.character_analysis,
                themes: analysis.theme_analysis,
                pacing: analysis.pacing_analysis,
                dialog: analysis.dialog_analysis,
                recommendations: Array.isArray(analysis.recommendations) ?
                    analysis.recommendations : [analysis.recommendations]
            })
        });
    }

    async run(input, context = {}) {
        try {
            // Extract context with defaults
            const { scriptId, prompt } = ChainHelper.extractContext(context);
            console.log(`Running script analyzer for scriptId: ${scriptId}`);

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
                elementType: 'analysis'
            });

            // Validate content
            if (!ChainHelper.validateContent(processedScript.content)) {
                return ChainHelper.getErrorResponse(
                    "I couldn't find enough script content to analyze. Please provide more content or start with a basic story outline.",
                    'error_response'
                );
            }

            // Get existing analysis if any
            const existingAnalysis = processedScript.elements.analysis || [];

            // Format the prompt
            const fallbackPrompt = [{
                    role: 'system',
                    content: 'You are a skilled script analyst specializing in comprehensive story analysis.'
                },
                {
                    role: 'user',
                    content: `Please provide a comprehensive analysis of this script:\n\n${processedScript.content}`
                }
            ];

            const formattedPrompt = await ChainHelper.handlePromptFormatting(
                promptManager,
                'scriptAnalysis', {
                    content: processedScript.content,
                    existingAnalysis: existingAnalysis.length > 0 ?
                        existingAnalysis.map(a => a.content).join('\n') : 'No existing analysis found',
                    focus: prompt || 'Provide a comprehensive analysis of the script'
                },
                fallbackPrompt
            );

            // Execute the chain
            console.log('Executing script analysis chain...');
            const response = await this.execute(formattedPrompt);
            console.log('Script analysis complete, validating format...');

            try {
                // Validate the analysis format
                const validatedAnalysis = await this.validateAnalysis(response);

                // Save if scriptId provided
                if (scriptId) {
                    await this.saveAnalysisElements(scriptId, validatedAnalysis);
                }

                return validatedAnalysis;
            } catch (validationError) {
                console.error('Analysis validation failed:', validationError);
                return ChainHelper.getUnstructuredResponse(response, {
                    type: 'unstructured_analysis',
                    prefix: "I analyzed the script but couldn't format the results properly. Here's what I found: "
                });
            }
        } catch (error) {
            console.error('Script analysis error:', error);
            return ChainHelper.getErrorResponse(
                "I'm sorry, I encountered an error analyzing the script. Please try again with a more detailed script or outline.",
                'error_response'
            );
        }
    }
}