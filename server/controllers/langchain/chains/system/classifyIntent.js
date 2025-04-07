import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { INTENT_TYPES, INTENT_DESCRIPTIONS } from '../../constants.js';
import { chainFactory } from '../ChainFactory.js';

// Create the model instance
const model = new ChatOpenAI({
    modelName: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
    temperature: 0.3
});

// Initialize with registered intents - this will be populated after ChainFactory is initialized
let registeredIntents = [];
let intentDescriptions = '';

// Function to get intent descriptions from registered intents
function refreshIntentDescriptions() {
    // Get registered intents
    registeredIntents = chainFactory.getRegisteredIntents();

    // Prepare descriptions for registered intents
    intentDescriptions = '';
    for (const intent of registeredIntents) {
        const description = INTENT_DESCRIPTIONS[intent] || 'No description available';
        intentDescriptions += `${intent}: ${description}\n`;
    }
}

// Create the prompt template
const template = [
    'You are an intent classifier for a script writing assistant.',
    'Analyze the user\'s input and determine their primary intent.',
    '',
    'Available intents and their descriptions:',
    '{intents}',
    'User input: {text}',
    '',
    'Return ONLY the intent type as a single word or phrase from the list above.',
    'Example: scene_list',
    '',
    'Do not include any other text, JSON formatting, or explanation.'
].join('\n');

const promptTemplate = new PromptTemplate({
    template: template,
    inputVariables: ["text", "intents"]
});

// Create the output parser
const outputParser = new StringOutputParser();

// Process the response
function processResponse(response) {
    try {
        // Clean and normalize the response
        const cleanedResponse = response.replace(/```.*\n|\n```|```/g, '').trim().toLowerCase();

        // Make sure we have the latest registered intents
        if (registeredIntents.length === 0) {
            refreshIntentDescriptions();
        }

        // Only allow registered intents
        const validIntent = registeredIntents.find(type =>
            type.toLowerCase() === cleanedResponse
        ) || INTENT_TYPES.EVERYTHING_ELSE;

        return {
            intent: validIntent,
            confidence: 1.0,
            target: {
                type: null,
                id: null,
                context: ''
            }
        };
    } catch (error) {
        console.error('Intent classification error:', error);
        return {
            intent: INTENT_TYPES.EVERYTHING_ELSE,
            confidence: 0.5,
            target: {
                type: null,
                id: null,
                context: ''
            }
        };
    }
}

// Create the chain
const chain = promptTemplate
    .pipe(model)
    .pipe(outputParser)
    .pipe(processResponse);

export async function classifyIntent(input) {
    if (!input || typeof input !== 'string') {
        console.error('Invalid input type provided to classifyIntent');
        return {
            intent: INTENT_TYPES.EVERYTHING_ELSE,
            confidence: 0.5,
            target: {
                type: null,
                id: null,
                context: ''
            }
        };
    }

    try {
        // Ensure we have up-to-date intent descriptions
        refreshIntentDescriptions();

        return await chain.invoke({
            text: input,
            intents: intentDescriptions.trim()
        });
    } catch (error) {
        console.error('Intent classification error:', error);
        return {
            intent: INTENT_TYPES.EVERYTHING_ELSE,
            confidence: 0.5,
            target: {
                type: null,
                id: null,
                context: ''
            }
        };
    }
}