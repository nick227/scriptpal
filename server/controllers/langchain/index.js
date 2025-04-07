// Export constants and types0
export { VALID_INTENTS, INTENT_DESCRIPTIONS }
from './constants.js';

// Import chain dependencies
export { classifyIntent }
from './chains/classifyIntent.js';

import dotenv from "dotenv";
dotenv.config();

// Import prompts and OpenAI
import { ChatOpenAI } from "@langchain/openai";

const model = new ChatOpenAI({
    modelName: process.env.OPENAI_MODEL,
    temperature: 0.7
});

// Chain functions
const generateResponse =
    import ('./functions/generateResponse.js');
const generateButtons =
    import ('./functions/generateButtons.js');
const checkFunctionRequest =
    import ('./functions/checkFunctionRequest.js');

// Export chain functions
export {
    generateResponse,
    generateButtons,
    checkFunctionRequest
};