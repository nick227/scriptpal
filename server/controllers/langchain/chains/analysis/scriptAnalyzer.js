import { BaseChain } from '../base/BaseChain.js';
import { promptManager } from '../../prompts/index.js';
import { ERROR_TYPES, TOKEN_LIMITS, INTENT_TYPES } from '../../constants.js';
import { ChainHelper } from '../helpers/ChainHelper.js';
import db from '../../../../db/index.js';

export class ScriptAnalyzerChain extends BaseChain {
    constructor(config = {}) {
        super({
            ...config,
            maxTokens: TOKEN_LIMITS.ANALYSIS // Use analysis-specific token limit
        });
    }

    async validateAnalysis(result) {
        try {
            // If result is a string, return it directly
            if (typeof result === 'string') {
                return { analysis: result };
            }

            // If it's JSON, convert to string narrative
            const analysisObject = typeof result === 'object' ? result : JSON.parse(result);

            // Combine all analysis sections into a single narrative
            const narrative = Object.entries(analysisObject)
                .filter(([key, value]) => value && typeof value === 'string')
                .map(([key, value]) => value)
                .join('\n\n');

            return { analysis: narrative || result };
        } catch (error) {
            // If any error occurs, return the original result as is
            return { analysis: result };
        }
    }

    async saveAnalysisResults(scriptId, analysis) {
        try {
            if (!scriptId) {
                console.log('No scriptId provided, skipping save');
                return;
            }

            // Save the complete analysis
            await db.createElement({
                script_id: scriptId,
                type: 'analysis',
                subtype: 'comprehensive',
                content: typeof analysis === 'string' ? analysis : JSON.stringify(analysis)
            }).catch(err => console.error('Error saving analysis:', err));
        } catch (error) {
            console.error('Error saving analysis results:', error);
        }
    }

    // Helper function to preprocess script content
    preprocessScript(scriptContent) {
        // If scriptContent is a string, use as is
        if (typeof scriptContent === 'string') {
            return {
                title: 'Untitled Script',
                status: 'Draft',
                version_number: '1.0',
                content: scriptContent
            };
        }

        // If scriptContent is null or undefined
        if (!scriptContent) {
            return {
                title: 'Untitled Script',
                status: 'Draft',
                version_number: '1.0',
                content: ''
            };
        }

        // Return with defaults for missing fields
        return {
            title: scriptContent.title || 'Untitled Script',
            status: scriptContent.status || 'Draft',
            version_number: scriptContent.version_number || '1.0',
            content: scriptContent.content || ''
        };
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
                return {
                    response: "I couldn't find enough script content to analyze. Please provide more content or start with a basic story outline.",
                    type: INTENT_TYPES.ANALYZE_SCRIPT,
                    metadata: {
                        error: 'insufficient_content',
                        timestamp: new Date().toISOString()
                    }
                };
            }

            // Get existing analysis if any
            const existingAnalysis = processedScript.elements.analysis || [];

            // Format the prompt
            const fallbackPrompt = [{
                role: 'system',
                content: 'You are a skilled script analyst specializing in comprehensive story analysis.'
            }, {
                role: 'user',
                content: `Please provide a comprehensive analysis of this script:\n\nTitle: ${processedScript.title}\n\n${processedScript.content}`
            }];

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

            // Execute the chain with context
            console.log('Executing script analysis chain...');
            return await this.execute(formattedPrompt, {
                scriptTitle: processedScript.title,
                metadata: {
                    scriptId: scriptId,
                    title: processedScript.title,
                    chars: processedScript.content.length,
                    words: processedScript.content.split(/\s+/).length,
                    lines: processedScript.content.split('\n').length,
                    lastUpdated: new Date().toISOString()
                }
            });

        } catch (error) {
            console.error('Script analysis error:', error);
            return {
                response: "I'm sorry, I encountered an error analyzing the script. Please try again with a more detailed script or outline.",
                type: INTENT_TYPES.ANALYZE_SCRIPT,
                metadata: {
                    error: error.message,
                    timestamp: new Date().toISOString()
                }
            };
        }
    }
}