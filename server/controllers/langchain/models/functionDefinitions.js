import { VALID_INTENTS, FUNCTION_DEFINITIONS } from '../constants.js';

export const INTENT_FUNCTION = {
    name: "classify_intent",
    description: "Classify the user's intent into a predefined category",
    parameters: {
        type: "object",
        properties: {
            intent: {
                type: "string",
                enum: Object.values(VALID_INTENTS),
                description: "The classified intent"
            }
        },
        required: ["intent"]
    }
};

export const IS_FUNCTION_FUNCTION = {
    name: "list_functions",
    description: "Determine if the user's prompt is requesting one or more executions such as saving a new script or saving a story element. Or changing previously saved values. Return an array of objects that can be executed.",
    parameters: {
        type: "object",
        properties: {
            function_call: {
                type: "array",
                description: "Array of functions that can be executed",
                items: {
                    type: "object",
                    properties: {
                        function: {
                            type: "string",
                            enum: Object.values(FUNCTION_DEFINITIONS)
                        },
                        value: {
                            type: "string",
                            description: "Value for the function"
                        }
                    }
                },
                required: ["function", "value"]
            }
        },
        required: ["function_call"]
    }
};