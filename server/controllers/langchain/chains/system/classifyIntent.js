import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { INTENT_TYPES, INTENT_DESCRIPTIONS } from '../../constants.js';
import { chainRegistry } from '../registry.js';

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
    try {
        // Combine registry registered intents with system intents
        const registryIntents = chainRegistry.getRegisteredIntents();
        if (!registryIntents || !Array.isArray(registryIntents)) {
            console.error('Invalid registry intents:', registryIntents);
            return;
        }

        // Deduplicate and normalize intents
        registeredIntents = [...new Set([...Object.values(INTENT_TYPES), ...registryIntents])]
            .filter(intent => intent && typeof intent === 'string')
            .map(intent => intent.toUpperCase());

        // Build descriptions
        intentDescriptions = registeredIntents
            .map(intent => {
                const description = INTENT_DESCRIPTIONS[intent] || 'No description available';
                return `${intent}: ${description}`;
            })
            .join('\n');

    } catch (error) {
        console.error('Error refreshing intent descriptions:', error);
        // Keep previous values on error
    }
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

        let parsedResponse;
        try {
            parsedResponse = JSON.parse(cleanedResponse);
        } catch (parseError) {
            console.error('Failed to parse response:', parseError);
            return defaultResponse('Failed to parse classification response');
        }

        // Make sure we have the latest registered intents
        refreshIntentDescriptions();

        // Validate parsed response
        if (!parsedResponse || typeof parsedResponse !== 'object') {
            console.error('Invalid response format:', parsedResponse);
            return defaultResponse('Invalid response format');
        }

        // Normalize and validate the intent
        const normalizedIntent = (parsedResponse.intent || '').toUpperCase();
        if (!normalizedIntent) {
            console.error('Missing intent in response');
            return defaultResponse('Missing intent in response');
        }

        // Validate the intent exists
        if (!registeredIntents.includes(normalizedIntent)) {
            console.log(`Invalid intent ${normalizedIntent}, defaulting to EVERYTHING_ELSE`);
            return defaultResponse(`Invalid intent: ${normalizedIntent}`);
        }

        // For SAVE_ELEMENT, ensure we have target and value
        if (normalizedIntent === INTENT_TYPES.SAVE_ELEMENT) {
            if (!parsedResponse.target || !parsedResponse.value) {
                console.error('Missing target or value for SAVE_ELEMENT intent');
                return defaultResponse('Invalid SAVE_ELEMENT format');
            }

            return {
                intent: normalizedIntent,
                confidence: 1.0,
                target: parsedResponse.target.toLowerCase(),
                value: parsedResponse.value
            };
        }

        // For other intents, return normalized response
        return {
            intent: normalizedIntent,
            confidence: 1.0,
            target: null,
            value: null
        };

    } catch (error) {
        console.error('Intent classification error:', error);
        return defaultResponse(error.message);
    }
}

// Helper for consistent default responses
function defaultResponse(reason = 'Unknown error') {
    return {
        intent: INTENT_TYPES.EVERYTHING_ELSE,
        confidence: 0.5,
        target: null,
        value: null,
        reason
    };
}

// Create the chain
const chain = promptTemplate
    .pipe(model)
    .pipe(outputParser)
    .pipe(processResponse);

export async function classifyIntent(input) {
    // Input validation
    if (!input) {
        console.error('Empty input provided to classifyIntent');
        return defaultResponse('Empty input');
    }

    // Convert input to string if it's not already
    const processedInput = typeof input === 'string' ? input : JSON.stringify(input);

    try {
        // Ensure we have up-to-date intent descriptions
        refreshIntentDescriptions();

        // Single classification attempt
        const result = await chain.invoke({
            text: processedInput,
            intents: intentDescriptions.trim()
        });

        // Log the final classification result
        console.log('Final Intent Classification:', result);

        return result;

    } catch (error) {
        console.error('Intent classification error:', error);
        return defaultResponse(error.message);
    }
}