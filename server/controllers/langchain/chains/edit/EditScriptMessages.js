import { ChatPromptTemplate, SystemMessagePromptTemplate, HumanMessagePromptTemplate } from 'langchain/prompts';
import { VALID_FORMAT_VALUES } from '../../constants.js';

/**
 * Builds and manages the message templates and prompts for script editing
 */
export class EditScriptMessages {
  static VALID_TAGS = VALID_FORMAT_VALUES;

  static getSystemTemplate(totalLines) {
    return `You are a script editing assistant. Your task is to convert user edit requests into specific edit commands.

SCRIPT FORMAT:
The script uses XML-style script tags for lines:
<header>Scene headings like "INT. COFFEE SHOP - MORNING"</header>
<action>Action descriptions</action>
<speaker>Character names who are speaking</speaker>
<dialog>The actual dialog text</dialog>

LINE RULES:
1. IMPORTANT: Every tag counts as a line number, even if empty
2. Lines are numbered from 1 to ${totalLines}
3. When editing, count ALL lines including empty tags
4. Example line counting:
   Line 1: <header>INT NIGHT: Scene 1</header>
   Line 2: <action>They walked into the room.</action>
   Line 2: <speaker>JOHN</speaker>
   Line 3: <dialog>Hi</dialog>       
   Line 4: <speaker>SARA</speaker>
   Line 5: <dialog>Hello</dialog> 

COMMAND FORMAT:
Return commands in this format:
{{
  "commands": [
    {{
      "command": "ADD",
      "lineNumber": (number),
      "value": "<action>The door opens.</action>"
    }}, {{
      "command": "ADD",
      "lineNumber": (number),
      "value": "<speaker>MITCH</speaker>"
    }}, {{
      "command": "ADD",
      "lineNumber": (number),
      "value": "<dialog>Hello</dialog>"
    }}
  ]
}}

Always return valid JSON of ALL commands!
`;
  }

  static getFunctionSchema() {
    return {
      name: 'edit_script',
      parameters: {
        type: 'object',
        properties: {
          commands: {
            type: 'array',
            items: {
              type: 'object',
              description: 'An array of commands to edit the script.',
              properties: {
                command: {
                  type: 'string',
                  enum: ['ADD', 'EDIT', 'DELETE']
                },
                lineNumber: {
                  type: 'number',
                  description: 'The line number to edit or insert after.'
                },
                value: {
                  type: 'string',
                  description: `The content wrapped in the appropriate tag. Valid tags are: ${this.VALID_TAGS.join(', ')}`
                }
              },
              required: ['command', 'lineNumber']
            }
          }
        },
        required: ['commands']
      }
    };
  }

  static countScriptLines(scriptContent, ignoreEmpty = false) {
    if (!scriptContent) return 0;
    const tagPattern = new RegExp(`<(${this.VALID_TAGS.join('|')})>([^<]*?)</\\1>`, 'g');
    const lines = scriptContent.match(tagPattern) || [];
    if (ignoreEmpty) {
      return lines.filter(line => {
        const contentMatch = line.match(/<[^>]+>([^<]+)</);
        return contentMatch && contentMatch[1].trim().length > 0;
      }).length;
    }
    return lines.length;
  }

  static buildMessages(scriptContent, prompt) {
    if (!scriptContent || typeof scriptContent !== 'string') {
      throw new Error('Script content must be a string');
    }
    if (!prompt) {
      throw new Error('Prompt is required');
    }

    const totalLines = this.countScriptLines(scriptContent);
    const systemTemplate = `${this.getSystemTemplate(totalLines).replaceAll('`', '')
    }\n\nCurrent script:\n{scriptContent}`;

    console.log('Building EditScript messages:', {
      totalLines,
      hasScriptContent: !!scriptContent,
      promptLength: prompt.length,
      templateVariables: ['scriptContent', 'input']
    });

    const promptTemplate = ChatPromptTemplate.fromMessages([
      SystemMessagePromptTemplate.fromTemplate(systemTemplate),
      HumanMessagePromptTemplate.fromTemplate('{input}')
    ]);

    return promptTemplate.formatMessages({
      scriptContent: scriptContent,
      input: prompt
    });
  }
}
