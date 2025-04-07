import { isFunctionPrompt } from "../prompts/isFunctionPrompt.js";

export const checkFunctionRequest = async(prompt) => {
    const messages = await isFunctionPrompt.formatMessages({
        input: prompt
    });

    const response = await model.invoke(messages);
    return response.content.toLowerCase() === "true";
};