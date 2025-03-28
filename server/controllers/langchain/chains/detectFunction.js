import { isFunctionModel } from '../models/chatModels.js';
import { isFunctionPrompt } from '../prompts/prompts.js';

export async function isFunctionRequest(input) {
    const chain = isFunctionPrompt.pipe(isFunctionModel);
    const result = await chain.invoke({
        input
    });

    return result.additional_kwargs && result.additional_kwargs.function_call;
}