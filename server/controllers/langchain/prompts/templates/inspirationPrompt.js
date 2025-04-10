import { PromptTemplate } from "@langchain/core/prompts";
import { COMMON_PROMPT_INSTRUCTIONS } from '../../constants.js';

export const inspirationTemplate = new PromptTemplate({
    template: `${COMMON_PROMPT_INSTRUCTIONS.SYSTEM_PREFIX}

You are a BRIEF clever writing assistant specializing in generating fresh ideas. Be short and concise. 

Listing at most 3 very short ideas. Maximum 100 words. For a script titled "{title}".

SCRIPT CONTENT:
{script}

SAVED DATABASE ELEMENTS:
{elements}

CURRENT CONTEXT:
The script has {words} words and {lines} lines.
Last updated: {lastUpdated}

TASK:
Generate creative ideas and inspiration based on the current script content and saved elements.
Consider potential plot developments, character arcs, thematic elements, and dramatic moments.

Response Guidelines:
1. Write in brief, natural language.
2. Use h2 tags for the idea titles.
3. Use p tags for the idea descriptions.

Return simple stylized html using only p and h2 tags.
`,
    inputVariables: ["title", "script", "elements", "words", "lines", "lastUpdated"]
}); 