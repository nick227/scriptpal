import { ChatPromptTemplate, SystemMessagePromptTemplate, HumanMessagePromptTemplate } from '@langchain/core/prompts';

// Function prompt
export const isFunctionPrompt = ChatPromptTemplate.fromMessages([
  SystemMessagePromptTemplate.fromTemplate(
    'You are a function detector. Analyze the input text and determine if it is a function request. A function request is a request to perform a specific action like \'save\', \'load\', \'delete\', etc. Return true if it is a function request, false if it is not.\n\nExample function requests:\n- Save my script\n- Load my last script\n- Delete this script\n- Start a new script\n- Clear the editor\n\nExample non-function requests:\n- Help me write a story about dragons\n- What should happen next in my story?\n- Give me ideas for character names\n- How can I improve this scene?'
  ),
  HumanMessagePromptTemplate.fromTemplate(
    '{input}\n\nReturn true or false only.'
  )
]);
