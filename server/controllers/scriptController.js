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
            version_number: req.body.version_number
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

            // Validate content format - either XML-like or legacy JSON
            if (typeof content === 'string') {
                if (content.includes('</')) {
                    // XML format - validate basic structure
                    const validTags = ['header', 'action', 'speaker', 'dialog', 'parenthetical', 'transition'];
                    const tagPattern = /<(\w+)>.*?<\/\1>/g;
                    const matches = content.match(tagPattern);

                    if (!matches) {
                        console.warn('Update rejected: invalid XML format');
                        return res.status(400).json({ error: 'Content must contain valid script elements' });
                    }

                    // Validate that all tags are allowed
                    const invalidTags = matches
                        .map(match => match.match(/<(\w+)>/)[1])
                        .filter(tag => !validTags.includes(tag));

                    if (invalidTags.length > 0) {
                        console.warn('Update rejected: invalid tags:', invalidTags);
                        return res.status(400).json({
                            error: `Invalid script elements: ${invalidTags.join(', ')}. Allowed elements are: ${validTags.join(', ')}`
                        });
                    }
                } else {
                    // Try parsing as legacy JSON for backward compatibility
                    try {
                        JSON.parse(content);
                    } catch (e) {
                        console.warn('Update rejected: content is neither XML format nor valid JSON');
                        return res.status(400).json({
                            error: 'Content must be in script format with valid elements (e.g. <header>, <action>, etc.)'
                        });
                    }
                }
            } else {
                console.warn('Update rejected: content must be a string');
                return res.status(400).json({ error: 'Content must be a string' });
            }

            // Validate version_number number format
            if (version_number !== undefined && version_number !== null) {
                if (typeof version_number !== 'string' || !version_number.match(/^\d+\.\d+$/)) {
                    console.warn('Update rejected: invalid version_number number format:', version_number);
                    return res.status(400).json({ error: 'Version number must be in format "major.minor"' });
                }
            }

            console.log('Validation passed, updating script...');

            // Update script in database
            const script = await scriptModel.updateScript(req.params.id, {
                title,
                content,
                status,
                version_number: version_number || '1.0', // Default to 1.0 if not provided
                updated_at: new Date().toISOString()
            });

            if (!script) {
                console.warn('Update failed: script not found');
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