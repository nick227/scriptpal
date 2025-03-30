import { PromptTemplate } from "@langchain/core/prompts";

// Button prompt
export const buttonPrompt = PromptTemplate.fromTemplate(
    "You are the chat button generator for an ai writing assistant. Generate 3 short prompts for the user based on the conversation. Return the short prompts separated by commas. The prompts are usually questions but might be statements. They should flow with the conversation. Consider the user prompt and the system response when generating the buttons. \n\nUser prompt: {prompt}\n\nSystem response: {html}\n\nReturn the comma separated prompt text only."
);