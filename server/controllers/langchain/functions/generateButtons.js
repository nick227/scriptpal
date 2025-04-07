import { buttonPrompt } from "../prompts/buttonPrompt.js";

export const generateButtons = async(prompt, html) => {
    const messages = await buttonPrompt.formatMessages({
        prompt: prompt,
        html: html
    });

    const response = await model.invoke(messages);
    return response.content.split(",").map(button => button.trim());
};