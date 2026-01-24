import { ERROR_TYPES } from './langchain/constants.js';
import { Chat } from './chat/Chat.js';
import chatMessageRepository from '../repositories/chatMessageRepository.js';
import { generateAppendPage, APPEND_PAGE_INTENT, APPEND_SCRIPT_INTENT } from './scripts/AppendPageService.js';

const APPEND_PAGE_PATTERNS = [
  /\bnext page\b/i,
  /\b(add|write|generate|continue|append)\b[\s\S]{0,40}\bpage\b/i,
  /\b(add|write|generate|continue)\b[\s\S]{0,40}\bscript\b/i,
  /\b(add|write|generate|continue)\b[\s\S]{0,40}\bscreenplay\b/i
];

const isAppendPageRequest = (prompt) => {
  if (!prompt || typeof prompt !== 'string') {
    return false;
  }

  return APPEND_PAGE_PATTERNS.some(pattern => pattern.test(prompt));
};

// Move handleChatError to be a standalone function
function handleChatError(error) {
  const errorResponse = {
    status: 500,
    body: {
      error: 'Internal server error',
      details: error.message
    }
  };

  if (error.message.includes(ERROR_TYPES.INVALID_FORMAT)) {
    errorResponse.status = 400;
    errorResponse.body.error = 'Invalid request format';
  } else if (error.message.includes('Script not found')) {
    errorResponse.status = 404;
    errorResponse.body.error = 'Script not found';
  } else if (error.message.includes(Chat.CHAT_ERRORS.INVALID_INTENT)) {
    errorResponse.status = 400;
    errorResponse.body.error = 'Invalid intent';
  } else if (error.message === 'insufficient_content') {
    errorResponse.status = 400;
    errorResponse.body.error = 'Insufficient content for analysis';
  } else if (error.message.includes('Chain execution failed')) {
    // Keep 500 status but provide more specific error
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

      // Handle scriptId - check both req.body.scriptId and context.scriptId
      let scriptId = null;
      const scriptIdSource = req.body.scriptId || rawContext.scriptId;
      if (scriptIdSource !== null && scriptIdSource !== undefined) {
        scriptId = parseInt(scriptIdSource, 10);
        if (isNaN(scriptId)) {
          return res.status(400).json({ error: 'Invalid script ID' });
        }
      }

      const context = {
        ...rawContext,
        userId: req.userId,
        scriptId
      };

      console.log('[ChatController] startChat routing check', {
        scriptId,
        prompt: req.body.prompt
      });

      if (scriptId && isAppendPageRequest(req.body.prompt)) {
        console.log('[ChatController] append-page detected, generating');
        const appendResult = await generateAppendPage({
          scriptId,
          userId: req.userId,
          prompt: req.body.prompt
        });

        console.log('[ChatController] append-page generated', {
          scriptId,
          responseLength: appendResult.responseText?.length || 0
        });

        return res.status(200).json({
          success: true,
          intent: APPEND_SCRIPT_INTENT,
          confidence: 1,
          target: null,
          value: null,
          scriptId,
          scriptTitle: appendResult.scriptTitle,
          timestamp: new Date().toISOString(),
          response: {
            content: appendResult.responseText,
            metadata: {
              generationMode: APPEND_PAGE_INTENT
            }
          }
        });
      }

      // 2. Create and execute chat
      console.log('[ChatController] startChat', { userId: req.userId, scriptId, requestId: req.headers['x-correlation-id'] || null });
      const chat = new Chat(req.userId, scriptId);
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
