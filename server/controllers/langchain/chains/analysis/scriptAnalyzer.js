import { BaseChain } from '../base/BaseChain.js';
import { promptManager } from '../../prompts/index.js';
import { ERROR_TYPES } from '../../constants.js';
import db from '../../../../db/index.js';

export class ScriptAnalyzerChain extends BaseChain {
    constructor(config = {}) {
        super({
            ...config,
            maxTokens: 4000 // Ensure enough tokens for comprehensive analysis
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
            const { scriptId = null, prompt = null } = context;

            // Get script content - could be an object, string, or null
            let scriptContent = input;

            // If input seems to be the prompt instead of the script content
            if (typeof input === 'string' && input.length < 500 && prompt) {
                scriptContent = prompt;
            }

            // Handle script object vs raw content
            const processedScript = this.preprocessScript(scriptContent);

            // Check if we actually have any content to analyze
            if (!processedScript.content || processedScript.content.trim().length < 10) {
                return {
                    response: "I couldn't find enough script content to analyze. Please make sure you've selected a valid script with dialogue and scenes.",
                    type: 'error_response'
                };
            }
            console.log('\n=========================================');
            console.log('\n=========================================');
            console.log('\n=========================================');
            console.log('\n=== scriptAnalyzer ===============');
            console.log(`Analyzing script: ${processedScript.title} (${processedScript.content.length} chars)`);

            // Format the prompt using prompt manager
            const formattedPrompt = await promptManager.formatPrompt('scriptAnalysis', {
                title: processedScript.title,
                status: processedScript.status,
                version: processedScript.version_number,
                content: processedScript.content
            }).catch(err => {
                console.error('Error formatting prompt:', err);
                // Fallback to basic prompt if promptManager fails
                return [
                    { role: 'system', content: 'You are a script analysis assistant. Provide a comprehensive analysis of the script, including story structure, characters, themes, plot, and dialogue. Focus on giving actionable feedback.' },
                    { role: 'user', content: `Please analyze this script:\n\nTitle: ${processedScript.title}\n\n${processedScript.content}` }
                ];
            });

            // Execute the chain
            console.log('Executing analysis chain...');
            const response = await this.execute(formattedPrompt);
            console.log('Analysis complete, processing response...');

            // Process the response
            const { analysis } = await this.validateAnalysis(response);

            // Save if scriptId provided
            if (scriptId) {
                await this.saveAnalysisResults(scriptId, analysis);
            }

            return {
                response: analysis,
                type: 'complete_analysis'
            };

        } catch (error) {
            console.error('Script analysis error:', error);
            return {
                response: "I'm sorry, I encountered an error analyzing your script. Please try again.",
                type: 'error_response',
                error: error.message
            };
        }
    }
}