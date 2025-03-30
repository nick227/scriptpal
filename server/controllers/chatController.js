import {
    classifyIntent,
    generateResponse,
    generateButtons,
    isFunctionRequest
} from "./langchain/index.js";
import scriptModel from '../models/script.js';

const chatController = {
    startChat: async(req, res) => {
        try {
            const prompt = req.body.prompt;
            const scriptId = req.body.scriptId;
            let script = null;
            if (scriptId) {
                script = await scriptModel.getScript(scriptId);
            }

            if (!prompt) {
                return res.status(400).json({ error: "Missing prompt" });
            }

            //const listOfFunctionsToRun = await isFunctionRequest(prompt);

            //console.log('!!! listOfFunctionsToRun: ', listOfFunctionsToRun);

            // Step 1: Classify
            const intent = null;
            //intent = await classifyIntent(prompt);

            // Step 2: Generate main response
            const html = await generateResponse(prompt, intent, script);

            // Step 3: Generate buttons (always)
            let buttons = [];
            //buttons = await generateButtons(prompt, html);

            console.log('!!! intent: ', intent);

            console.log('!!! html: ', html);

            console.log('!!! buttons: ', buttons);

            res.status(200).json({
                prompt,
                intent,
                html,
                buttons,
            });
        } catch (error) {
            console.error("Error in chat:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    },
    getWelcomeButtons: async(req, res) => {
        const prompt = "Write array of 6 short unique prompts to start an ai writing session.";
        const html = "Return comma separated list of prompts.";
        const buttons = await generateButtons(prompt, html);
        res.status(200).json({ buttons });
    }
};

export default chatController;