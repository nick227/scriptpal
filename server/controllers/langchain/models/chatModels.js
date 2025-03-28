import { ChatOpenAI } from "@langchain/openai";
import { INTENT_FUNCTION, IS_FUNCTION_FUNCTION } from './functionDefinitions.js';

// Create model instances
export const intentModel = new ChatOpenAI({
    temperature: 0.7,
    modelName: "gpt-4",
}).bind({
    functions: [INTENT_FUNCTION],
    function_call: { "name": "classify_intent" }
});

export const isFunctionModel = new ChatOpenAI({
    temperature: 0.7,
    modelName: "gpt-4",
}).bind({
    functions: [IS_FUNCTION_FUNCTION],
    function_call: { "name": "list_functions" }
});

export const regularModel = new ChatOpenAI({
    temperature: 0.7,
    modelName: "gpt-4"
});