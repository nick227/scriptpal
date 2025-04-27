import db from '../../db/index.js';

export class ScriptManager {
    async getScript(scriptId) {
        if (!scriptId) {
            throw new Error('No script ID provided');
        }

        try {
            const script = await db.getScript(scriptId);
            if (!script) {
                throw new Error('Script not found');
            }

            return {
                content: script.content || '',
                title: script.title || 'Untitled Script',
                updated_at: script.updated_at || null,
                version_number: script.version_number || 1,
                status: script.status || 'active'
            };
        } catch (error) {
            console.error('Error fetching script:', error);
            throw error;
        }
    }
}