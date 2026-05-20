import { ScriptManager } from '../../script-services/ScriptManager.js';
import { HistoryManager } from '../history/HistoryManager.js';
import { router } from '../../langchain/router/index.js';
import { buildAiResponse, createIntentResult } from '../../common/ai-response.service.js';
import { filterContextOverrides } from '../context/overrides.js';
import { assembleContextFromResolution } from '../context/assembleContext.js';
import { resolveOutcome } from '../intent/resolveOutcome.js';
import { outcomeToIntent, resolveResponseIntent, shouldRemapResponseToAppend } from '../intent/outcomeRouting.js';
import { buildChatChainConfig } from '../chain/config.js';
import { CHAT_OUTCOME } from '../intent/outcomes.js';
import { SceneWriteOrchestrator } from './SceneWriteOrchestrator.js';
import { processResponseCollections } from '../collections/processCollections.js';

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
  }

  formatResponse(response, intentResult) {
    return buildAiResponse({
      intentResult,
      scriptId: this.scriptId,
      response,
      mode: intentResult?.intent || null
    });
  }

  async processMessage(prompt, context = {}) {
    try {
      const script = context?.script || (this.scriptId ? await this.scriptManager.getScript(this.scriptId) : null);

      const resolution = resolveOutcome(prompt, {
        scriptId: this.scriptId,
        attachHistory: context.attachHistory,
        selection: context.selection,
        forceAppend: context.forceAppend,
        forceFullScript: context.forceFullScript
      });

      const intent = outcomeToIntent(resolution.outcome);
      const intentResult = createIntentResult(intent);

      console.log('[ConversationCoordinator] outcome resolution', {
        outcome: resolution.outcome,
        contextProfile: resolution.contextProfile,
        attachHistory: resolution.attachHistory,
        attachScenes: resolution.attachScenes,
        attachEntityContext: resolution.attachEntityContext,
        generateCollections: resolution.generateCollections,
        editorOperation: resolution.editorOperation,
        intent
      });

      const preparedContext = await this.buildContextFromResolution(
        script,
        context,
        prompt,
        resolution,
        intent
      );

      let response = resolution.outcome === CHAT_OUTCOME.WRITE_FROM_SCENES
        ? await new SceneWriteOrchestrator({ scriptId: this.scriptId }).run(preparedContext, prompt)
        : await router.route(intentResult, preparedContext, prompt);

      response = await processResponseCollections({
        response,
        scriptId: this.scriptId,
        resolution,
        intent,
        chatRequestId: context?.chatRequestId || null,
        context: preparedContext,
        prompt,
        persist: true
      });

      const savedHistory = (await this.historyManager.saveInteraction(
        prompt,
        response,
        this.scriptId,
        intent,
        { chatRequestId: context?.chatRequestId || null }
      )) || [];

      const responseIntentResult = resolveResponseIntent(resolution.outcome, intentResult);

      return {
        ...this.formatResponse(response, responseIntentResult),
        history: savedHistory,
        outcome: resolution.outcome,
        editorOperation: resolution.editorOperation
      };

    } catch (error) {
      console.error('Message processing failed:', error);
      throw new Error(`Message processing failed: ${error.message}`);
    }
  }

  async buildContextFromResolution(script, enhancedContext, prompt, resolution, intent) {
    const overrides = {
      chainConfig: buildChatChainConfig(),
      outcome: resolution.outcome,
      editorOperation: resolution.editorOperation
    };

    const context = await assembleContextFromResolution({
      resolution,
      script,
      scriptId: this.scriptId,
      userId: this.userId,
      intent,
      prompt,
      chatRequestId: enhancedContext?.chatRequestId || null,
      overrides,
      selection: enhancedContext?.selection || null
    });

    if (enhancedContext && Object.keys(enhancedContext).length > 0) {
      const protectedKeys = [
        'scriptId',
        'scriptTitle',
        'scriptContent',
        'scriptMetadata',
        'scriptCollections',
        'sceneOutline',
        'entityOutline',
        'generateCollections',
        'attachEntityContext',
        'selection',
        'selectionRange',
        'intent',
        'userId',
        'chatHistory',
        'disableHistory',
        'contextProfile',
        'outcome',
        'editorOperation'
      ];
      const safeOverrides = filterContextOverrides(enhancedContext, protectedKeys);
      Object.assign(context, safeOverrides);
    }

    return context;
  }
}
