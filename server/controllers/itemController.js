import itemModel from '../models/item.js';

const itemController = {
    getItem: async(req, res) => {
        try {
            const item = await itemModel.getItem(req.params.id);
            if (!item) {
                return res.status(404).json({ error: 'Item not found' });
            }
            res.json(item);
        } catch (error) {
            console.error('Error getting item:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    createItem: async(req, res) => {
        try {
            const { script_id, type, subtype, name, current_revision_id } = req.body;
            if (!script_id || !type) {
                return res.status(400).json({ error: 'Required fields missing' });
            }

            const item = await itemModel.createItem({
                script_id,
                type,
                subtype,
                name,
                current_revision_id
            });

            res.status(201).json(item);
        } catch (error) {
            console.error('Error creating item:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    createItemRevision: async(req, res) => {
        try {
            const { content, summary, source, status, version_number } = req.body;

            if (!content) {
                return res.status(400).json({ error: 'Content is required' });
            }

            const revision = await itemModel.createItemRevision({
                item_id: req.params.id,
                content,
                summary,
                source: source || 'user',
                status: status || 'draft',
                version_number
            });

            res.status(201).json(revision);
        } catch (error) {
            console.error('Error creating item revision:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
};

export default itemController;