import { regularModel, cheapModel } from '../models/chatModels.js';
import { createResponsePrompts } from '../prompts/prompts.js';

export async function generateResponse(input, intent, script) {
    const scriptContent = script ? 'Script title: ' + script.title + '\n\n' + ' Script content: ' + script.content.substring(0, 1000) : '';
    const scriptTitle = script ? script.title : '';

    const responsePrompts = createResponsePrompts(scriptContent, scriptTitle);
    const responsePrompt = responsePrompts[intent || 'default'];

    const chain = responsePrompt.pipe(cheapModel);
    const result = await chain.invoke({ input });
    return result.content;
}