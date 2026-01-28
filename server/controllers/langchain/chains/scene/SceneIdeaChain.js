import { BaseChain } from '../base/BaseChain.js';
import { INTENT_TYPES, SCRIPT_CONTEXT_PREFIX } from '../../constants.js';
import { formatScriptCollections } from '../helpers/ScriptCollectionsFormatter.js';
import { formatItemBlock, formatItemList } from '../helpers/ItemListFormatter.js';

const SCENE_IDEA_FUNCTIONS = [{
  name: 'provide_scene_idea',
  description: 'Generate a scene title and description.',
  parameters: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'Short, specific scene title.'
      },
      description: {
        type: 'string',
        description: '2-4 sentence scene description.'
      }
    },
    required: ['title', 'description']
  }
}];

const DEFAULT_SYSTEM_INSTRUCTION = `You are a scene ideation assistant.
- Return only JSON with "title" and "description".
- Keep the title short and specific.
- The description should be 2-4 sentences and align with the surrounding scenes.
- Do not include extra keys or commentary.`;

export class SceneIdeaChain extends BaseChain {
  constructor() {
    super({
      type: INTENT_TYPES.SCENE_IDEA,
      temperature: 0.4,
      modelConfig: {
        response_format: { type: 'json_object' },
        functions: SCENE_IDEA_FUNCTIONS,
        function_call: { name: 'provide_scene_idea' }
      }
    });
  }

  async run(context, prompt) {
    try {
      const messages = await this.buildMessages(context, prompt);
      const rawResponse = await this.execute(messages, context, false);
      return this.formatResponse(rawResponse?.response ?? rawResponse);
    } catch (error) {
      console.error('SceneIdeaChain execution error:', error);
      throw error;
    }
  }

  addCommonInstructions(messages) {
    return messages;
  }

  buildMessages(context, prompt) {
    const systemInstruction = context?.systemInstruction || DEFAULT_SYSTEM_INSTRUCTION;
    const scriptTitle = context?.scriptTitle || 'Untitled Script';
    const scriptDescription = context?.scriptDescription || '';
    const currentScene = formatItemBlock(context?.currentScene, 'Scene');
    const otherScenes = formatItemList(context?.otherScenes, 'Scene');
    const collectionBlock = formatScriptCollections(context?.scriptCollections);
    const scriptContext = context?.scriptContent
      ? `${SCRIPT_CONTEXT_PREFIX}\n${context.scriptContent}`
      : 'No script content available.';

    const userContent = `
${prompt}

Script Title: ${scriptTitle}
Script Description: ${scriptDescription}

Current Scene:
${currentScene}

Other Scenes:
${otherScenes}

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
    const validated = this.parseFunctionPayload(response, schema, 'Invalid scene idea payload');
    const title = typeof validated.title === 'string' ? validated.title.trim() : '';
    const description = typeof validated.description === 'string' ? validated.description.trim() : '';

    return {
      response: {
        title,
        description
      },
      type: INTENT_TYPES.SCENE_IDEA,
      metadata: {
        ...this.extractMetadata(response, ['scriptId', 'scriptTitle']),
        timestamp: new Date().toISOString()
      }
    };
  }
}
