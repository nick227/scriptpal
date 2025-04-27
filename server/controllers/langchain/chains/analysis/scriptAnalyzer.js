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

    /**
     * Build messages for script analysis
     */
    async buildMessages(context, prompt) {
        // Log incoming context for debugging
        console.log('Building Analysis Messages:', {
            hasScriptContent: !!context.scriptContent,
            hasScriptTitle: !!context.scriptTitle,
            providedTitle: context.scriptTitle
        });

        // Extract script content from context or use prompt as content
        let scriptContent = context.scriptContent || prompt;
        let scriptTitle = context.scriptTitle || 'Untitled Script';

        // Process the script
        const processedScript = ChainHelper.preprocessScript(scriptContent, {
            includeElements: true,
            elementType: 'analysis'
        });

        // Log final title being used
        console.log('Analysis using title:', scriptTitle);

        // Validate content
        if (!ChainHelper.validateContent(processedScript.content)) {
            console.log('Content validation failed');
            throw new Error('insufficient_content');
        }

        // Get existing analysis if any
        const existingAnalysis = (processedScript.elements && processedScript.elements.analysis) || [];

        // Return formatted messages
        return [{
            role: 'system',
            content: `You are a skilled script analyst specializing in brief direct story analysis. Focus on the core narrative elements:

1. Story ideas: Identify structural ideas and pacing fixes
2. Character Development: Suggest character arcs and motivations
3. Dialog: Assess authenticity and subtext in conversations
4. Actions: Suggest what can happen next ideas
5. Theme: Examine thematic consistency and impact

Avoid generic or obvious statements. Be direct and specific. Support criticism with concrete examples from the script and provide actionable suggestions for improvement. Prioritize insights that will most impact the story's effectiveness.`
        }, {
            role: 'user',
            content: `Please analyze this script, 

            Then write a very short analysis of the script.

            Return the analysis in simple p and h2 tags.

            Break up the analysis into small sections for easy reading.
            
            Title: ${scriptTitle}
            
            ${processedScript.content}`
        }];
    }

    /**
     * Override run to handle the analysis-specific error case
     */
    async run(context, prompt) {
        try {
            // Build messages and execute
            const messages = await this.buildMessages(context, prompt);
            const chainConfig = context.chainConfig || {};
            const modelConfig = {
                ...(chainConfig.modelConfig || {}),
                response_format: { type: "text" }
            };

            const result = await this.execute(messages, {
                context,
                scriptId: context.scriptId,
                scriptTitle: context.scriptTitle,
                userId: context.userId,
                modelConfig
            }, false); // Disable question generation for analysis

            // Validate and format the analysis
            const validatedResult = await this.validateAnalysis(result);

            // Save analysis results if we have a scriptId
            if (context.scriptId) {
                await this.saveAnalysisResults(context.scriptId, validatedResult.analysis);
            }

            // Return formatted response matching other chains
            return {
                response: validatedResult.analysis,
                type: this.type,
                metadata: {
                    scriptId: context.scriptId,
                    scriptTitle: context.scriptTitle || 'Untitled Script',
                    timestamp: new Date().toISOString(),
                    intent: INTENT_TYPES.ANALYZE_SCRIPT,
                    analysisType: 'comprehensive'
                },
                // Match other chains' response format
                success: true,
                questions: [] // Empty array since questions are disabled
            };
        } catch (error) {
            if (error.message === 'insufficient_content') {
                return {
                    response: "I couldn't find enough script content to analyze. Please provide a script or outline to analyze.",
                    type: this.type,
                    metadata: {
                        error: 'insufficient_content',
                        scriptId: context.scriptId,
                        scriptTitle: context.scriptTitle || 'Untitled Script',
                        timestamp: new Date().toISOString(),
                        intent: INTENT_TYPES.ANALYZE_SCRIPT
                    },
                    success: false,
                    questions: []
                };
            }
            throw error;
        }
    }
}