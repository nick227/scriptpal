import { BaseChain } from '../base/BaseChain.js';
import { SCRIPT_CONTEXT_PREFIX } from '../../constants.js';
import { formatScriptCollections } from '../helpers/ScriptCollectionsFormatter.js';
import { formatItemBlock, formatItemList } from '../helpers/ItemListFormatter.js';

const IDEA_FUNCTIONS = [{
  name: 'provide_item_idea',
  description: 'Generate a title and description.',
  parameters: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'Short, specific title.'
      },
      description: {
        type: 'string',
        description: '2-4 sentence description.'
      }
    },
    required: ['title', 'description']
  }
}];

export const createTaggedItemIdeaChain = ({ intent, itemLabel }) => {
  const defaultInstruction = `You are a ${itemLabel.toLowerCase()} ideation assistant.
- Return only JSON with "title" and "description".
- Keep the title short and specific.
- The description should be 2-4 sentences and align with the script.
- Do not include extra keys or commentary.`;

  return class TaggedItemIdeaChain extends BaseChain {
    constructor() {
      super({
        type: intent,
        temperature: 0.4,
        modelConfig: {
          response_format: { type: 'json_object' },
          functions: IDEA_FUNCTIONS,
          function_call: { name: 'provide_item_idea' }
        }
      });
      this.itemLabel = itemLabel;
    }

    async run(context, prompt) {
      try {
        const messages = await this.buildMessages(context, prompt);
        const rawResponse = await this.execute(messages, context, false);
        return this.formatResponse(rawResponse);
      } catch (error) {
        console.error(`${this.itemLabel}IdeaChain execution error:`, error);
        throw error;
      }
    }

    addCommonInstructions(messages) {
      return messages;
    }

    buildMessages(context, prompt) {
      const systemInstruction = context?.systemInstruction || defaultInstruction;
      const scriptTitle = context?.scriptTitle || 'Untitled Script';
      const scriptDescription = context?.scriptDescription || '';
      const currentItem = formatItemBlock(context?.currentItem, this.itemLabel);
      const otherItems = formatItemList(context?.otherItems, this.itemLabel);
      const collectionBlock = formatScriptCollections(context?.scriptCollections);
      const scriptContext = context?.scriptContent
        ? `${SCRIPT_CONTEXT_PREFIX}\n${context.scriptContent}`
        : 'No script content available.';

      const userContent = `
${prompt}

Script Title: ${scriptTitle}
Script Description: ${scriptDescription}

Current ${this.itemLabel}:
${currentItem}

Other ${this.itemLabel}s:
${otherItems}

${collectionBlock}

${scriptContext}
`;

      return [{
        role: 'system',
        content: systemInstruction
      }, {
        role: 'user',
        content: userContent
      }];
    }

    formatResponse(response) {
      const schema = { required: ['title', 'description'] };
      const validated = this.parseFunctionPayload(response, schema, `Invalid ${this.itemLabel.toLowerCase()} idea payload`);
      const title = typeof validated.title === 'string' ? validated.title.trim() : '';
      const description = typeof validated.description === 'string' ? validated.description.trim() : '';

      return {
        response: {
          title,
          description
        },
        type: intent,
        metadata: {
          ...this.extractMetadata(response, ['scriptId', 'scriptTitle']),
          timestamp: new Date().toISOString()
        }
      };
    }
  };
};
