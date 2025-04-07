import { PromptTemplate } from "@langchain/core/prompts";

class PromptManager {
    constructor() {
        this.templates = new Map();
    }

    registerTemplate(name, template, defaultVariables = {}) {
        this.templates.set(name, {
            template: PromptTemplate.fromTemplate(template),
            defaultVariables
        });
    }

    async formatPrompt(name, variables = {}) {
        const template = this.templates.get(name);
        if (!template) {
            throw new Error(`Template ${name} not found`);
        }

        return template.template.format({
            ...template.defaultVariables,
            ...variables
        });
    }
}

// Export singleton instance
export const promptManager = new PromptManager();

// Register default templates
promptManager.registerTemplate(
    'scriptAnalysis',
    `You are an experienced script analyst and story editor. Analyze the following script content:

SCRIPT METADATA:
Title: {title}
Current Status: {status}
Version: {version}

CONTENT:
{content}

FOCUS AREAS:
{focusAreas}

Return a JSON response following this format:
{outputFormat}
    `, {
        focusAreas: 'Structure, Characters, Plot, Themes',
        outputFormat: '{ "analysis": { ... }, "recommendations": { ... } }'
    }
);

// Register script questions template
promptManager.registerTemplate(
    'scriptQuestions',
    `You are a script analysis assistant specializing in answering specific questions about scripts. Your role is to provide precise, evidence-based answers using only the content provided in the script.

SCRIPT CONTENT:
{script}

QUESTION:
{question}

ANALYSIS GUIDELINES:
1. Character Questions
   - Focus on explicit character actions, dialogue, and development
   - Note any character relationships or conflicts shown
   - Identify character motivations when clearly demonstrated

2. Plot Questions
   - Reference specific events and their sequence
   - Identify clear cause-and-effect relationships
   - Note major plot points and turning points

3. Theme Questions
   - Point to recurring ideas or motifs
   - Identify explicit thematic elements
   - Connect themes to specific scenes or dialogue

4. Structure Questions
   - Analyze scene organization and flow
   - Note pacing and timing elements
   - Identify act breaks or major transitions

RESPONSE FORMAT:
- Start with a direct answer to the question
- Support with specific examples from the script
- Note any limitations in available information
- Keep responses focused and concise
- Use quotes from the script when relevant

IMPORTANT:
- Only use information explicitly present in the script
- If information is ambiguous, acknowledge the uncertainty
- If asked about missing elements, clearly state they're not in the script
- Don't make assumptions or add interpretations without textual support

Example Questions and Response Formats:

1. Character-focused:
Q: "What motivates [character]?"
A: "[Character]'s motivation is shown through [specific actions/dialogue]. For example, in [scene], they [example]."

2. Plot-focused:
Q: "What causes [event]?"
A: "[Event] occurs because of [specific prior events]. This is demonstrated when [example]."

3. Theme-focused:
Q: "How does the script handle [theme]?"
A: "[Theme] appears in [specific instances]. For example: [quote/scene description]."

4. Structure-focused:
Q: "How does the opening establish [element]?"
A: "The opening [describes specific elements]. Specifically, [example]."

Please provide your analysis based on these guidelines.`, {
        script: '',
        question: ''
    }
);

// Add more default templates as needed

// Function definitions
export const FUNCTION_DEFINITIONS = {
    SAVE_SCRIPT: "save_script",
    SAVE_ELEMENT: "save_story_element",
    CHANGE_SCRIPT_TITLE: "change_script_title",
    SHARE_SCRIPT: "share_script"
};

// Intent Types - Consolidated
export const INTENT_TYPES = {
    // Core Script Analysis
    LIST_SCENES: 'scene_list',
    LIST_BEATS: 'beat_list',
    ANALYZE_SCRIPT: 'comprehensive_analysis',
    SCRIPT_QUESTIONS: 'script_questions',

    // Creative Support
    GET_INSPIRATION: 'inspiration',

    // Meta Intents
    MULTI_INTENT: 'multi_intent',
    EVERYTHING_ELSE: 'everything_else'
};

// Intent Descriptions - Consolidated
export const INTENT_DESCRIPTIONS = {
    scene_list: 'List and analyze scenes in the script',
    LIST_SCENES: 'Break down and organize script into formatted scenes',
    beat_list: 'List and analyze story beats',
    inspiration: 'Generate creative ideas and suggestions',
    comprehensive_analysis: 'Perform complete script analysis including structure, characters, plot, and themes',
    MULTI_INTENT: 'Multiple operations requested',
    EVERYTHING_ELSE: 'Not script related or general conversation',
    script_questions: 'Answer specific questions about the script'
};

export async function classifyIntent(input) {

    if (!input || typeof input !== 'string') {
        console.error('Invalid input type provided to classifyIntent');
        return {
            intent: INTENT_TYPES.EVERYTHING_ELSE,
            confidence: 0.5,
            target: {
                type: null,
                id: null,
                context: ''
            }
        };
    }

    try {
        const result = await chain.invoke({
            text: input,
            intents: intentDescriptions.trim()
        });
        return result;
    } catch (error) {
        console.error('Intent classification error:', error);
        return {
            intent: INTENT_TYPES.EVERYTHING_ELSE,
            confidence: 0.5,
            target: {
                type: null,
                id: null,
                context: ''
            }
        };
    }
}