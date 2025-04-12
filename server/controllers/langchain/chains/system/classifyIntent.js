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

// Initialize with registered intents
let registeredIntents = Object.values(INTENT_TYPES);
let intentDescriptions = '';

// Function to get intent descriptions from registered intents
function refreshIntentDescriptions() {
    // Combine factory registered intents with system intents
    const factoryIntents = chainFactory.getRegisteredIntents();
    registeredIntents = [...new Set([...Object.values(INTENT_TYPES), ...factoryIntents])];

    intentDescriptions = '';
    for (const intent of registeredIntents) {
        const description = INTENT_DESCRIPTIONS[intent] || 'No description available';
        intentDescriptions += `${intent}: ${description}\n`;
    }
    console.log('Available intents:', registeredIntents);
}

// Consolidated prompt template that includes both system and user messages
const template = `You are an intent classifier for a script writing assistant.
Your job is to classify the user's command and extract relevant information.

Common command patterns and their intents:
- Editing commands (change, replace, modify text/names/elements) -> EDIT_SCRIPT
- Script discussion (questions, feedback, analysis, scene lists, beat breakdowns) -> SCRIPT_QUESTIONS
- Creative requests (brainstorming, ideas, inspiration, writer's block) -> GET_INSPIRATION
- Requests for complete script analysis -> ANALYZE_SCRIPT
- Saving script elements or components -> SAVE_ELEMENT
- Multiple operations in one request -> MULTI_INTENT
- Writing script content -> WRITE_SCRIPT

For SAVE_ELEMENT intents, you must identify:
1. The type of element being saved (character, location, scene, plot_point, etc.)
2. The content/value to be saved

Available intents and their descriptions:
{intents}

User input: {text}

Return a JSON object with the following structure for SAVE_ELEMENT:
  "intent": "SAVE_ELEMENT",
  "target": "element_type",
  "value": object or string

For other intents, return just:
  "intent": "INTENT_TYPE"

Example responses:
For edit commands:
{{"intent": "EDIT_SCRIPT"}}

For questions:
{{"intent": "SCRIPT_QUESTIONS"}}

For saving a character:
{{"intent": "SAVE_ELEMENT", "target": "character", "value": {{"name": "John", "traits": ["brave"]}}}}

For saving a location:
{{"intent": "SAVE_ELEMENT", "target": "location", "value": {{"name": "Police Station", "description": "A busy precinct"}}}}`

const promptTemplate = new PromptTemplate({
    template: template,
    inputVariables: ["text", "intents"]
});

// Create the output parser
const outputParser = new StringOutputParser();

// Process the response
function processResponse(response) {
    try {
        // Clean and parse the response
        const cleanedResponse = response.replace(/```.*\n|\n```|```/g, '').trim();
        console.log('Cleaned response:', cleanedResponse);
        const parsedResponse = JSON.parse(cleanedResponse);
        console.log('Parsed intent response:', parsedResponse);

        // Make sure we have the latest registered intents
        refreshIntentDescriptions();

        // Normalize the intent
        const normalizedIntent = parsedResponse.intent.toUpperCase();

        // Validate the intent
        if (!registeredIntents.includes(normalizedIntent)) {
            console.log('Invalid intent, defaulting to EVERYTHING_ELSE');
            return {
                intent: INTENT_TYPES.EVERYTHING_ELSE,
                confidence: 0.5,
                target: null,
                value: null
            };
        }

        // For SAVE_ELEMENT, ensure we have target and value
        if (normalizedIntent === INTENT_TYPES.SAVE_ELEMENT) {
            if (!parsedResponse.target || !parsedResponse.value) {
                throw new Error('Missing target or value for SAVE_ELEMENT intent');
            }

            return {
                intent: normalizedIntent,
                confidence: 1.0,
                target: parsedResponse.target.toLowerCase(),
                value: parsedResponse.value
            };
        }

        // For other intents
        return {
            intent: normalizedIntent,
            confidence: 1.0,
            target: null,
            value: null
        };

    } catch (error) {
        console.error('Intent classification error:', error);
        return {
            intent: INTENT_TYPES.EVERYTHING_ELSE,
            confidence: 0.5,
            target: null,
            value: null
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
            target: null,
            value: null
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
            target: null,
            value: null
        };
    }
}