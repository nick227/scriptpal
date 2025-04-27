import { ChatPromptTemplate, SystemMessagePromptTemplate, HumanMessagePromptTemplate } from 'langchain/prompts';

/**
 * Builds and manages the message templates and prompts for script writing
 */
export class WriteScriptMessages {
    /**
     * Get the function schema for script writing
     */
    static getFunctionSchema() {
        return {
            name: "write_script",
            description: "Array of commands to apply to the script",
            parameters: {
                type: "object",
                properties: {
                    commands: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                command: {
                                    type: "string",
                                    enum: ["ADD"],
                                    description: "The type of write operation"
                                },
                                lineNumber: {
                                    type: "number",
                                    description: "The line number to write (1-based)"
                                },
                                value: {
                                    type: "string",
                                    description: "The new content for ADD operations (must include script tags)"
                                }
                            },
                            required: ["command", "lineNumber", "value"]
                        }
                    }
                },
                required: ["commands"]
            }
        };
    }

    /**
     * Build system template for script writing
     */
    static getSystemTemplate(totalLines) {
        return `
        
        You are a script writing assistant. Your task is to write content for a script based on the user's request.
        
        Return new lines as ADD commands.

SCRIPT FORMAT:
The script uses XML-style script tags for different elements:
<header>Scene headings like "INT. COFFEE SHOP - MORNING"</header>
<action>Action descriptions</action>
<speaker>Character names who are speaking</speaker>
<dialog>The actual dialog text</dialog>
<speaker>Character names who are speaking</speaker>
<dialog>The actual dialog text</dialog>
<directions>Parenthetical directions for actors</directions>
<chapter-break>Chapter or act breaks</chapter-break>

COMMAND GUIDELINES:
1. Each command must target a specific line number (1-${totalLines})
2. Commands must include the full script tags in the value
3. For ADD commands, content is inserted AFTER the specified line
4. Line numbers refer to the ORIGINAL script state

VALIDATION RULES:
1. Line numbers must be valid (1-${totalLines})
2. ADD commands must include value with proper script tags
3. Tag type must match content type (e.g. dialog tag for dialog content)
4. Content cannot be empty between tags

SCRIPT CONTENT:
Adapt the script content to the user's request.
Match the style and tone of the existing script.
Avoid generic or obvious content.

EXAMPLE COMMANDS:
[
  {
    "command": "ADD",
    "lineNumber": 5,
    "value": "<dialog>I can't believe what just happened!</dialog>"
  },
  {
    "command": "ADD",
    "lineNumber": 5,
    "value": "<action>She paces nervously around the room.</action>"
  },
  {
    "command": "ADD",
    "lineNumber": 5,
    "value": "<speaker>Hello everyone.</speaker>"
  }
]`;
    }

    /**
     * Build messages for the chain
     */
    static buildMessages(scriptContent, prompt) {
        const systemTemplate = `You are a script writing assistant. You help users write scripts by applying specific commands.
The script content is formatted with XML-style script tags like <header>, <action>, <speaker>, <dialog>, <directions>, and <chapter-break>.

When writing, you can use these commands:
- ADD: Add a new line at a specific position

Each line in the script is numbered starting from 1.

Current script content:
{script_content}

Format your response as a function call to 'write_script' with an array of commands.
Each command should have:
- command: The write operation (ADD, EDIT, or DELETE)
- lineNumber: The line number to write (1-based)
- value: The new content for ADD (must include script tags)`;

        const promptTemplate = ChatPromptTemplate.fromMessages([
            SystemMessagePromptTemplate.fromTemplate(systemTemplate),
            HumanMessagePromptTemplate.fromTemplate("{input}")
        ]);

        return promptTemplate.formatMessages({
            script_content: scriptContent,
            input: prompt
        });
    }

    /**
     * Count the number of content lines in the script
     * @private
     */
    static countScriptLines(scriptContent) {
        if (!scriptContent) return 0;
        // Match any content between XML-style tags
        const lineMatches = scriptContent.match(/<(header|action|speaker|dialog|directions|chapter-break)>([^<]+)<\/\1>/g) || [];
        return lineMatches.length;
    }
}