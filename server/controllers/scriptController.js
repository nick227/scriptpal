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
            const { user_id, title, status, content } = req.body;
            if (!user_id || !title) {
                return res.status(400).json({ error: 'User ID and title are required' });
            }
            const script = await scriptModel.createScript({
                user_id,
                title,
                status: status || 'draft',
                version_number: '1.0',
                content: content || JSON.stringify({
                    content: '',
                    format: 'plain',
                    pageCount: 1,
                    chapters: [],
                    metadata: {
                        lastModified: new Date().toISOString(),
                        formatVersion: '1.0'
                    }
                })
            });
            res.status(201).json(script);
        } catch (error) {
            console.error('Error creating script:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    updateScript: async(req, res) => {
        console.log('Update script request received:', {
            id: req.params.id,
            bodyKeys: Object.keys(req.body),
            contentLength: req.body.content ? req.body.content.length : 0,
            version: req.body.version_number
        });

        try {
            const { title, status, content, version_number } = req.body;

            // Validate required fields
            if (!title) {
                console.warn('Update rejected: missing title');
                return res.status(400).json({ error: 'Title is required' });
            }

            // Validate content format
            if (!content) {
                console.warn('Update rejected: missing content');
                return res.status(400).json({ error: 'Content is required' });
            }

            // Validate content is proper JSON
            try {
                if (typeof content === 'string') {
                    const parsed = JSON.parse(content);
                    console.log('Content validation passed:', {
                        hasContent: !!parsed.content,
                        hasFormat: !!parsed.format,
                        hasMetadata: !!parsed.metadata
                    });
                }
            } catch (e) {
                console.warn('Update rejected: invalid JSON content:', e.message);
                return res.status(400).json({ error: 'Content must be valid JSON' });
            }

            // Validate version number format
            if (version_number && !version_number.match(/^\d+\.\d+$/)) {
                console.warn('Update rejected: invalid version number format:', version_number);
                return res.status(400).json({ error: 'Version number must be in format "major.minor"' });
            }

            console.log('Validation passed, updating script...');
            const script = await scriptModel.updateScript(req.params.id, {
                title,
                status: status || 'draft',
                content,
                version_number
            });

            if (!script) {
                console.warn('Update failed: script not found:', req.params.id);
                return res.status(404).json({ error: 'Script not found' });
            }

            // Log successful update
            console.log('Script updated successfully:', {
                id: req.params.id,
                title: script.title,
                version: script.version_number,
                contentLength: script.content.length
            });

            res.json(script);
        } catch (error) {
            console.error('Error updating script:', {
                error: error.message,
                stack: error.stack,
                scriptId: req.params.id
            });
            res.status(500).json({
                error: 'Internal server error',
                details: error.message
            });
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
    },

    getScriptProfile: async(req, res) => {
        try {
            console.log('getScriptProfile');
            const script = await scriptModel.getScriptProfile(req.params.id);
            res.json(script);
        } catch (error) {
            console.error('Error getting script profile:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    getScriptStats: async(req, res) => {
        try {
            const stats = await scriptModel.getScriptStats(req.params.id);
            res.json(stats);


        } catch (error) {
            console.error('Error getting script stats:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
};

export default scriptController;