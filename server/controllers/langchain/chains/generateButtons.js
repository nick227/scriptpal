import { regularModel } from '../models/chatModels.js';
import { buttonPrompt } from '../prompts/prompts.js';

export async function generateButtons(prompt, html) {
    const chain = buttonPrompt.pipe(regularModel);
    const result = await chain.invoke({ prompt, html });
    const content = result.kwargs && result.kwargs.content || result.content;
    return content
        .split(",")
        .map((b) => b.trim())
        .filter((b) => b);
}