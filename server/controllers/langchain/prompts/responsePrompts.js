import { PromptTemplate } from "@langchain/core/prompts";

// Response prompts
export const createResponsePrompts = () => {
    const SCRIPT_THINKING = PromptTemplate.fromTemplate(
        "You are a helpful writing assistant. Help the user write their script by providing suggestions, ideas, and feedback. Focus on the creative aspects of writing.\n\nScript content:\n{input}\n\nProvide creative writing assistance."
    );

    const GETTING_MOTIVATED = PromptTemplate.fromTemplate(
        "You are a motivational writing coach. Help the user overcome writer's block and stay motivated. Provide encouragement and practical tips.\n\nUser's concern: {input}\n\nProvide motivational guidance."
    );

    const BRAINSTORMING = PromptTemplate.fromTemplate(
        "You are a creative brainstorming partner. Help the user generate ideas and explore different possibilities for their writing.\n\nBrainstorming topic: {input}\n\nProvide creative brainstorming assistance."
    );

    const EVERYTHING_ELSE = PromptTemplate.fromTemplate(
        "You are a helpful writing assistant. Help the user with their writing needs, whether it's developing characters, plotting, dialogue, or any other aspect of writing.\n\nUser's request: {input}\n\nProvide writing assistance."
    );

    return {
        SCRIPT_THINKING,
        GETTING_MOTIVATED,
        BRAINSTORMING,
        EVERYTHING_ELSE
    };
};