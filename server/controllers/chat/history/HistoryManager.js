import chatMessageRepository from '../../../repositories/chatMessageRepository.js';
import { ChatMessageSerializer } from '../../../serializers/chatMessageSerializer.js';

export class HistoryManager {
  constructor(userId, scriptId = null) {
    this.userId = userId;
    this.scriptId = scriptId;
  }

  _ensureHistoryScope(scriptId, context) {
    if (!this.userId) {
      console.warn(`[HistoryManager] Cannot ${context} without userId`);
      return false;
    }
    if (!scriptId) {
      console.warn(`[HistoryManager] Cannot ${context} without scriptId`);
      return false;
    }
    return true;
  }

  async saveInteraction(userPrompt, assistantResponse, scriptId = null, intent = null) {
    try {
      const targetScriptId = scriptId || this.scriptId;

      if (!this._ensureHistoryScope(targetScriptId, 'save interaction')) {
        return;
      }

      const raw = typeof assistantResponse === 'string'
        ? assistantResponse
        : (assistantResponse?.message ?? assistantResponse?.response ?? JSON.stringify(assistantResponse));
      const assistantContent = typeof raw === 'string' ? raw : JSON.stringify(raw);

      const aiUsage = typeof assistantResponse === 'object' && assistantResponse !== null
        ? assistantResponse.response?.metadata?.aiUsage ??
          assistantResponse.metadata?.aiUsage ??
          assistantResponse.aiUsage
        : null;

      if (aiUsage?.loggedByBaseChain) {
        console.log('[HistoryManager] Skipping save; BaseChain already logged usage', {
          userId: this.userId,
          scriptId: targetScriptId
        });
        return [];
      }

      const promptTokens = Number(aiUsage?.promptTokens ?? aiUsage?.prompt_tokens ?? 0);
      const completionTokens = Number(aiUsage?.completionTokens ?? aiUsage?.completion_tokens ?? 0);
      const totalTokens = Number(aiUsage?.totalTokens ?? aiUsage?.total_tokens ?? promptTokens + completionTokens);
      const costUsd = Number(aiUsage?.costUsd ?? aiUsage?.cost_usd ?? 0);

      console.log('[HistoryManager] saveInteraction', {
        userId: this.userId,
        scriptId: targetScriptId,
        promptTokens,
        completionTokens,
        totalTokens,
        costUsd
      });

      const saved = await chatMessageRepository.create({
        userId: this.userId,
        scriptId: targetScriptId,
        role: 'assistant',
        content: assistantContent,
        intent,
        metadata: {
          userPrompt
        },
        promptTokens,
        completionTokens,
        totalTokens,
        costUsd
      });

      return ChatMessageSerializer.flattenRows([saved]);
    } catch (error) {
      // Log but don't fail the operation
      console.error('Failed to save chat history:', error);
      return [];
    }
  }

  async getHistory(limit = 3, scriptId = null) {
    try {
      const targetScriptId = scriptId || this.scriptId;
      if (!this._ensureHistoryScope(targetScriptId, 'fetch history')) {
        return [];
      }
      console.log('[HistoryManager] fetchHistory', {
        userId: this.userId,
        scriptId: targetScriptId,
        limit
      });
      const rows = await chatMessageRepository.listByUser(this.userId, targetScriptId, limit, 0);
      const orderedRows = rows.slice().reverse();
      return ChatMessageSerializer.flattenRows(orderedRows);
    } catch (error) {
      console.error('Failed to fetch chat history:', error);
      return [];
    }
  }

  async getScriptHistory(scriptId) {
    try {
      if (!this._ensureHistoryScope(scriptId, 'fetch script history')) {
        return [];
      }
      console.log('[HistoryManager] getScriptHistory', {
        userId: this.userId,
        scriptId
      });
      const rows = await chatMessageRepository.listByUser(this.userId, scriptId, 30, 0);
      const orderedRows = rows.slice().reverse();
      return ChatMessageSerializer.flattenRows(orderedRows);
    } catch (error) {
      console.error('Failed to fetch script chat history:', error);
      return [];
    }
  }

  async clearScriptHistory(scriptId) {
    try {
      if (!this._ensureHistoryScope(scriptId, 'clear history')) {
        return false;
      }
      console.log('[HistoryManager] clearScriptHistory', {
        userId: this.userId,
        scriptId
      });
      return await chatMessageRepository.clearByUserAndScript(this.userId, scriptId);
    } catch (error) {
      console.error('Failed to clear script chat history:', error);
      return false;
    }
  }

  setScriptId(scriptId) {
    this.scriptId = scriptId;
  }
}
