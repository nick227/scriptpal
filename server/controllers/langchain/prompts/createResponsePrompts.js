import { ChatPromptTemplate, SystemMessagePromptTemplate, HumanMessagePromptTemplate } from "@langchain/core/prompts";
import { INTENT_TYPES, COMMON_PROMPT_INSTRUCTIONS, OUTPUT_FORMATS } from '../constants.js';

// Response prompts map
export const createResponsePrompts = (scriptContent = "", scriptTitle = "") => {
    const basePrompt = COMMON_PROMPT_INSTRUCTIONS.SYSTEM_PREFIX;
    const formatGuidelines = `\n\nResponse Guidelines:
- ${COMMON_PROMPT_INSTRUCTIONS.RESPONSE_GUIDELINES.FORMAT}
- ${COMMON_PROMPT_INSTRUCTIONS.RESPONSE_GUIDELINES.VALIDATION}
- ${COMMON_PROMPT_INSTRUCTIONS.RESPONSE_GUIDELINES.CONTEXT}`;

    return {
        /**
         * SCRIPT QUESTIONS HANDLER
         * Purpose: Answers specific questions about script content
         * Input: User's question about the script
         * Output: Simple HTML response using only <h2> and <p> tags
         * Variables: 
         * - scriptContent: The full script text
         * - input: User's question
         */
        [INTENT_TYPES.SCRIPT_QUESTIONS]: ChatPromptTemplate.fromMessages([
            SystemMessagePromptTemplate.fromTemplate(
                basePrompt + "\n\nAnalyze and answer questions about the script content. Provide clear, focused responses based on the actual content.\n\nScript content:\n{scriptContent}\n\nFormat your response using only HTML <h2> and <p> tags:\n- Use <h2> for section titles\n- Use <p> for explanatory text\n- Keep responses concise and direct\n- Focus on answering the specific question asked\n\nExample format:\n<h2>Character Analysis</h2>\n<p>John is the protagonist who...</p>"
            ),
            HumanMessagePromptTemplate.fromTemplate("{input}")
        ]),

        /**
         * CREATIVE INSPIRATION GENERATOR
         * Purpose: Generates creative ideas for script development
         * Input: User's request for inspiration
         * Output: Plain text creative ideas
         * Variables:
         * - scriptTitle: Title of the current script
         * - input: User's inspiration request
         */
        [INTENT_TYPES.GET_INSPIRATION]: ChatPromptTemplate.fromMessages([
            SystemMessagePromptTemplate.fromTemplate(
                basePrompt + "\n\nGenerate creative, unique ideas and thoughts in a clear, natural writing style. Focus on providing inspiring, actionable ideas that build on the existing script content. Return your response as plain text, not JSON.\n\nScript title: {scriptTitle}" + formatGuidelines
            ),
            HumanMessagePromptTemplate.fromTemplate("{input}")
        ]),

        /**
         * SCRIPT EDIT COMMAND PARSER
         * Purpose: Processes script editing requests into structured commands
         * Input: User's edit request
         * Output: JSON object with command, target, and value
         * Variables:
         * - scriptContent: Current script content
         * - input: User's edit request
         */
        [INTENT_TYPES.EDIT_SCRIPT]: ChatPromptTemplate.fromMessages([
            SystemMessagePromptTemplate.fromTemplate(
                basePrompt + "\n\nParse the edit request and return a structured command. You MUST return a JSON object with exactly these fields:\n" +
                "- command: The type of edit (REPLACE_CHARACTER_NAME, REPLACE_TEXT, MODIFY_SCENE_HEADING, MODIFY_DIALOGUE)\n" +
                "- target: What to edit (character name, specific text, etc.)\n" +
                "- value: The new value to apply\n\n" +
                "Example format:\n" + JSON.stringify(OUTPUT_FORMATS.EDIT_SCRIPT.example, null, 2) +
                "\n\nScript content:\n{scriptContent}" + formatGuidelines
            ),
            HumanMessagePromptTemplate.fromTemplate("{input}")
        ]),

        /**
         * ELEMENT SAVE COMMAND PARSER
         * Purpose: Processes requests to save script elements (characters, scenes, etc.)
         * Input: User's save request
         * Output: JSON object with target type and value
         * Variables:
         * - scriptContent: Current script content
         * - input: User's save request
         */
        [INTENT_TYPES.SAVE_ELEMENT]: ChatPromptTemplate.fromMessages([
            SystemMessagePromptTemplate.fromTemplate(
                basePrompt + "\n\nParse the save request and return a structured command. You MUST return a JSON object with exactly these fields:\n" +
                "- target: The type of element (CHARACTER, SCENE, DIALOGUE, PLOT_POINT)\n" +
                "- value: The data to save\n\n" +
                "Example format:\n" + JSON.stringify(OUTPUT_FORMATS.SAVE_ELEMENT.example, null, 2) +
                "\n\nScript content:\n{scriptContent}" + formatGuidelines
            ),
            HumanMessagePromptTemplate.fromTemplate("{input}")
        ]),

        /**
         * SCRIPT ANALYSIS PROCESSOR
         * Purpose: Provides comprehensive script analysis
         * Input: Request for script analysis
         * Output: Detailed analysis of structure, characters, plot, and themes
         * Variables:
         * - scriptContent: Full script content
         * - input: User's analysis request
         */
        [INTENT_TYPES.ANALYZE_SCRIPT]: ChatPromptTemplate.fromMessages([
            SystemMessagePromptTemplate.fromTemplate(
                basePrompt + "\n\nProvide a thorough analysis of the entire script, covering structure, characters, plot, themes, and potential improvements.\n\nScript content:\n{scriptContent}" + formatGuidelines
            ),
            HumanMessagePromptTemplate.fromTemplate("{input}")
        ]),

        /**
         * MULTI-INTENT REQUEST HANDLER
         * Purpose: Handles requests that combine multiple intents
         * Input: Complex multi-part request
         * Output: Structured response addressing each component
         * Variables:
         * - scriptContent: Full script content
         * - input: User's multi-part request
         */
        [INTENT_TYPES.MULTI_INTENT]: ChatPromptTemplate.fromMessages([
            SystemMessagePromptTemplate.fromTemplate(
                basePrompt + "\n\nAddress multiple aspects of the script request while maintaining focus and clarity for each part. Use appropriate output formats for each component.\n\nScript content:\n{scriptContent}" + formatGuidelines
            ),
            HumanMessagePromptTemplate.fromTemplate("{input}")
        ]),

        /**
         * GENERAL SCRIPT ASSISTANCE
         * Purpose: Handles miscellaneous script-related requests
         * Input: General script-related query
         * Output: Focused guidance on script writing
         * Variables:
         * - input: User's request
         */
        [INTENT_TYPES.EVERYTHING_ELSE]: ChatPromptTemplate.fromMessages([
            SystemMessagePromptTemplate.fromTemplate(
                basePrompt + "\n\nProvide general script writing assistance while keeping responses focused and relevant." + formatGuidelines
            ),
            HumanMessagePromptTemplate.fromTemplate("{input}")
        ]),

        /**
         * DEFAULT FALLBACK HANDLER
         * Purpose: Handles unclassified or unknown intents
         * Input: Any unclassified request
         * Output: General script-focused guidance
         * Variables:
         * - input: User's request
         */
        default: ChatPromptTemplate.fromMessages([
            SystemMessagePromptTemplate.fromTemplate(
                basePrompt + "\n\nProvide helpful guidance while keeping the focus on script writing." + formatGuidelines
            ),
            HumanMessagePromptTemplate.fromTemplate("{input}")
        ])
    };
};