import db from '../db/index.js';

const scriptModel = {
    getScript: async(id) => {
        return await db.getScript(id);
    },
    createScript: async(script) => {
        return await db.createScript(script);
    },
    updateScript: async(id, script) => {
        return await db.updateScript(id, script);
    },
    getAllScriptsByUser: async(user_id) => {
        return await db.getAllScriptsByUser(user_id);
    },
    getScriptProfile: async(id) => {
        console.log('getScriptProfile');
        const script = await db.getScript(id);
        if (!script) return null;

        // Get additional profile data
        const elements = await db.getScriptElements(id);
        const personas = await db.getScriptPersonas(id);
        const conversations = await db.getScriptConversations(id);

        return {
            ...script,
            elements,
            personas,
            conversations
        };
    },
    getScriptStats: async(id) => {
        console.log('getScriptStats');
        return await db.getScriptStats(id);
    }
}

export default scriptModel;