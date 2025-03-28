import db from '../db/index.js';

const storyElementController = {
    getScriptElements: async(req, res) => {
        try {
            const elements = await db.getScriptElements(req.params.scriptId);
            res.json(elements);
        } catch (error) {
            console.error('Error getting story elements:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    getElement: async(req, res) => {
        try {
            const element = await db.getElement(req.params.id);
            if (!element) {
                return res.status(404).json({ error: 'Story element not found' });
            }
            res.json(element);
        } catch (error) {
            console.error('Error getting story element:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    createElement: async(req, res) => {
        try {
            const { script_id, type, subtype, content } = req.body;
            if (!script_id || !type || !content) {
                return res.status(400).json({ error: 'Required fields missing' });
            }
            const element = await db.createElement({
                script_id,
                type,
                subtype,
                content
            });
            res.status(201).json(element);
        } catch (error) {
            console.error('Error creating story element:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    updateElement: async(req, res) => {
        try {
            const { type, subtype, content } = req.body;
            if (!type || !content) {
                return res.status(400).json({ error: 'Required fields missing' });
            }
            const element = await db.updateElement(req.params.id, {
                type,
                subtype,
                content
            });
            res.json(element);
        } catch (error) {
            console.error('Error updating story element:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    deleteElement: async(req, res) => {
        try {
            const deleted = await db.deleteElement(req.params.id);
            if (!deleted) {
                return res.status(404).json({ error: 'Story element not found' });
            }
            res.status(204).send();
        } catch (error) {
            console.error('Error deleting story element:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
};

export default storyElementController;