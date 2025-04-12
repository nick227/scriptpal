import { classifyIntent } from "./langchain/chains/system/classifyIntent.js";
import { router } from "./langchain/router/index.js";
import { aiSystemEventHandler } from "./langchain/handlers/AISystemEventHandler.js";
import { FUNCTION_DEFINITIONS, INTENT_TYPES, ERROR_TYPES } from "./langchain/constants.js";
import db from "../db/index.js";

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
            const prompt = req.body.prompt;
            const scriptId = parseInt(req.body.scriptId, 10); // Ensure scriptId is a number
            const userId = req.user.id;

            if (!prompt) {
                return res.status(400).json({ error: "Missing prompt" });
            }

            if (!scriptId || isNaN(scriptId)) {
                return res.status(400).json({ error: "Invalid script ID" });
            }

            // Fetch script content
            console.log('\n=== Fetching Script Content ===');
            const script = await db.getScript(scriptId);
            if (!script) {
                return res.status(404).json({ error: "Script not found" });
            }
            console.log('Found script:', script.title);

            // Classify the intent
            console.log('\n=== Classifying Intent ===');
            const intentResult = await classifyIntent(prompt);
            console.log('Intent Classification Result:', JSON.stringify(intentResult, null, 2));

            let response;

            // Handle system operations
            if (intentResult.intent === INTENT_TYPES.SAVE_ELEMENT) {
                console.log('\n=== Handling Save Element Operation ===');

                // Validate intent result structure
                if (!intentResult.target || !intentResult.value) {
                    throw new Error(ERROR_TYPES.INVALID_FORMAT + ": Missing target or value in intent result");
                }

                try {
                    // Process the save operation
                    const saveCommand = {
                        target: intentResult.target.toLowerCase(), // Ensure lowercase for consistency
                        value: intentResult.value,
                        script_id: scriptId // Already validated and converted to number
                    };

                    console.log('Executing save command:', JSON.stringify(saveCommand, null, 2));
                    const result = await aiSystemEventHandler.processCommand('save', saveCommand);

                    if (result.success) {
                        response = {
                            message: `Successfully saved ${saveCommand.target} element`,
                            details: {
                                type: saveCommand.target,
                                id: result.id,
                                operation: result.operationId
                            }
                        };
                    } else {
                        response = {
                            error: "Failed to save element",
                            details: result.error,
                            command: saveCommand
                        };
                    }
                } catch (error) {
                    console.error('Save Element Operation Failed:', error);
                    throw new Error(`Save operation failed: ${error.message}`);
                }
            } else {
                // Route to appropriate chain with scriptId and content for non-system operations
                const context = {
                    scriptId,
                    scriptContent: script.content,
                    scriptTitle: script.title,
                    scriptMetadata: {
                        lastUpdated: script.updated_at,
                        version: script.version,
                        status: script.status
                    }
                };
                response = await router.route(intentResult, context, prompt);
            }

            console.log('\n=== Operation Complete ===');
            console.log('Response:', JSON.stringify(response, null, 2));

            // Save chat history
            await db.createChatHistory(userId, prompt, 'user');
            await db.createChatHistory(userId, typeof response === 'string' ? response : JSON.stringify(response), 'assistant');

            res.status(200).json({
                intent: intentResult.intent,
                confidence: intentResult.confidence,
                target: intentResult.target,
                response: response
            });

        } catch (error) {
            console.error("\n=== Error in Chat ===");
            console.error("Error details:", error);
            console.error("Stack trace:", error.stack);

            // Determine appropriate status code
            let statusCode = 500;
            let errorMessage = "Internal server error";

            if (error.message.includes(ERROR_TYPES.INVALID_FORMAT)) {
                statusCode = 400;
                errorMessage = "Invalid request format";
            } else if (error.message.includes("Script not found")) {
                statusCode = 404;
                errorMessage = "Script not found";
            }

            res.status(statusCode).json({
                error: errorMessage,
                details: error.message
            });
        }
    },

    getWelcomeButtons: async(req, res) => {
        try {
            // Define welcome buttons with their actions
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