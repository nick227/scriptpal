import { BaseChain } from '../base/BaseChain.js';
import { INTENT_TYPES } from '../../constants.js';
import { buildScriptHeader } from '../helpers/ScriptPromptUtils.js';
import { COLLECTION_TYPES } from '../../../chat/collections/collectionTypes.js';
import { sanitizeChatMessage } from '../helpers/WritingResponseNormalizer.js';

const COLLECTION_TYPE_ENUM = [...COLLECTION_TYPES];

const GENERATE_COLLECTIONS_FUNCTIONS = [{
  name: 'provide_collections',
  description: 'Return story entity groups for the script.',
  parameters: {
    type: 'object',
    properties: {
      assistantResponse: {
        type: 'string',
        description: 'Short confirmation for the user.'
      },
      collections: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: COLLECTION_TYPE_ENUM
            },
            items: {
              type: 'array',
              minItems: 1,
              maxItems: 12,
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string', minLength: 1 },
                  description: { type: 'string' },
                  notes: { type: 'string' },
                  tags: {
                    type: 'array',
                    items: { type: 'string' }
                  }
                },
                required: ['title', 'description'],
                additionalProperties: false
              }
            }
          },
          required: ['type', 'items'],
          additionalProperties: false
        }
      }
    },
    required: ['assistantResponse', 'collections'],
    additionalProperties: false
  }
}];

const DEFAULT_SYSTEM = `You generate screenplay story entities for the writer.
Return JSON only via the function schema.
Each item must have title and description only (notes/tags optional).
Do not output screenplay XML, UI instructions, or database field names.
Group entities by type: scenes, characters, locations, themes, outlines.`;

const filterRequestedTypes = (collections, requestedTypes) => {
  if (!Array.isArray(collections)) {
    return [];
  }

  if (!Array.isArray(requestedTypes) || !requestedTypes.length) {
    return collections;
  }

  const allowed = new Set(requestedTypes);
  return collections.filter((group) => allowed.has(group?.type));
};

export class GenerateCollectionsChain extends BaseChain {
  constructor () {
    super({
      type: INTENT_TYPES.GENERATE_COLLECTIONS,
      temperature: 0.5,
      modelConfig: {
        response_format: { type: 'json_object' },
        functions: GENERATE_COLLECTIONS_FUNCTIONS,
        function_call: { name: 'provide_collections' }
      }
    });
  }

  buildMessages (context, prompt) {
    const scriptHeader = buildScriptHeader(context?.scriptTitle, context?.scriptDescription);
    const requested = Array.isArray(context?.requestedCollectionTypes)
      ? context.requestedCollectionTypes
      : (Array.isArray(context?.generateCollections) ? context.generateCollections : []);

    const parts = [
      prompt,
      'Generate new story entities for this script using the function schema.',
      requested.length
        ? `Only generate these types: ${requested.join(', ')}`
        : `Supported types: ${COLLECTION_TYPE_ENUM.join(', ')}`,
      scriptHeader
    ];

    if (context?.entityOutline) {
      parts.push(`Existing entities (reference only — create new unless asked to extend):\n${context.entityOutline}`);
    }

    if (context?.scriptContent) {
      parts.push(`Script excerpt (extract entities only if the user asked):\n${context.scriptContent}`);
    }

    return [{
      role: 'system',
      content: context?.systemInstruction || DEFAULT_SYSTEM
    }, {
      role: 'user',
      content: parts.join('\n\n')
    }];
  }

  formatResponse (response, requestedTypes = []) {
    const schema = { required: ['assistantResponse', 'collections'] };
    const payload = this.parseFunctionPayload(
      response,
      schema,
      'Invalid generate-collections payload'
    );

    const collections = filterRequestedTypes(
      Array.isArray(payload.collections) ? payload.collections : [],
      requestedTypes
    );

    const message = sanitizeChatMessage(payload.assistantResponse, null);

    return {
      message,
      script: null,
      collections,
      type: INTENT_TYPES.GENERATE_COLLECTIONS,
      metadata: {
        ...this.extractMetadata(response, ['scriptId', 'scriptTitle']),
        generateCollections: true,
        timestamp: new Date().toISOString()
      },
      questions: []
    };
  }

  async run (context, prompt) {
    const requested = Array.isArray(context?.requestedCollectionTypes)
      ? context.requestedCollectionTypes
      : (Array.isArray(context?.generateCollections) ? context.generateCollections : []);

    const messages = await this.buildMessages(context, prompt);
    const raw = await this.execute(messages, {
      ...context,
      chainConfig: {
        shouldGenerateQuestions: false,
        persistResponse: true
      }
    });

    const formatted = this.formatResponse(raw, requested);
    this.persistAssistantMessage(raw, formatted.message);
    return formatted;
  }
}
