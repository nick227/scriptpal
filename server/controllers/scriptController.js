import scriptModel from '../models/script.js';

const scriptController = {
    getScript: async(req, res) => {
        try {
            const script = await scriptModel.getScript(req.params.id);
            if (!script) {
                return res.status(404).json({ error: 'Script not found' });
            }
            res.json(script);
        } catch (error) {
            console.error('Error getting script:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    createScript: async(req, res) => {
        try {
            const { user_id, title, status } = req.body;
            if (!user_id || !title) {
                return res.status(400).json({ error: 'User ID and title are required' });
            }
            const script = await scriptModel.createScript({
                user_id,
                title,
                status: status || 'draft'
            });
            res.status(201).json(script);
        } catch (error) {
            console.error('Error creating script:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    updateScript: async(req, res) => {
        try {
            const { title, status } = req.body;
            if (!title) {
                return res.status(400).json({ error: 'Title is required' });
            }
            const script = await scriptModel.updateScript(req.params.id, {
                title,
                status: status || 'draft'
            });
            if (!script) {
                return res.status(404).json({ error: 'Script not found' });
            }
            res.json(script);
        } catch (error) {
            console.error('Error updating script:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    getAllScriptsByUser: async(req, res) => {
        try {
            const scripts = await scriptModel.getAllScriptsByUser(req.query.user_id);
            res.json(scripts);
        } catch (error) {
            console.error('Error getting all scripts:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

};


export default scriptController;