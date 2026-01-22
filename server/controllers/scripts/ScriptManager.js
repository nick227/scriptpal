import scriptModel from '../../models/script.js';

export class ScriptManager {
  async getScript(scriptId) {
    if (!scriptId) {
      throw new Error('No script ID provided');
    }

    try {
      const script = await scriptModel.getScript(scriptId);
      if (!script) {
        throw new Error('Script not found');
      }

      return {
        content: script.content || '',
        title: script.title || 'Untitled Script',
        updatedAt: script.updatedAt || null,
        versionNumber: script.versionNumber || 1,
        status: script.status || 'active'
      };
    } catch (error) {
      console.error('Error fetching script:', error);
      throw error;
    }
  }
}
