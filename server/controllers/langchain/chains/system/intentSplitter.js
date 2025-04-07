import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { CHAIN_CONFIG, ERROR_TYPES } from '../../constants.js';

// Create the splitter prompt template
const splitterPrompt = PromptTemplate.fromTemplate(`
You are an AI script writing assistant. The user has provided a request with multiple intents.
Break down their request into separate, individual intents that can be processed independently.

User Input: {input}

For each intent, provide:
1. The specific request
2. Any relevant context
3. The order of operations

Return ONLY a JSON object in this exact format:

{{
    "intents": [
        {{
            "prompt": "the specific request",
            "context": "relevant contextual information",
            "order": number,
            "depends_on": [array of order numbers this intent depends on]
        }}
    ]
}}

Remember to only return valid JSON, no other text.`);

// Create the OpenAI model instance
const model = new ChatOpenAI({
    modelName: CHAIN_CONFIG.MODEL,
    temperature: CHAIN_CONFIG.TEMPERATURE
});

/**
 * Validates the split intents
 */
function validateSplitIntents(result) {
    if (!Array.isArray(result.intents)) {
        throw new Error(ERROR_TYPES.INVALID_FORMAT);
    }

    // Validate each intent has required fields
    result.intents.forEach(intent => {
        if (!intent.prompt || !intent.order) {
            throw new Error(ERROR_TYPES.MISSING_REQUIRED);
        }
    });

    return result;
}

/**
 * Splits a multi-intent request into individual intents
 */
export async function splitIntent(input) {
    try {
        // Format the prompt
        const formattedPrompt = await splitterPrompt.format({
            input: input
        });

        // Get split intents from model
        const response = await model.invoke(formattedPrompt);

        // Parse and validate the response
        const splitIntents = JSON.parse(response.content);
        return validateSplitIntents(splitIntents);

    } catch (error) {
        console.error('Intent splitting error:', error);
        throw new Error(ERROR_TYPES.CHAIN_ERROR);
    }
}