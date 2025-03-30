import { ChatPromptTemplate } from "@langchain/core/prompts";

export const intentPrompt = ChatPromptTemplate.fromMessages([
    ["system", `You are an intent classifier for a script writing assistant. Classify the user prompt into one of the valid intents:

{intents}`],
    ["user", "Classify the prompt into predefined intents:\n\n{input}\n\n-------------\n\n Only return the exact intent name, no other text."]
]);