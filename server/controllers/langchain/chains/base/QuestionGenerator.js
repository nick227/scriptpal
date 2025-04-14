import { ChatOpenAI } from "@langchain/openai";
import { ChainHelper } from '../helpers/ChainHelper.js';
import { RunnableSequence } from "@langchain/core/runnables";
import { ChatPromptTemplate, SystemMessagePromptTemplate, HumanMessagePromptTemplate } from "@langchain/core/prompts";
import { JsonOutputParser } from "@langchain/core/output_parsers";

export class QuestionGenerator {
    constructor(model) {
        // Convert raw OpenAI client to LangChain ChatOpenAI
        this.model = new ChatOpenAI({
            modelName: 'gpt-4-turbo-preview',
            temperature: 0.8,
            maxTokens: 500
        });
    }

    parseJsonResponse(response) {
        try {
            // First try parsing as is
            try {
                return JSON.parse(response);
            } catch (e) {
                // If that fails, try cleaning markdown formatting
                const cleaned = response.replace(/```json\n|\n```|```/g, '').trim();
                return JSON.parse(cleaned);
            }
        } catch (error) {
            console.error('Failed to parse JSON response:', error);
            return null;
        }
    }

    async generateQuestions(context, prompt, responseContent) {
        try {
            // Define the output parser
            const outputParser = new JsonOutputParser();

            const systemTemplate =
                `You are a helpful AI that generates follow-up prompts. 
                
                Generate 4 contextual follow-up prompts that predict what the user might want to explore next.

                Mix of questions and instructions.

                So for example:
                - Question: What is the main character's motivation?
                - Instruction: Add a new character.

Guidelines for prompts:
- Natural conversation continuations
- Mix of questions and instructions
- Under 15 words each
- Specific to current context
- Reference previous details
- Help gather missing information
- Avoid generic instructions

Your response must be a valid JSON object with a "prompts" array containing exactly 4 strings.`;

            const humanTemplate =
                `Context:
Script Title: {scriptTitle}
Last Message: {userPrompt}
Previous Response: {assistantResponse}

Generate 4 follow-up prompts based on this context.`;

            // Create chat prompt template
            const chatPrompt = ChatPromptTemplate.fromMessages([
                SystemMessagePromptTemplate.fromTemplate(systemTemplate),
                HumanMessagePromptTemplate.fromTemplate(humanTemplate)
            ]);

            // Create the chain
            const chain = RunnableSequence.from([
                chatPrompt,
                this.model
            ]);

            console.log('Making completion request...');

            // Execute chain with timeout
            const completionPromise = chain.invoke({
                scriptTitle: context.scriptTitle || 'Untitled',
                userPrompt: prompt,
                assistantResponse: responseContent
            });

            const result = await Promise.race([
                completionPromise,
                new Promise((_, reject) => setTimeout(() => reject(new Error('Question generation timed out')), 30000))
            ]).catch(error => {
                console.error('Chain execution error or timeout:', error);
                return null;
            });

            if (!result) {
                console.log('Chain execution failed or timed out, using defaults');
                return ChainHelper.getDefaultQuestions().map(q => ({ text: q }));
            }

            // Parse the response content
            const parsed = this.parseJsonResponse(result.content);
            if (!parsed || !parsed.prompts || !Array.isArray(parsed.prompts)) {
                console.warn('Invalid prompts array returned:', result);
                return ChainHelper.getDefaultQuestions().map(q => ({ text: q }));
            }

            const cleanedPrompts = parsed.prompts
                .map(p => typeof p === 'string' ? p.trim() : null)
                .filter(p => p && p.length > 0 && p.split(' ').length <= 15)
                .map(p => ({ text: p }));

            if (cleanedPrompts.length < 4) {
                console.warn('Not enough valid prompts after cleaning:', cleanedPrompts);
                return ChainHelper.getDefaultQuestions().map(q => ({ text: q }));
            }

            const finalPrompts = cleanedPrompts.slice(0, 4);
            console.log('Successfully generated 4 valid follow-up prompts:', finalPrompts);
            return finalPrompts;

        } catch (error) {
            console.error('Question generation error:', error);
            return ChainHelper.getDefaultQuestions().map(q => ({ text: q }));
        }
    }
}