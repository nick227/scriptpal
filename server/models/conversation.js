import db from '../db/index.js';

const conversationModel = {
    getConversation: async(id) => {
        return await db.getConversation(id);
    },

    createConversation: async(conversation) => {
        return await db.createConversation(conversation);
    }
};

export default conversationModel;