import { BaseChain } from '../base/BaseChain.js';
import { INTENT_TYPES, SCRIPT_CONTEXT_PREFIX } from '../../constants.js';
import { formatScriptCollections } from '../helpers/ScriptCollectionsFormatter.js';
import { formatItemList } from '../helpers/ItemListFormatter.js';

const formatOutlineBlock = (outline) => {
  if (!outline || typeof outline !== 'object') return 'None (user has not entered any draft).';
  const title = (outline.title || '').trim();
  const items = Array.isArray(outline.items) ? outline.items : [];
  const itemLines = items
    .slice(0, 12)
    .map((i) => {
      const text = typeof i === 'string' ? i : (i?.text ?? '');
      const indent = typeof i?.indent === 'number' ? i.indent : 0;
      return `  ${'  '.repeat(indent)}• ${text}`;
    })
    .filter((s) => s.trim().length > 2);
  if (!title && !itemLines.length) return 'None (user has not entered any draft).';
  const lines = title ? [`Title: ${title}`] : [];
  if (itemLines.length) lines.push('Items:', ...itemLines);
  return lines.join('\n');
};

const OUTLINE_IDEA_FUNCTIONS = [{
  name: 'provide_outline_idea',
  description: 'Generate an outline title and items.',
  parameters: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'Short outline title.'
      },
      items: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of outline beats or points.'
      }
    },
    required: ['items']
  }
}];

const DEFAULT_SYSTEM_INSTRUCTION = `You are an outline ideation assistant.
- Return only JSON with "title" (optional) and "items" (array of strings).
- items: 3-8 concise beats/points for a screenplay or story outline.
- Each item: short, actionable, story-beat oriented.
- Do not include extra keys or commentary.`;

export class OutlineIdeaChain extends BaseChain {
  constructor () {
    super({
      type: INTENT_TYPES.OUTLINE_IDEA,
      temperature: 0.4,
      modelConfig: {
        response_format: { type: 'json_object' },
        functions: OUTLINE_IDEA_FUNCTIONS,
        function_call: { name: 'provide_outline_idea' }
      }
    });
  }

  async run (context, prompt) {
    try {
      const messages = await this.buildMessages(context, prompt);
      const rawResponse = await this.execute(messages, context, false);
      return this.formatResponse(rawResponse);
    } catch (error) {
      console.error('OutlineIdeaChain execution error:', error);
      throw error;
    }
  }

  addCommonInstructions (messages) {
    return messages;
  }

  buildMessages (context, prompt) {
    const systemInstruction = context?.systemInstruction || DEFAULT_SYSTEM_INSTRUCTION;
    const scriptTitle = context?.scriptTitle || 'Untitled Script';
    const scriptDescription = context?.scriptDescription || '';
    const currentOutline = formatOutlineBlock(context?.currentOutline);
    const otherOutlines = formatItemList(context?.otherOutlines, 'Outline');
    const collectionBlock = formatScriptCollections(context?.scriptCollections);
    const scriptContext = context?.scriptContent
      ? `${SCRIPT_CONTEXT_PREFIX}\n${context.scriptContent}`
      : 'No script content available.';

    const userContent = `
${prompt}

SCRIPT
Title: ${scriptTitle}
Description: ${scriptDescription}

DRAFT OUTLINE (from Add Outline modal – title and items if user entered any):
${currentOutline}

Other outlines in this script:
${otherOutlines}

${collectionBlock}

FULL SCRIPT TEXT:
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

  formatResponse (response) {
    const schema = { required: ['items'] };
    const validated = this.parseFunctionPayload(response, schema, 'Invalid outline idea payload');
    const title = typeof validated.title === 'string' ? validated.title.trim() : '';
    const rawItems = Array.isArray(validated.items) ? validated.items : [];
    const items = rawItems
      .filter((i) => typeof i === 'string' && i.trim())
      .map((text) => ({ text: text.trim(), source: 'ai' }));

    return {
      response: { title, items },
      type: INTENT_TYPES.OUTLINE_IDEA,
      metadata: {
        ...this.extractMetadata(response, ['scriptId', 'scriptTitle']),
        timestamp: new Date().toISOString()
      }
    };
  }
}
