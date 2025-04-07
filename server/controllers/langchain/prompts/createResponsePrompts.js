import { ChatPromptTemplate, SystemMessagePromptTemplate, HumanMessagePromptTemplate } from "@langchain/core/prompts";

// Response prompts map
export const createResponsePrompts = (scriptContent = "", scriptTitle = "") => {
    const basePrompt = "You are an AI writing assistant focused on helping users write quality scripts. You provide thoughtful, creative responses that help drive the story forward while maintaining the user's style.";

    return {
        SCRIPT_THINKING: ChatPromptTemplate.fromMessages([
            SystemMessagePromptTemplate.fromTemplate(
                basePrompt + "\n\nScript content:\n{scriptContent}"
            ),
            HumanMessagePromptTemplate.fromTemplate("{input}")
        ]),
        GETTING_MOTIVATED: ChatPromptTemplate.fromMessages([
            SystemMessagePromptTemplate.fromTemplate(
                basePrompt + "\n\nYou are especially ENTHUSIASTIC and motivating. Help the user overcome writer's block and get started with their script titled: {scriptTitle}."
            ),
            HumanMessagePromptTemplate.fromTemplate("{input}")
        ]),
        BRAINSTORMING: ChatPromptTemplate.fromMessages([
            SystemMessagePromptTemplate.fromTemplate(
                basePrompt + "\n\nCreate quality lists of creative ideas and suggestions for the script titled: {scriptTitle}. Avoid generic or obvious ideas."
            ),
            HumanMessagePromptTemplate.fromTemplate("{input}")
        ]),
        EVERYTHING_ELSE: ChatPromptTemplate.fromMessages([
            SystemMessagePromptTemplate.fromTemplate(
                basePrompt + "\n\nYou are working on a script titled: {scriptTitle}. Keep the focus on script writing and story elements."
            ),
            HumanMessagePromptTemplate.fromTemplate("{input}")
        ]),
        default: ChatPromptTemplate.fromMessages([
            SystemMessagePromptTemplate.fromTemplate(
                "You are a helpful writing assistant."
            ),
            HumanMessagePromptTemplate.fromTemplate("{input}")
        ])
    };
};

// Intent Types - Consolidated
export const INTENT_TYPES = {
    // Core Script Analysis
    LIST_SCENES: 'scene_list',
    LIST_BEATS: 'beat_list',

    // Creative Support
    GET_INSPIRATION: 'inspiration',

    // Comprehensive Analysis
    ANALYZE_SCRIPT: 'comprehensive_analysis',

    // Meta Intents
    MULTI_INTENT: 'multi_intent',
    EVERYTHING_ELSE: 'everything_else'
};

// Intent Descriptions - Consolidated
export const INTENT_DESCRIPTIONS = {
    scene_list: 'List and analyze scenes in the script',
    beat_list: 'List and analyze story beats',
    inspiration: 'Generate creative ideas and suggestions',
    comprehensive_analysis: 'Perform complete script analysis including structure, characters, plot, and themes',
    LIST_SCENES: 'Break down and organize script into formatted scenes',
    LIST_BEATS: 'Analyze and list major story beats',
    GET_INSPIRATION: 'Generate creative ideas and break writer\'s block',
    MULTI_INTENT: 'Multiple operations requested',
    EVERYTHING_ELSE: 'Not script related or general conversation'
};