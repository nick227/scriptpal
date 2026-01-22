import { regularModel as _regularModel, cheapModel } from '../models/chatModels.js';
import { createResponsePrompts } from '../prompts/prompts.js';
import { ChainHelper } from './helpers/ChainHelper.js';

export async function generateResponse(input, intent, script) {
  const rawContent = script?.content || '';
  const normalizedContent = ChainHelper.extractTextFromStructuredContent(rawContent) ?? rawContent;
  const scriptContent = script
    ? `Script title: ${script.title}\n\nScript content: ${normalizedContent.substring(0, 1000)}`
    : '';
  const scriptTitle = script ? script.title : '';

  const responsePrompts = createResponsePrompts(scriptContent, scriptTitle);
  const responsePrompt = responsePrompts[intent || 'default'];

  const chain = responsePrompt.pipe(cheapModel);
  const result = await chain.invoke({ input });
  return result.content;
}
