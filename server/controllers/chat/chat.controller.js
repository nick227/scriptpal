import { ERROR_TYPES, INTENT_TYPES } from '../langchain/constants.js';
import { ConversationCoordinator } from './orchestrator/ConversationCoordinator.js';
import chatMessageRepository from '../../repositories/chatMessageRepository.js';
import { verifyScriptOwnership } from '../../middleware/scriptOwnership.js';
import { APPEND_PAGE_INTENT, APPEND_SCRIPT_INTENT } from '../script-services/AppendPageService.js';
import { createIntentResult } from '../common/ai-response.service.js';
import { router } from '../langchain/router/index.js';
import { getPromptById } from '../../../shared/promptRegistry.js';
import { isAppendPageRequest, isNextFiveLinesRequest, isFullScriptRequest } from './intent/heuristics.js';
import { buildNextFiveLinesChainConfig } from './chain/config.js';
import { buildValidatedChatResponse } from './response/validation.js';
import { loadScriptOrThrow } from '../script-services/scriptRequestUtils.js';
import { buildPromptContext } from '../script/context-builder.service.js';
import { ChatMessageSerializer } from '../../serializers/chatMessageSerializer.js';

const NEXT_FIVE_LINES_PROMPT = getPromptById('next-five-lines');

if (!NEXT_FIVE_LINES_PROMPT) {
  throw new Error('Next five lines prompt definition is missing from the registry');
}

const APPEND_PAGE_PROMPT = getPromptById('append-page');

if (!APPEND_PAGE_PROMPT) {
  throw new Error('Append page prompt definition is missing from the registry');
}

const SCRIPT_INTENT_HANDLERS = {
  fullScript: async ({ context, req, baseContext, ownedScript }) => {
    const { scriptId, prompt, chatRequestId } = context;
    console.log('[ChatController] full script intent detected', { scriptId, chatRequestId });
    const chainContext = await buildPromptContext({
      scriptId,
      script: ownedScript,
      userId: req.userId,
      intent: APPEND_SCRIPT_INTENT,
      includeScriptContext: true,
      allowStructuredExtraction: true,
      updatedAtKey: 'updatedAt',
      chainConfig: {
        shouldGenerateQuestions: false,
        chatRequestId
      },
      overrides: {
        ...baseContext,
        disableHistory: true
      },
      protectedKeys: [
        'chatRequestId',
        'scriptId',
        'scriptTitle',
        'scriptContent',
        'includeScriptContext',
        'attachScriptContext',
        'expectsFormattedScript',
        'scriptMetadata',
        'scriptCollections',
        'chainConfig',
        'intent',
        'userId'
      ]
    });

    chainContext.chatRequestId = chatRequestId;
    chainContext.originalUserPrompt = context.prompt;

    const intentResult = createIntentResult(APPEND_SCRIPT_INTENT);
    const response = await router.route(intentResult, chainContext, prompt);
    return handleScriptMutationResponse({
      response,
      scriptId,
      scriptTitle: ownedScript?.title || 'Untitled Script',
      validationIntent: APPEND_SCRIPT_INTENT,
      mode: APPEND_SCRIPT_INTENT
    });
  },

  nextFiveLines: async ({ context, req, baseContext, ownedScript }) => {
    const { scriptId, chatRequestId } = context;
    console.log('[ChatController] next-five-lines intent detected', { scriptId, chatRequestId });
    const chainContext = await buildPromptContext({
      scriptId,
      script: ownedScript,
      userId: req.userId,
      intent: INTENT_TYPES.NEXT_FIVE_LINES,
      promptDefinition: NEXT_FIVE_LINES_PROMPT,
      includeScriptContext: NEXT_FIVE_LINES_PROMPT.attachScriptContext ?? false,
      allowStructuredExtraction: true,
      updatedAtKey: 'updatedAt',
      chainConfig: {
        ...buildNextFiveLinesChainConfig(),
        chatRequestId
      },
      overrides: {
        ...baseContext,
        disableHistory: true
      }
    });

    chainContext.chatRequestId = chatRequestId;
    chainContext.originalUserPrompt = context.prompt;

    const intentResult = createIntentResult(INTENT_TYPES.NEXT_FIVE_LINES);
    const response = await router.route(intentResult, chainContext, NEXT_FIVE_LINES_PROMPT.userPrompt);
    return handleScriptMutationResponse({
      response,
      scriptId,
      scriptTitle: ownedScript?.title || 'Untitled Script',
      validationIntent: INTENT_TYPES.NEXT_FIVE_LINES,
      mode: INTENT_TYPES.NEXT_FIVE_LINES
    });
  },

  appendPage: async ({ context, req, baseContext, ownedScript }) => {
    const { scriptId, prompt, chatRequestId } = context;
    console.log('[ChatController] append-page intent detected', { scriptId, chatRequestId });
    const chainContext = await buildPromptContext({
      scriptId,
      script: ownedScript,
      userId: req.userId,
      intent: APPEND_SCRIPT_INTENT,
      promptDefinition: APPEND_PAGE_PROMPT,
      includeScriptContext: APPEND_PAGE_PROMPT.attachScriptContext ?? true,
      allowStructuredExtraction: true,
      updatedAtKey: 'updatedAt',
      chainConfig: {
        shouldGenerateQuestions: false,
        chatRequestId
      },
      overrides: {
        ...baseContext,
        disableHistory: true
      }
    });

    chainContext.chatRequestId = chatRequestId;
    chainContext.originalUserPrompt = context.prompt;

    const intentResult = createIntentResult(APPEND_SCRIPT_INTENT);
    const response = await router.route(intentResult, chainContext, prompt);
    return handleScriptMutationResponse({
      response,
      scriptId,
      scriptTitle: chainContext.scriptTitle || 'Untitled Script',
      validationIntent: APPEND_SCRIPT_INTENT,
      mode: APPEND_PAGE_INTENT
    });
  }
};

const resolveScriptHandler = (context) => {
  if (!context?.scriptId) {
    return null;
  }

  const prompt = context.prompt;
  if (Boolean(context.forceFullScript) || isFullScriptRequest(prompt)) {
    return SCRIPT_INTENT_HANDLERS.fullScript;
  }

  if (isNextFiveLinesRequest(prompt)) {
    return SCRIPT_INTENT_HANDLERS.nextFiveLines;
  }

  if (Boolean(context.forceAppend) || isAppendPageRequest(prompt)) {
    return SCRIPT_INTENT_HANDLERS.appendPage;
  }

  return null;
};

const throwScriptValidationError = (details) => {
  const error = new Error('Script mutation validation failed');
  error.status = 400;
  error.details = details;
  throw error;
};

const handleScriptMutationResponse = ({
  response,
  scriptId,
  scriptTitle,
  validationIntent,
  mode
}) => {
  const intentResult = createIntentResult(validationIntent);
  const validatedResponse = buildValidatedChatResponse({
    intentResult,
    scriptId,
    scriptTitle,
    response,
    validationIntent,
    mode
  });

  if (!validatedResponse.valid) {
    console.warn('[ChatController] script mutation validation failed', {
      scriptId,
      errors: validatedResponse.validation.errors
    });
    return throwScriptValidationError(validatedResponse.validation.errors);
  }

  return validatedResponse.responsePayload;
};

// Move handleChatError to be a standalone function
function handleChatError(error) {
  if (error?.status) {
    return {
      status: error.status,
      body: {
        error: error.message || 'Request failed'
      }
    };
  }

  const errorResponse = {
    status: 500,
    body: {
      error: 'Internal server error',
      details: error.message
    }
  };

  if (error.message?.includes(ERROR_TYPES.INVALID_FORMAT)) {
    errorResponse.status = 400;
    errorResponse.body.error = 'Invalid request format';
  } else if (error.message?.includes('Script not found')) {
    errorResponse.status = 404;
    errorResponse.body.error = 'Script not found';
  } else if (error.message?.includes(ConversationCoordinator.CHAT_ERRORS.INVALID_INTENT)) {
    errorResponse.status = 400;
    errorResponse.body.error = 'Invalid intent';
  } else if (
    error.message?.includes('Rate limit exceeded') ||
    error.message?.includes('insufficient_quota') ||
    error.message?.includes('429')
  ) {
    errorResponse.status = 429;
    errorResponse.body.error = 'AI rate limit exceeded';
    errorResponse.body.details = 'The AI service is temporarily unavailable. Please try again shortly.';
  } else if (error.message === 'insufficient_content') {
    errorResponse.status = 400;
    errorResponse.body.error = 'Insufficient content for analysis';
  } else if (error.message?.includes('Chain execution failed')) {
    errorResponse.body.error = 'Chain execution failed';
  }

  return errorResponse;
}

const chatController = {
  getChatMessages: async (req, res) => {
    try {
      if (!req.userId) {
        console.warn('[ChatController] getChatMessages request without userId');
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { query, userId } = req;
      const { scriptId: scriptIdRaw, limit: limitRaw, offset: offsetRaw } = query;

      if (!scriptIdRaw) {
        console.warn('[ChatController] getChatMessages missing scriptId', { userId });
        return res.status(400).json({ error: 'Script ID is required' });
      }

      const scriptId = parseInt(scriptIdRaw, 10);
      if (Number.isNaN(scriptId)) {
        return res.status(400).json({ error: 'Invalid script ID' });
      }

      const limit = limitRaw ? parseInt(limitRaw, 10) : 30;
      const offset = offsetRaw ? parseInt(offsetRaw, 10) : 0;

      if (Number.isNaN(limit) || Number.isNaN(offset)) {
        return res.status(400).json({ error: 'Invalid pagination values' });
      }

      await verifyScriptOwnership(req.userId, scriptId);

      console.log('[ChatController] getChatMessages', { userId, scriptId });
      const rows = await chatMessageRepository.listByUser(userId, scriptId, limit, offset);
      const orderedRows = rows.slice().reverse();
      const messages = ChatMessageSerializer.flattenRows(orderedRows);
      res.status(200).json(messages);
    } catch (error) {
      console.error('Error getting chat messages:', error);
      res.status(500).json({
        error: 'Internal server error',
        details: error.message
      });
    }
  },

  addChatMessage: async (req, res) => {
    try {
      const { userId, body } = req;
      if (!userId) {
        console.warn('[ChatController] addChatMessage request without userId');
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { scriptId, message } = body;

      if (!scriptId || !message) {
        return res.status(400).json({ error: 'Script ID and message are required' });
      }

      const parsedScriptId = parseInt(scriptId, 10);
      if (Number.isNaN(parsedScriptId)) {
        return res.status(400).json({ error: 'Invalid script ID' });
      }

      await verifyScriptOwnership(req.userId, parsedScriptId);

      console.log('[ChatController] addChatMessage', { userId, scriptId: parsedScriptId });

      const role = message.type === 'assistant' ? 'assistant' : 'user';
      const content = message.content || '';
      const metadata = message.metadata && typeof message.metadata === 'object'
        ? message.metadata
        : null;
      const savedRow = await chatMessageRepository.create({
        userId,
        scriptId: parsedScriptId,
        role,
        content,
        metadata
      });

      if (!savedRow) {
        return res.status(500).json({
          error: 'Failed to persist chat message'
        });
      }

      const messages = ChatMessageSerializer.toMessages(savedRow);
      return res.status(201).json({ messages });
    } catch (error) {
      console.error('Error adding chat message:', error);
      res.status(500).json({
        error: 'Internal server error',
        details: error.message
      });
    }
  },

  clearChatMessages: async (req, res) => {
    try {
      const scriptId = parseInt(req.params.scriptId, 10);
      if (!req.userId) {
        console.warn('[ChatController] clearChatMessages request without userId');
        return res.status(401).json({ error: 'Authentication required' });
      }

      if (isNaN(scriptId)) {
        return res.status(400).json({ error: 'Invalid script ID' });
      }

      await verifyScriptOwnership(req.userId, scriptId);

      console.log('[ChatController] clearChatMessages', { userId: req.userId, scriptId });
      const result = await chatMessageRepository.clearByUserAndScript(req.userId, scriptId);
      res.status(200).json({ success: result });
    } catch (error) {
      console.error('Error clearing chat messages:', error);
      res.status(500).json({
        error: 'Internal server error',
        details: error.message
      });
    }
  },

  startChat: async (req, res) => {
    try {
      // 1. Validate inputs
      if (!req.body.prompt) {
        return res.status(400).json({ error: 'Missing prompt' });
      }

      if (!req.userId) {
        console.warn('[ChatController] startChat request without userId');
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Handle enhanced context
      const baseContext = req.body.context || {};
      const chatRequestId = baseContext.chatRequestId || req.headers['x-correlation-id']
        || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      baseContext.chatRequestId = chatRequestId;
      req.chatRequestId = chatRequestId;

      const { scriptId, script: ownedScript } = await loadScriptOrThrow(req, {
        required: false,
        allowPublic: false,
        requireEditable: true
      });

      const context = {
        ...baseContext,
        userId: req.userId,
        scriptId,
        chatRequestId,
        prompt: req.body.prompt
      };

      console.log('[ChatController] startChat routing check', {
        scriptId,
        prompt: req.body.prompt,
        chatRequestId
      });

      // If a script mutation intent is detected, we never fall back to general chat.
      const handler = resolveScriptHandler(context);
      if (handler) {
        const payload = await handler({
          context,
          req,
          baseContext,
          ownedScript
        });

        let history = [];

        if (Number.isInteger(scriptId)) {
          const rows = await chatMessageRepository.listByUser(
            req.userId,
            scriptId,
            10,
            0
          );

          history = ChatMessageSerializer.flattenRows(
            rows.slice().reverse()
          );
        }

        return res.status(200).json({
          ...payload,
          history
        });
      }


      // 2. Create and execute chat
      console.log('[ChatController] startChat', {
        userId: req.userId,
        scriptId,
        requestId: chatRequestId
      });
      const chat = new ConversationCoordinator(req.userId, scriptId);
      const result = await chat.processMessage(
        req.body.prompt,
        context
      );

      let history = [];

      if (Number.isInteger(scriptId)) {
        const rows = await chatMessageRepository.listByUser(
          req.userId,
          scriptId,
          10,
          0
        );

        history = ChatMessageSerializer.flattenRows(
          rows.slice().reverse()
        );
      }

      res.status(200).json({
        ...result,
        history
      });

    } catch (error) {
      console.error('Chat controller error:', error);
      const errorResponse = handleChatError(error);
      res.status(errorResponse.status).json(errorResponse.body);
    }
  },

  getWelcomeButtons: (req, res) => {
    try {
      const welcomeButtons = [{
        text: 'Create New Script',
        action: 'create_script',
        description: 'Start a new script from scratch'
      },
      {
        text: 'Import Script',
        action: 'import_script',
        description: 'Import an existing script'
      },
      {
        text: 'View Tutorial',
        action: 'view_tutorial',
        description: 'Learn how to use the AI assistant'
      },
      {
        text: 'Recent Scripts',
        action: 'recent_scripts',
        description: 'View your recent scripts'
      }
      ];

      res.status(200).json({
        buttons: welcomeButtons
      });
    } catch (error) {
      console.error('Error getting welcome buttons:', error);
      res.status(500).json({
        error: 'Internal server error',
        details: error.message
      });
    }
  }
};

export default chatController;
