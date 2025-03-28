// Define valid intents
export const VALID_INTENTS = {
    SCRIPT_THINKING: "SCRIPT_THINKING",
    SAVE_STORY_ELEMENT: "SAVE_STORY_ELEMENT",
    BRAINSTORMING: "BRAINSTORMING",
    EVERYTHING_ELSE: "EVERYTHING_ELSE"
};

// Intent descriptions for prompts
export const INTENT_DESCRIPTIONS = {
    SCRIPT_THINKING: "Help discussing existing script, analyzing content, or providing writing advice",
    SAVE_STORY_ELEMENT: "Saving a story element or new script to the database",
    BRAINSTORMING: "Brainstorming, list making, or generating creative ideas",
    EVERYTHING_ELSE: "Not script related or general conversation"
};

// Function definitions
export const FUNCTION_DEFINITIONS = {
    SAVE_SCRIPT: "save_script",
    SAVE_STORY_ELEMENT: "save_story_element",
    CHANGE_SCRIPT_TITLE: "change_script_title",
    SHARE_SCRIPT: "share_script"
};