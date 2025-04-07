import { createResponsePrompts } from "../prompts/createResponsePrompts.js";

export const generateResponse = async(prompt, intent, script = null) => {
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