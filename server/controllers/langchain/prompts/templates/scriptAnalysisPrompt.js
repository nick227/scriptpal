import { PromptTemplate } from '@langchain/core/prompts';
import { COMMON_PROMPT_INSTRUCTIONS } from '../../constants.js';

export const scriptAnalysisTemplate = new PromptTemplate({
  template: `${COMMON_PROMPT_INSTRUCTIONS.SYSTEM_PREFIX}

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
