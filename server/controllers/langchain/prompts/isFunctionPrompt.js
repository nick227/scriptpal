import { ChatPromptTemplate } from "@langchain/core/prompts";

export const isFunctionPrompt = ChatPromptTemplate.fromMessages([
    ["system", `
        Analyze the user prompt and determine if it is requesting one or more executions such as saving a new script or saving a story element. Or changing previously saved values. 

        You can execute the following 4 functions:
        - save_script
        - save_story_element
        - change_script_title
        - share_script
        
        Return the function name and the arguments in a JSON object.

        Example:
        {{
            "function": "save_script",
            "arguments": {{
                "title": "My new script",
                "content": "This is the content of my new script"
            }}
        }}
        `.trim()],
    ["user", "{input}\n\nReturn the function name and the arguments in a JSON object."]
]);