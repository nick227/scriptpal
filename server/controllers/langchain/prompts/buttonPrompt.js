import { ChatPromptTemplate, SystemMessagePromptTemplate, HumanMessagePromptTemplate } from "@langchain/core/prompts";

// Button prompt
export const buttonPrompt = ChatPromptTemplate.fromMessages([
    SystemMessagePromptTemplate.fromTemplate(
        "You are the chat button generator for an ai writing assistant. Generate 3 short prompts for the user based on the conversation. The prompts are usually questions but might be statements. They should flow with the conversation."
    ),
    HumanMessagePromptTemplate.fromTemplate(
        "Based on this conversation:\nUser prompt: {prompt}\nSystem response: {html}\n\nReturn the short prompts separated by commas."
    )
]);