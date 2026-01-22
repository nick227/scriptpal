import chatMessageRepository from '../../repositories/chatMessageRepository.js';

export class ChatHistoryManager {
  constructor(userId, scriptId = null) {
    this.userId = userId;
    this.scriptId = scriptId;
  }

  async saveInteraction(userPrompt, assistantResponse, scriptId = null, intent = null) {
    try {
      const targetScriptId = scriptId || this.scriptId;
      
      const assistantContent = typeof assistantResponse === 'string' ?
        assistantResponse :
        JSON.stringify(assistantResponse);

      await chatMessageRepository.create({
        userId: this.userId,
        scriptId: targetScriptId,
        role: 'assistant',
        content: assistantContent,
        intent,
        metadata: {
          userPrompt
        }
      });
    } catch (error) {
      // Log but don't fail the operation
      console.error('Failed to save chat history:', error);
    }
  }

  async getHistory(limit = 3, scriptId = null) {
    try {
      const targetScriptId = scriptId || this.scriptId;
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
