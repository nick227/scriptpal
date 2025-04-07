import { classifyIntent } from "./langchain/chains/system/classifyIntent.js";
import { router } from "./langchain/router/index.js";

const chatController = {
    startChat: async(req, res) => {
        try {
            const prompt = req.body.prompt;
            const scriptId = req.body.scriptId;

            console.log('\n=== Chat Request Started ===');
            console.log('Received prompt:', prompt);
            console.log('ScriptId:', scriptId);

            if (!prompt) {
                return res.status(400).json({ error: "Missing prompt" });
            }

            // Classify the intent
            console.log('\n=== Classifying Intent ===');
            const intentResult = await classifyIntent(prompt);
            console.log('Intent Classification Result:', JSON.stringify(intentResult, null, 2));

            // Route to appropriate chain with scriptId
            const response = await router.route(intentResult, scriptId, prompt);

            console.log('\n=== Routing Intent ===');
            console.log('\n=== intentResult ===============', intentResult);

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
            res.status(500).json({
                error: "Internal server error",
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