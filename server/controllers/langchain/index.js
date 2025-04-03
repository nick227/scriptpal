// Export constants and types
export { VALID_INTENTS, INTENT_DESCRIPTIONS }
from './constants.js';

// Import chain dependencies
export { classifyIntent }
from './chains/classifyIntent.js';

// Import prompts and OpenAI
import { createResponsePrompts } from "./prompts/createResponsePrompts.js";
import { buttonPrompt } from "./prompts/buttonPrompt.js";
import { isFunctionPrompt } from "./prompts/isFunctionPrompt.js";
import { ChatOpenAI } from "@langchain/openai";

const model = new ChatOpenAI({
    modelName: "gpt-3.5-turbo",
    temperature: 0.7
});

// Chain functions
const generateResponse = async(prompt, intent, script = null) => {
    const scriptContent = script ? script.content : "";
    const scriptTitle = script ? script.title : "";

    const prompts = createResponsePrompts(scriptContent, scriptTitle);
    const selectedPrompt = prompts[intent] || prompts.default;

    const messages = await selectedPrompt.formatMessages({
        input: prompt,
        scriptContent: scriptContent,
        scriptTitle: scriptTitle
    });

    const response = await model.invoke(messages);
    return response.content;
};

const generateButtons = async(prompt, html) => {
    const messages = await buttonPrompt.formatMessages({
        prompt: prompt,
        html: html
    });

    const response = await model.invoke(messages);
    return response.content.split(",").map(button => button.trim());
};

const checkFunctionRequest = async(prompt) => {
    const messages = await isFunctionPrompt.formatMessages({
        input: prompt
    });

    const response = await model.invoke(messages);
    return response.content.toLowerCase() === "true";
};

// Export chain functions
export {
    generateResponse,
    generateButtons,
    checkFunctionRequest
};