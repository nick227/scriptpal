import db from '../db/index.js'; // Adjust if your db file is in a different path or name

const personaController = {
    getScriptPersonas: async(req, res) => {
        try {
            const personas = await db.getScriptPersonas(req.params.scriptId);
            res.json(personas);
        } catch (error) {
            console.error('Error getting personas:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    getPersona: async(req, res) => {
        try {
            const persona = await db.getPersona(req.params.id);
            if (!persona) {
                return res.status(404).json({ error: 'Persona not found' });
            }
            res.json(persona);
        } catch (error) {
            console.error('Error getting persona:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    createPersona: async(req, res) => {
        try {
            const { script_id, description } = req.body;
            if (!script_id || !description) {
                return res.status(400).json({ error: 'Required fields missing' });
            }

            const persona = await db.createPersona({
                script_id,
                description
            });

            res.status(201).json(persona);
        } catch (error) {
            console.error('Error creating persona:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    updatePersona: async(req, res) => {
        try {
            const { description } = req.body;
            if (!description) {
                return res.status(400).json({ error: 'Description is required' });
            }

            const persona = await db.updatePersona(req.params.id, {
                description
            });

            res.json(persona);
        } catch (error) {
            console.error('Error updating persona:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    deletePersona: async(req, res) => {
        try {
            const deleted = await db.deletePersona(req.params.id);
            if (!deleted) {
                return res.status(404).json({ error: 'Persona not found' });
            }

            res.status(204).send();
        } catch (error) {
            console.error('Error deleting persona:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
};

export default personaController;