import { BaseChain } from '../base/BaseChain.js';
import { promptManager } from '../../prompts/index.js';
import { ERROR_TYPES } from '../../constants.js';
import { ChainHelper } from '../helpers/ChainHelper.js';

export class ScriptQuestionsChain extends BaseChain {
    constructor(config = {}) {
        super({
            ...config,
            temperature: 0.3, // Lower temperature for more precise answers
            maxTokens: 2000
        });

        // Question type patterns for validation
        this.questionPatterns = {
            character: /\b(who|what|why|how).+(character|protagonist|antagonist|motivation|feel|think|want|relationship|conflict)\b/i,
            plot: /\b(what|why|how|when).+(happen|plot|story|event|scene|action|result|cause|lead|outcome)\b/i,
            theme: /\b(what|how|why).+(theme|meaning|message|symbolism|represent|metaphor|motif)\b/i,
            structure: /\b(how|what|where).+(structure|pacing|flow|act|begin|end|opening|closing|transition)\b/i
        };
    }

    formatResponse(response) {
        // If response is already a string, return it
        if (typeof response === 'string') {
            return response;
        }

        try {
            // If it's a JSON object with multiple fields, combine them
            if (typeof response === 'object') {
                if (response.answer && response.supporting_information) {
                    return `${response.answer}\n\n${response.supporting_information}`;
                }
                if (response.answer) {
                    return response.answer;
                }
                if (response.response) {
                    return response.response;
                }
                // If it's some other object structure, stringify it nicely
                return Object.entries(response)
                    .filter(([key, value]) => typeof value === 'string' && value.trim())
                    .map(([key, value]) => value)
                    .join('\n\n');
            }

            // If it's a JSON string, parse and format it
            const parsed = JSON.parse(response);
            return this.formatResponse(parsed);
        } catch (error) {
            // If parsing fails, return the original response
            return response.toString();
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

    validateQuestion(question) {
        if (!question || typeof question !== 'string') {
            return {
                isValid: false,
                error: "Please provide a question about the script."
            };
        }

        if (question.length < 5) {
            return {
                isValid: false,
                error: "Please ask a more detailed question about the script."
            };
        }

        // Detect question type
        const questionType = this.detectQuestionType(question);

        return {
            isValid: true,
            type: questionType,
            question: question
        };
    }

    detectQuestionType(question) {
        // Check against each pattern
        for (const [type, pattern] of Object.entries(this.questionPatterns)) {
            if (pattern.test(question)) {
                return type;
            }
        }

        // Default to general if no specific pattern matches
        return 'general';
    }

    enhanceQuestion(questionInfo, scriptTitle) {
        // Add type-specific context to the question
        const typePrompts = {
            character: `Regarding the script "${scriptTitle}", focus on character development, motivations, and relationships. Provide a single, comprehensive answer. `,
            plot: `Analyzing the script "${scriptTitle}", examine plot elements, cause-and-effect relationships, and story progression. Provide a single, comprehensive answer. `,
            theme: `In the script "${scriptTitle}", examine thematic elements, recurring motifs, and their significance. Provide a single, comprehensive answer. `,
            structure: `Looking at the script "${scriptTitle}", consider structural elements, pacing, and narrative organization. Provide a single, comprehensive answer. `,
            general: `For the script "${scriptTitle}", provide a single, comprehensive answer based on the script content. `
        };

        return {
            question: questionInfo.question,
            enhancedPrompt: typePrompts[questionInfo.type] + "Question: " + questionInfo.question
        };
    }

    async run(input, context = {}) {
        try {
            // Extract context with defaults
            const { prompt = null } = ChainHelper.extractContext(context);

            // Get script content and user's question
            let scriptContent = input;
            let userQuestion = prompt;

            // If input is the question and prompt is the script
            if (typeof input === 'string' && input.length < 500 && !input.includes('\n')) {
                userQuestion = input;
                scriptContent = prompt;
            }

            // Process the script with metadata
            const processedScript = this.preprocessScript(scriptContent);

            // Create compressed metadata
            const metadata = {
                chars: processedScript.content.length,
                words: processedScript.content.split(/\s+/).length,
                lines: processedScript.content.split('\n').length,
                scenes: (processedScript.content.match(/SCENE|INT\.|EXT\./gi) || []).length,
                characters: new Set(processedScript.content.match(/[A-Z]{2,}(?:\s+[A-Z]{2,})*(?=\s*[\n:])/g) || []).size
            };

            // Validate content
            if (!ChainHelper.validateContent(processedScript.content)) {
                return ChainHelper.getErrorResponse(
                    "I couldn't find any script content to analyze. Please make sure you've provided a script."
                );
            }

            // Validate and enhance the question
            const questionValidation = this.validateQuestion(userQuestion);
            if (!questionValidation.isValid) {
                return ChainHelper.getErrorResponse(questionValidation.error);
            }

            // Enhance the question with type-specific context and script title
            const enhancedQuestion = this.enhanceQuestion(questionValidation, processedScript.title);

            // Format the prompt
            const fallbackPrompt = [{
                role: 'system',
                content: `You are a script analysis assistant. Answer specific questions about the provided script accurately and concisely. 
Provide a single, comprehensive answer that incorporates all relevant information.
Do not separate your response into sections or return JSON.
Base your answers only on the actual content of the script.`
            }, {
                role: 'user',
                content: `📄 "${processedScript.title}" (${processedScript.status} v${processedScript.version_number})
📊 Stats: ${metadata.chars}c ${metadata.words}w ${metadata.lines}l ${metadata.scenes}s ${metadata.characters}ch

${processedScript.content}

❓ ${enhancedQuestion.enhancedPrompt}

Remember to provide a single, comprehensive answer without sections or JSON formatting.`
            }];

            const formattedPrompt = await ChainHelper.handlePromptFormatting(
                promptManager,
                'scriptQuestions', {
                    script: `📄 "${processedScript.title}" (${processedScript.status} v${processedScript.version_number})
📊 Stats: ${metadata.chars}c ${metadata.words}w ${metadata.lines}l ${metadata.scenes}s ${metadata.characters}ch

${processedScript.content}`,
                    question: `${enhancedQuestion.enhancedPrompt}\n\nProvide a single, comprehensive answer without sections or JSON formatting.`
                },
                fallbackPrompt
            );

            // Execute the chain
            console.log('Executing script questions chain...');
            console.log('Question type:', questionValidation.type);
            console.log('Script metadata:', {
                title: processedScript.title,
                ...metadata
            });
            const response = await this.execute(formattedPrompt);

            // Format the response to ensure a single text answer
            const formattedResponse = this.formatResponse(response);

            return {
                response: formattedResponse,
                type: 'script_question_answer',
                questionType: questionValidation.type,
                scriptTitle: processedScript.title,
                metadata: metadata
            };

        } catch (error) {
            console.error('Script questions error:', error);
            return ChainHelper.getErrorResponse(
                "I'm sorry, I encountered an error answering your question. Please try asking in a different way.",
                'error_response'
            );
        }
    }
}