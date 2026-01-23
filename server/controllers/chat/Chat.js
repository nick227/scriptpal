import { ScriptManager } from '../scripts/ScriptManager.js';
import { ChatHistoryManager } from './ChatHistoryManager.js';
import { INTENT_TYPES } from '../langchain/constants.js';
import { router } from '../langchain/router/index.js';
import { ChainHelper } from '../langchain/chains/helpers/ChainHelper.js';
import { IntentClassifier } from '../langchain/chains/system/IntentClassifier.js';

const CHAT_ONLY_PATTERN = /\b(?:just chat|talk about|chit chat|quick question|small talk|random|how are you|anything else)\b/i;

export class Chat {
  static CHAT_ERRORS = {
    SCRIPT_NOT_FOUND: 'SCRIPT_NOT_FOUND',
    INVALID_INTENT: 'INVALID_INTENT',
    SAVE_FAILED: 'SAVE_FAILED',
    PROCESSING_ERROR: 'PROCESSING_ERROR'
  };

  constructor(userId, scriptId) {
    this.userId = userId;
    this.scriptId = scriptId;
    this.scriptManager = new ScriptManager();
    this.historyManager = new ChatHistoryManager(userId, scriptId);
    this.intentClassifier = new IntentClassifier();
  }

  formatResponse(response, intentResult) {
    // Handle string responses (common in analysis)
    if (typeof response === 'string') {
      response = {
        response: response,
        type: intentResult.intent
      };
    }

    // Get script title from metadata or direct property
    const scriptTitle = response.metadata && response.metadata.scriptTitle ||
            response.title ||
            'Untitled Script';

    return {
      success: true,
      intent: intentResult.intent,
      confidence: intentResult.confidence,
      target: intentResult.target,
      value: intentResult.value,
      scriptId: this.scriptId,
      scriptTitle: scriptTitle,
      timestamp: new Date().toISOString(),
      response: response.response || response
    };
  }

  async processMessage(prompt, context = {}) {
    try {
      console.log('\n=== Starting Chat Processing ===');
      console.log('Processing message:', {
        prompt,
        userId: this.userId,
        scriptId: this.scriptId,
        hasContext: Object.keys(context).length > 0
      });

      const script = this.scriptId ? await this.scriptManager.getScript(this.scriptId) : null;
      console.log('Script Details:', script);

      const classifierContext = {
        userId: this.userId,
        scriptId: this.scriptId,
        scriptTitle: script?.title,
        scriptContent: ChainHelper.extractTextFromStructuredContent(script?.content || '') ?? ''
      };
      const classification = await this.intentClassifier.classify(classifierContext, prompt);
      let intent = this.resolveIntent(classification?.intent);
      if (!intent) {
        intent = this.determineIntent(prompt, script);
      }
      console.log('Selected intent:', intent, classification ? { classifier: classification.intent, reason: classification.reason } : null);
      const intentResult = this.createIntentResult(intent);

      const preparedContext = await this.buildContext(script, context, prompt, intent);
      console.log('Prepared context for routing:', {
        intent,
        scriptId: preparedContext.scriptId,
        historyLength: preparedContext.chatHistory?.length || 0,
        hasEnhancedContext: Object.keys(context || {}).length > 0
      });

      const response = await router.route(intentResult, preparedContext, prompt);

      this.historyManager.saveInteraction(prompt, response, this.scriptId, intent)
        .catch(error => console.error('Chat history save failed:', error));

      console.log('\n=== Operation Complete ===');
      return this.formatResponse(response, intentResult);

    } catch (error) {
      console.error('Message processing failed:', error);
      throw new Error(`Message processing failed: ${error.message}`);
    }
  }
  determineIntent(prompt, script) {
    if (!this.scriptId || !script) {
      return INTENT_TYPES.GENERAL_CONVERSATION;
    }

    if (this.isGeneralConversation(prompt)) {
      return INTENT_TYPES.GENERAL_CONVERSATION;
    }

    return INTENT_TYPES.SCRIPT_CONVERSATION;
  }

  resolveIntent (candidateIntent) {
    if (!candidateIntent) {
      return null;
    }

    const validIntents = Object.values(INTENT_TYPES);
    return validIntents.includes(candidateIntent) ? candidateIntent : null;
  }

  isGeneralConversation(prompt) {
    if (!prompt || typeof prompt !== 'string') {
      return true;
    }

    return CHAT_ONLY_PATTERN.test(prompt);
  }

  createIntentResult(intent) {
    return {
      intent,
      confidence: 1,
      target: null,
      value: null
    };
  }

  async buildContext(script, enhancedContext, prompt, intent) {
    const scriptContent = script?.content || '';
    const normalizedContent = ChainHelper.extractTextFromStructuredContent(scriptContent) ?? scriptContent;

    const includeScriptContext = intent === INTENT_TYPES.SCRIPT_CONVERSATION;

    const context = {
      userId: this.userId,
      scriptId: this.scriptId,
      intent,
      includeScriptContext,
      scriptContent: includeScriptContext ? normalizedContent : '',
      scriptTitle: script?.title || 'Untitled Script',
      scriptMetadata: {
        lastUpdated: script?.updatedAt,
        versionNumber: script?.versionNumber,
        status: script?.status
      },
      chainConfig: {
        shouldGenerateQuestions: true,
        modelConfig: {
          temperature: 0.7,
          response_format: { type: 'text' }
        }
      },
      prompt
    };

    if (intent === INTENT_TYPES.GENERAL_CONVERSATION) {
      context.chatHistory = [];
      context.disableHistory = true;
    } else {
      const history = await this.historyManager.getHistory(3, this.scriptId);
      context.chatHistory = history.map(msg => ({
        role: msg.type === 'user' ? 'user' : 'assistant',
        content: msg.content
      }));
    }

    if (enhancedContext && Object.keys(enhancedContext).length > 0) {
      const protectedKeys = new Set([
        'scriptId',
        'scriptTitle',
        'scriptContent',
        'scriptMetadata',
        'intent',
        'userId'
      ]);

      Object.entries(enhancedContext).forEach(([key, value]) => {
        if (!protectedKeys.has(key)) {
          context[key] = value;
        }
      });
    }

    return context;
  }
}
