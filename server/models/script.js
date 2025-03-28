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
    }
}

export default scriptModel;