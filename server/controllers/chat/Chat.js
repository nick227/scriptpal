import { ScriptManager } from '../scripts/ScriptManager.js';
import { ChatHistoryManager } from './ChatHistoryManager.js';
import { INTENT_TYPES } from '../langchain/constants.js';
import { APPEND_SCRIPT_INTENT } from '../scripts/AppendPageService.js';
import { router } from '../langchain/router/index.js';
import { IntentClassifier } from '../langchain/chains/system/IntentClassifier.js';
import { buildAiResponse, createIntentResult } from '../aiResponse.js';
import { filterContextOverrides } from './contextUtils.js';
import { buildScriptInfo } from './scriptContextUtils.js';
import { buildScriptContextBundle } from '../contextBuilder.js';
import { isGeneralConversation, isReflectionRequest } from './intentUtils.js';
import { buildChatChainConfig } from './chainConfigUtils.js';

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
    return buildAiResponse({
      intentResult,
      scriptId: this.scriptId,
      response,
      mode: 'chat'
    });
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

      const classifierScriptInfo = buildScriptInfo(script, {
        includeScriptContext: true,
        allowStructuredExtraction: false
      });
      const classifierContext = {
        userId: this.userId,
        scriptId: this.scriptId,
        scriptTitle: classifierScriptInfo.scriptTitle,
        scriptContent: classifierScriptInfo.scriptContent
      };
      const classification = await this.intentClassifier.classify(classifierContext, prompt);
      let intent = this.resolveIntent(classification?.intent);
      if (!intent) {
        intent = this.determineIntent(prompt, script);
      }
      console.log('Selected intent:', intent, classification ? { classifier: classification.intent, reason: classification.reason } : null);
      const intentResult = createIntentResult(intent);

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
      const responseIntentResult = intent === INTENT_TYPES.SCRIPT_CONVERSATION
        ? { ...intentResult, intent: APPEND_SCRIPT_INTENT }
        : intentResult;
      return this.formatResponse(response, responseIntentResult);

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

    if (this.isReflectionRequest(prompt)) {
      return INTENT_TYPES.SCRIPT_REFLECTION;
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
    return isGeneralConversation(prompt);
  }

  isReflectionRequest(prompt) {
    return isReflectionRequest(prompt);
  }

  async buildContext(script, enhancedContext, prompt, intent) {
    const allowStructuredExtraction = [
      INTENT_TYPES.SCRIPT_CONVERSATION,
      INTENT_TYPES.SCRIPT_REFLECTION,
      INTENT_TYPES.NEXT_FIVE_LINES
    ].includes(intent);
    const includeScriptContext = [
      INTENT_TYPES.SCRIPT_CONVERSATION,
      INTENT_TYPES.SCRIPT_REFLECTION
    ].includes(intent);
    const {
      scriptTitle,
      scriptDescription,
      scriptContent,
      scriptMetadata,
      scriptCollections
    } = await buildScriptContextBundle({
      scriptId: this.scriptId,
      script,
      includeScriptContext,
      allowStructuredExtraction,
      updatedAtKey: 'lastUpdated'
    });

    const context = {
      userId: this.userId,
      scriptId: this.scriptId,
      intent,
      includeScriptContext,
      scriptContent,
      scriptTitle,
      scriptDescription,
      disableHistory: true,
      scriptMetadata,
      scriptCollections,
      chainConfig: buildChatChainConfig(),
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
      const protectedKeys = [
        'scriptId',
        'scriptTitle',
        'scriptContent',
        'scriptMetadata',
        'intent',
        'userId'
      ];
      const safeOverrides = filterContextOverrides(enhancedContext, protectedKeys);
      Object.assign(context, safeOverrides);
    }

    return context;
  }
}
