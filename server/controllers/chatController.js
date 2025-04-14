import { classifyIntent } from "./langchain/chains/system/classifyIntent.js";
import { router } from "./langchain/router/index.js";
import { aiSystemEventHandler } from "./langchain/handlers/AISystemEventHandler.js";
import { FUNCTION_DEFINITIONS, INTENT_TYPES, ERROR_TYPES } from "./langchain/constants.js";
import { Chat } from "./chat/Chat.js";
import db from "../db/index.js";

// Move handleChatError to be a standalone function
function handleChatError(error) {
    const errorResponse = {
        status: 500,
        body: {
            error: "Internal server error",
            details: error.message
        }
    };

    if (error.message.includes(ERROR_TYPES.INVALID_FORMAT)) {
        errorResponse.status = 400;
        errorResponse.body.error = "Invalid request format";
    } else if (error.message.includes("Script not found")) {
        errorResponse.status = 404;
        errorResponse.body.error = "Script not found";
    } else if (error.message.includes(Chat.CHAT_ERRORS.INVALID_INTENT)) {
        errorResponse.status = 400;
        errorResponse.body.error = "Invalid intent";
    } else if (error.message === 'insufficient_content') {
        errorResponse.status = 400;
        errorResponse.body.error = "Insufficient content for analysis";
    } else if (error.message.includes('Chain execution failed')) {
        // Keep 500 status but provide more specific error
        errorResponse.body.error = "Chain execution failed";
    }

    return errorResponse;
}

const chatController = {
    getChatHistory: async(req, res) => {
        try {
            const userId = req.user.id;
            const history = await db.getChatHistory(userId);
            console.log('history', history);
            res.status(200).json(history);
        } catch (error) {
            console.error("Error getting chat history:", error);
            res.status(500).json({
                error: "Internal server error",
                details: error.message
            });
        }
    },

    startChat: async(req, res) => {
        try {
            // 1. Validate inputs
            if (!req.body.prompt) {
                return res.status(400).json({ error: "Missing prompt" });
            }

            const scriptId = parseInt(req.body.scriptId, 10);
            if (!scriptId || isNaN(scriptId)) {
                return res.status(400).json({ error: "Invalid script ID" });
            }

            // 2. Create and execute chat
            const chat = new Chat(req.user.id, scriptId);
            const result = await chat.processMessage(req.body.prompt);

            // 3. Return standardized response
            res.status(200).json(result);

        } catch (error) {
            // Handle different error types using the standalone function
            const errorResponse = handleChatError(error);
            res.status(errorResponse.status).json(errorResponse.body);
        }
    },

    getWelcomeButtons: async(req, res) => {
        try {
            const welcomeButtons = [{
                    text: "Create New Script",
                    action: "create_script",
                    description: "Start a new script from scratch"
                },
                {
                    text: "Import Script",
                    action: "import_script",
                    description: "Import an existing script"
                },
                {
                    text: "View Tutorial",
                    action: "view_tutorial",
                    description: "Learn how to use the AI assistant"
                },
                {
                    text: "Recent Scripts",
                    action: "recent_scripts",
                    description: "View your recent scripts"
                }
            ];

            res.status(200).json({
                buttons: welcomeButtons
            });
        } catch (error) {
            console.error("Error getting welcome buttons:", error);
            res.status(500).json({
                error: "Internal server error",
                details: error.message
            });
        }
    }
};

export default chatController;