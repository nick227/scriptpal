import chatMessageRepository from '../../repositories/chatMessageRepository.js';

export class ChatHistoryManager {
  constructor(userId, scriptId = null) {
    this.userId = userId;
    this.scriptId = scriptId;
  }

  _ensureHistoryScope(scriptId, context) {
    if (!this.userId) {
      console.warn(`[ChatHistoryManager] Cannot ${context} without userId`);
      return false;
    }
    if (!scriptId) {
      console.warn(`[ChatHistoryManager] Cannot ${context} without scriptId`);
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

      const assistantContent = typeof assistantResponse === 'string'
        ? assistantResponse
        : JSON.stringify(assistantResponse);

      const aiUsage = typeof assistantResponse === 'object' && assistantResponse !== null
        ? assistantResponse.response?.metadata?.aiUsage ??
          assistantResponse.metadata?.aiUsage ??
          assistantResponse.aiUsage
        : null;

      if (aiUsage?.loggedByBaseChain) {
        console.log('[ChatHistoryManager] Skipping save; BaseChain already logged usage', {
          userId: this.userId,
          scriptId: targetScriptId
        });
        return;
      }

      const promptTokens = Number(aiUsage?.promptTokens ?? aiUsage?.prompt_tokens ?? 0);
      const completionTokens = Number(aiUsage?.completionTokens ?? aiUsage?.completion_tokens ?? 0);
      const totalTokens = Number(aiUsage?.totalTokens ?? aiUsage?.total_tokens ?? promptTokens + completionTokens);
      const costUsd = Number(aiUsage?.costUsd ?? aiUsage?.cost_usd ?? 0);

      console.log('[ChatHistoryManager] saveInteraction', {
        userId: this.userId,
        scriptId: targetScriptId,
        promptTokens,
        completionTokens,
        totalTokens,
        costUsd
      });

      await chatMessageRepository.create({
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
    } catch (error) {
      // Log but don't fail the operation
      console.error('Failed to save chat history:', error);
    }
  }

  async getHistory(limit = 3, scriptId = null) {
    try {
      const targetScriptId = scriptId || this.scriptId;
      if (!this._ensureHistoryScope(targetScriptId, 'fetch history')) {
        return [];
      }
      console.log('[ChatHistoryManager] fetchHistory', {
        userId: this.userId,
        scriptId: targetScriptId,
        limit
      });
      const rows = await chatMessageRepository.listByUser(this.userId, targetScriptId, limit, 0);
      return rows.flatMap((row) => {
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
      console.log('[ChatHistoryManager] getScriptHistory', {
        userId: this.userId,
        scriptId
      });
      const rows = await chatMessageRepository.listByUser(this.userId, scriptId, 30, 0);
      return rows.flatMap((row) => {
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
      console.log('[ChatHistoryManager] clearScriptHistory', {
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
