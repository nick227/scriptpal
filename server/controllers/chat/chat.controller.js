import { ERROR_TYPES, INTENT_TYPES } from '../langchain/constants.js';
import { ConversationCoordinator } from './orchestrator/ConversationCoordinator.js';
import chatMessageRepository from '../../repositories/chatMessageRepository.js';
import { verifyScriptOwnership } from '../../middleware/scriptOwnership.js';
import { generateAppendPage, APPEND_PAGE_INTENT, APPEND_SCRIPT_INTENT } from '../script-services/AppendPageService.js';
import { generateFullScript, FULL_SCRIPT_GENERATION_MODE } from '../script-services/FullScriptService.js';
import { createIntentResult } from '../common/ai-response.service.js';
import { router } from '../langchain/router/index.js';
import { getPromptById } from '../../../shared/promptRegistry.js';
import { isAppendPageRequest, isNextFiveLinesRequest, isFullScriptRequest } from './intent/heuristics.js';
import { buildNextFiveLinesChainConfig } from './chain/config.js';
import { buildValidatedChatResponse } from './response/validation.js';
import { loadScriptOrThrow } from '../script-services/scriptRequestUtils.js';
import { buildPromptContext } from '../script/context-builder.service.js';

const NEXT_FIVE_LINES_PROMPT = getPromptById('next-five-lines');

if (!NEXT_FIVE_LINES_PROMPT) {
  throw new Error('Next five lines prompt definition is missing from the registry');
}

const isSemanticValidationError = (error) => {
  if (!error || typeof error.message !== 'string') {
    return false;
  }
  return /append_validation_failed|full_script_validation_failed/i.test(error.message);
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
  getChatMessages: async(req, res) => {
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
      const messages = orderedRows.flatMap((row) => {
        const list = [];
        if (row.role === 'assistant') {
          if (row?.metadata?.userPrompt) {
            list.push({
              id: `user_${row.id}`,
              content: row.metadata.userPrompt,
              type: 'user',
              timestamp: row.createdAt,
              scriptId: row.scriptId
            });
          }
          list.push({
            id: `assistant_${row.id}`,
            content: row.content,
            type: 'assistant',
            timestamp: row.createdAt,
            scriptId: row.scriptId
          });
          return list;
        }

        list.push({
          id: `user_${row.id}`,
          content: row.content,
          type: 'user',
          timestamp: row.createdAt,
          scriptId: row.scriptId
        });
        return list;
      });

      res.status(200).json(messages);
    } catch (error) {
      console.error('Error getting chat messages:', error);
      res.status(500).json({
        error: 'Internal server error',
        details: error.message
      });
    }
  },

  addChatMessage: async(req, res) => {
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
      const result = await chatMessageRepository.create({
        userId,
        scriptId: parsedScriptId,
        role,
        content,
        metadata: null
      });

      res.status(201).json({ id: result.id, ...message });
    } catch (error) {
      console.error('Error adding chat message:', error);
      res.status(500).json({
        error: 'Internal server error',
        details: error.message
      });
    }
  },

  clearChatMessages: async(req, res) => {
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

  startChat: async(req, res) => {
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
      const rawContext = req.body.context || {};

      const { scriptId, script: ownedScript } = await loadScriptOrThrow(req, {
        required: false,
        allowPublic: false,
        requireEditable: true
      });

      const context = {
        ...rawContext,
        userId: req.userId,
        scriptId
      };

      console.log('[ChatController] startChat routing check', {
        scriptId,
        prompt: req.body.prompt
      });

      const forceFullScript = Boolean(context.forceFullScript);
      let forceChatFallback = false;
      const shouldGenerateFullScript = scriptId && (forceFullScript || isFullScriptRequest(req.body.prompt));
      if (shouldGenerateFullScript) {
        console.log('[ChatController] full script request detected, generating', {
          scriptId,
          forceFullScript
        });
        let fullScriptResult = null;
        try {
          fullScriptResult = await generateFullScript({
            scriptId,
            userId: req.userId,
            prompt: req.body.prompt,
            maxAttempts: 1
          });
        } catch (error) {
          if (isSemanticValidationError(error)) {
            console.warn('[ChatController] full script validation failed, falling back to chat', {
              scriptId,
              error: error.message
            });
            forceChatFallback = true;
          } else {
            throw error;
          }
        }

        if (!fullScriptResult) {
          console.log('[ChatController] full script fallback to chat', { scriptId });
        } else {
          console.log('[ChatController] full script generated', {
            scriptId,
            responseLength: fullScriptResult.responseText?.length || 0
          });

          // CANONICAL RESPONSE SHAPE (v2)
          const fullResponse = {
            message: fullScriptResult.assistantResponse || fullScriptResult.responseText,
            script: fullScriptResult.formattedScript,
            metadata: {
              generationMode: FULL_SCRIPT_GENERATION_MODE,
              fullScript: true,
              forceFullScript
            }
          };
          const validatedResponse = buildValidatedChatResponse({
            intentResult: createIntentResult(APPEND_SCRIPT_INTENT),
            scriptId,
            scriptTitle: fullScriptResult.scriptTitle,
            response: fullResponse,
            validationIntent: APPEND_SCRIPT_INTENT
          });
          if (!validatedResponse.valid) {
            console.warn('[ChatController] full script validation failed', {
              errors: validatedResponse.validation.errors
            });
            console.log('[ChatController] full script fallback to chat due to validation');
            forceChatFallback = true;
          } else {
            return res.status(200).json(validatedResponse.responsePayload);
          }
        }
      }

      const shouldGenerateNextFiveLines = scriptId && isNextFiveLinesRequest(req.body.prompt);
      if (shouldGenerateNextFiveLines) {
        console.log('[ChatController] next-five-lines detected, generating');
        const context = await buildPromptContext({
          scriptId,
          script: ownedScript,
          userId: req.userId,
          intent: INTENT_TYPES.NEXT_FIVE_LINES,
          promptDefinition: NEXT_FIVE_LINES_PROMPT,
          includeScriptContext: NEXT_FIVE_LINES_PROMPT.attachScriptContext ?? false,
          allowStructuredExtraction: true,
          updatedAtKey: 'updatedAt',
          chainConfig: buildNextFiveLinesChainConfig(),
          overrides: {
            ...rawContext,
            disableHistory: true
          }
        });
        const intentResult = createIntentResult(INTENT_TYPES.NEXT_FIVE_LINES);
        const response = await router.route(intentResult, context, NEXT_FIVE_LINES_PROMPT.userPrompt);
        const validatedResponse = buildValidatedChatResponse({
          intentResult,
          scriptId,
          scriptTitle: ownedScript.title,
          response,
          validationIntent: INTENT_TYPES.NEXT_FIVE_LINES,
          mode: INTENT_TYPES.NEXT_FIVE_LINES
        });
        if (!validatedResponse.valid) {
          console.warn('[ChatController] next-five-lines validation failed, falling back to chat', {
            scriptId,
            errors: validatedResponse.validation.errors
          });
          forceChatFallback = true;
        } else {
          const responsePayload = {
            ...validatedResponse.responsePayload,
            response: {
              ...validatedResponse.responsePayload.response,
              metadata: {
                ...validatedResponse.responsePayload.response.metadata,
                generationMode: INTENT_TYPES.NEXT_FIVE_LINES
              }
            }
          };

          return res.status(200).json(responsePayload);
        }
      }

      const forceAppend = Boolean(context.forceAppend);
      if (!forceChatFallback && scriptId && (forceAppend || isAppendPageRequest(req.body.prompt))) {
        console.log('[ChatController] append-page detected, generating');
        let appendResult = null;
        try {
          appendResult = await generateAppendPage({
            scriptId,
            userId: req.userId,
            prompt: req.body.prompt,
            maxAttempts: 1
          });
        } catch (error) {
          if (isSemanticValidationError(error)) {
            console.warn('[ChatController] append-page validation failed', {
              scriptId,
              error: error.message
            });
            return res.status(400).json({
              error: 'Append page validation failed',
              details: error.message
            });
          }
          throw error;
        }

        if (!appendResult) {
          console.log('[ChatController] append-page fallback to chat', { scriptId });
        } else {
          console.log('[ChatController] append-page generated', {
            scriptId,
            responseLength: appendResult.responseText?.length || 0
          });

          // CANONICAL RESPONSE SHAPE (v2)
          const appendResponse = {
            message: appendResult.assistantResponse || appendResult.responseText,
            script: appendResult.formattedScript,
            metadata: {
              generationMode: APPEND_PAGE_INTENT,
              forceAppend
            }
          };
          const validatedResponse = buildValidatedChatResponse({
            intentResult: createIntentResult(APPEND_SCRIPT_INTENT),
            scriptId,
            scriptTitle: appendResult.scriptTitle,
            response: appendResponse,
            validationIntent: APPEND_SCRIPT_INTENT
          });
          if (!validatedResponse.valid) {
            console.warn('[ChatController] append-page validation failed', {
              errors: validatedResponse.validation.errors
            });
            return res.status(400).json({
              error: 'Append page validation failed',
              details: validatedResponse.validation.errors
            });
          } else {
            return res.status(200).json(validatedResponse.responsePayload);
          }
        }
      }

      // 2. Create and execute chat
      console.log('[ChatController] startChat', { userId: req.userId, scriptId, requestId: req.headers['x-correlation-id'] || null });
      const chat = new ConversationCoordinator(req.userId, scriptId);
      const result = await chat.processMessage(req.body.prompt, context);

      // 3. Return standardized response
      res.status(200).json(result);

    } catch (error) {
      console.error('Chat controller error:', error);
      // Handle different error types using the standalone function
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
