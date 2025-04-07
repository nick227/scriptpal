import { intentModel } from '../models/chatModels.js';
import { intentPrompt } from '../prompts/prompts.js';
import { VALID_INTENTS, INTENT_DESCRIPTIONS } from '../constants.js';

export async function classifyIntent(input) {
    console.log('\n=========================================');
    console.log('\n=========================================');
    console.log('\n=========================================');
    console.log('\n=== classifyIntent 00000111 ===============');
    console.log(input);
    const chain = intentPrompt.pipe(intentModel);
    const result = await chain.invoke({
        input,
        intents: Object.entries(INTENT_DESCRIPTIONS)
            .map(([intent, desc]) => `${intent}: ${desc}`)
            .join("\n")
    });

    try {
        if (result.additional_kwargs && result.additional_kwargs.function_call) {
            const { intent } = JSON.parse(result.additional_kwargs.function_call.arguments);
            const normalized = intent.toUpperCase();
            if (Object.keys(VALID_INTENTS).includes(normalized)) {
                return normalized;
            }
        }
    } catch (err) {
        console.warn("❌ Failed to extract intent:", err);
    }
    return "EVERYTHING_ELSE";
}