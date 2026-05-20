import { ScriptManager } from '../../script-services/ScriptManager.js';
import { HistoryManager } from '../history/HistoryManager.js';
import { INTENT_TYPES } from '../../langchain/constants.js';
import { APPEND_SCRIPT_INTENT } from '../../script-services/AppendPageService.js';
import { router } from '../../langchain/router/index.js';
import { IntentClassifier } from '../../langchain/chains/system/IntentClassifier.js';
import { buildAiResponse, createIntentResult } from '../../common/ai-response.service.js';
import { filterContextOverrides } from '../context/overrides.js';
import { buildScriptInfo } from '../context/script.js';
import { assembleContext, resolveCoordinatorProfile } from '../context/assembleContext.js';
import { isGeneralConversation, isReflectionRequest, isAttachHistoryRequest } from '../intent/heuristics.js';
import { buildChatChainConfig } from '../chain/config.js';

export class ConversationCoordinator {
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
    this.historyManager = new HistoryManager(userId, scriptId);
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

      const script = context?.script || (this.scriptId ? await this.scriptManager.getScript(this.scriptId) : null);
      console.log('Script Details:', {
        scriptId: this.scriptId,
        hasScript: Boolean(script),
        title: script?.title || null,
        versionNumber: script?.versionNumber || null,
        status: script?.status || null
      });

      const classifierScriptInfo = buildScriptInfo(script, {
        includeScriptContext: false,
        allowStructuredExtraction: false
      });
      const classifierContext = {
        chatRequestId: context?.chatRequestId,
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

      const savedHistory = (await this.historyManager.saveInteraction(
        prompt,
        response,
        this.scriptId,
        intent,
        { chatRequestId: context?.chatRequestId || null }
      )) || [];

      console.log('\n=== Operation Complete ===');
      const responseIntentResult = intent === INTENT_TYPES.SCRIPT_CONVERSATION
        ? { ...intentResult, intent: APPEND_SCRIPT_INTENT }
        : intentResult;
      return {
        ...this.formatResponse(response, responseIntentResult),
        history: savedHistory
      };

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
    const profile = resolveCoordinatorProfile(intent);
    const attachHistory = Boolean(enhancedContext?.attachHistory)
      || isAttachHistoryRequest(prompt);

    const context = await assembleContext({
      profile,
      script,
      scriptId: this.scriptId,
      userId: this.userId,
      intent,
      prompt,
      attachHistory,
      chatRequestId: enhancedContext?.chatRequestId || null,
      overrides: {
        chainConfig: buildChatChainConfig()
      }
    });

    if (enhancedContext && Object.keys(enhancedContext).length > 0) {
      const protectedKeys = [
        'scriptId',
        'scriptTitle',
        'scriptContent',
        'scriptMetadata',
        'scriptCollections',
        'intent',
        'userId',
        'chatHistory',
        'disableHistory'
      ];
      const safeOverrides = filterContextOverrides(enhancedContext, protectedKeys);
      Object.assign(context, safeOverrides);
    }

    return context;
  }
}
