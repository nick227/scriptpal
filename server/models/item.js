import db from '../db/index.js';

const itemModel = {
    getItem: async(id) => {
        return await db.getItem(id);
    },

    createItem: async(item) => {
        return await db.createItem(item);
    },

    createItemRevision: async(revision) => {
        return await db.createItemRevision(revision);
    }
};

export default itemModel;