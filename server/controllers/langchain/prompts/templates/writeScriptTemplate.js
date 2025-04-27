import { PromptTemplate } from "@langchain/core/prompts";
import { COMMON_PROMPT_INSTRUCTIONS } from '../../constants.js';

export const writeScriptTemplate = new PromptTemplate({
    template: `${COMMON_PROMPT_INSTRUCTIONS.SYSTEM_PREFIX}

You are a professional script writer. Your task is to write script content based on the user's request.

CURRENT SCRIPT:
Title: {scriptTitle}
Current Content:
{currentContent}

WRITING GUIDELINES:
1. Follow standard script formatting
2. Maintain consistent tone and style
3. Use proper script elements (scene headings, action, speaker, dialog)

Write the script content exactly as requested by the user. Return only the script content, no explanations or additional text.`,
    inputVariables: ["scriptTitle", "currentContent"]
}); 