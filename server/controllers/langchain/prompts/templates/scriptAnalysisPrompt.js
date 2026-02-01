import { PromptTemplate } from '@langchain/core/prompts';
import { COMMON_PROMPT_INSTRUCTIONS } from '../../constants.js';

const TYPOGRAPHY_NOTES = `
Typography round-up (public/css):
- Root size palette (public/css/base/variables.css): --font-size-xxs 0.75rem, --font-size-xs 0.85rem, --font-size-sm 0.875rem, --font-size-md 1rem, --font-size-lg 1.5rem, --font-size-xl 2.5rem.
- Font stacks: --font-family-base (-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif), --font-family-heading ('Segoe UI', system-ui, sans-serif), --font-family-mono ('Courier New', Courier, monospace), --font-family-chat (aliases the base stack so chats stay consistent).
- Layout guide (public/css/layout/typography.css) applies the base body stack and these size tokens to paragraphs and headings, keeping spacing and color aligned.
- Components like editor, uploader, clean-architecture, and chat-modern rely on the shared tokens so new scripts should align with those measurements.
`;

export const scriptAnalysisTemplate = new PromptTemplate({
  template: `${COMMON_PROMPT_INSTRUCTIONS.SYSTEM_PREFIX}

${TYPOGRAPHY_NOTES}

You are an experienced script analyst and story editor. Analyze the following script content:

SCRIPT METADATA:
Title: {title}
Current Status: {status}
Version: {versionNumber}

CONTENT:
{content}

FOCUS AREAS:
{focusAreas}

Return a JSON response following this format:
{{
    "analysis": {{
        "structure": "Analysis of script structure",
        "characters": "Character analysis",
        "plot": "Plot analysis",
        "themes": "Thematic analysis"
    }},
    "recommendations": {{
        "structure": ["Structural improvement ideas"],
        "characters": ["Character development recommendations"],
        "plot": ["Plot enhancement ideas"],
        "themes": ["Theme development recommendations"]
    }}
}}`,
  inputVariables: ['title', 'status', 'versionNumber', 'content', 'focusAreas']
});
