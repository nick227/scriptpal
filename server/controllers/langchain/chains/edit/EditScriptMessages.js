import { ChatPromptTemplate, SystemMessagePromptTemplate, HumanMessagePromptTemplate } from 'langchain/prompts';

/**
 * Builds and manages the message templates and prompts for script editing
 */
export class EditScriptMessages {
    /**
     * Get the function schema for script editing
     */
    static getFunctionSchema() {
        return {
            name: "edit_script",
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
                                    enum: ["ADD", "EDIT", "DELETE"],
                                    description: "The type of edit operation"
                                },
                                lineNumber: {
                                    type: "number",
                                    description: "The line number to edit (1-based)"
                                },
                                value: {
                                    type: "string",
                                    description: "The new content for ADD/EDIT operations (must include script tags)"
                                }
                            },
                            required: ["command", "lineNumber"]
                        }
                    }
                },
                required: ["commands"]
            }
        };
    }

    /**
     * Build system template for script editing
     */
    static getSystemTemplate(totalLines) {
        return `You are a script editing assistant. Your task is to convert user edit requests into specific edit commands.

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

Notice the recurring pattern of <speaker> and <dialog> tags. We must always respect the recurring pattern of <speaker> and <dialog> tags. If there is a <speaker> tag, there must be a <dialog> tag. If there is a <dialog> tag, there must be a <speaker> tag.

COMMAND GUIDELINES:
1. Each command must target a specific line number (1-${totalLines})
2. Commands must include the full script tags in the value
3. For ADD commands, content is inserted AFTER the specified line
4. For EDIT commands, content replaces the specified line
5. For DELETE commands, the specified line is removed
6. Line numbers refer to the ORIGINAL script state

VALIDATION RULES:
1. Line numbers must be valid (1-${totalLines})
2. ADD/EDIT commands must include value with proper script tags
3. Tag type must match content type (e.g. dialog tag for dialog content)
4. Content cannot be empty between tags
5. Commands must maintain script coherence and flow

EXAMPLE COMMANDS:
[
  {
    "command": "EDIT",
    "lineNumber": 5,
    "value": "<dialog>I can't believe what just happened!</dialog>"
  },
  {
    "command": "ADD",
    "lineNumber": 10,
    "value": "<action>She paces nervously around the room.</action>"
  },
  {
    "command": "DELETE",
    "lineNumber": 7
  }
]`;
    }

    /**
     * Build messages for the chain
     */
    static buildMessages(scriptContent, prompt) {
        const systemTemplate = `You are a script editing assistant. You help users edit and write scripts by applying specific commands.
The script content is formatted with XML-style script tags like <header>, <action>, <speaker>, <dialog>, <directions>, and <chapter-break>.

You must follow the recurring pattern of <speaker> and <dialog> tags.

Avoid generic or obvious content.

When editing, you can use these commands:
- ADD: Add a new line at a specific position
- EDIT: Modify an existing line
- DELETE: Remove a line

Each line in the script is numbered starting from 1.

Current script content:
{script_content}

Format your response as a function call to 'edit_script' with an array of commands.
Each command should have:
- command: The edit operation (ADD, EDIT, or DELETE)
- lineNumber: The line number to edit (1-based)
- value: The new content for ADD/EDIT (must include script tags)`;

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