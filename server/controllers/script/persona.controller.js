import prisma from '../../db/prismaClient.js';
import { ensurePersonaOwnership } from '../../middleware/scriptOwnership.js';

const personaController = {
  getScriptPersonas: async(req, res) => {
    try {
      const script = req.script;
      if (!script || !script.id) {
        return res.status(404).json({ error: 'Script not found' });
      }
      const personas = await prisma.persona.findMany({
        where: { scriptId: script.id }
      });
      res.json(personas);
    } catch (error) {
      console.error('Error getting personas:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  getPersona: async(req, res) => {
    try {
      const persona = await ensurePersonaOwnership(req.userId, req.params.id);
      const { script, ...payload } = persona;
      res.json(payload);
    } catch (error) {
      if (error?.status) {
        return res.status(error.status).json({ error: error.message });
      }
      console.error('Error getting persona:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  createPersona: async(req, res) => {
    try {
      const { description } = req.body;
      if (!description) {
        return res.status(400).json({ error: 'Description is required' });
      }
      const script = req.script;
      if (!script || !script.id) {
        return res.status(404).json({ error: 'Script not found' });
      }

      const persona = await prisma.persona.create({
        data: {
          scriptId: script.id,
          description,
          userId: req.userId
        }
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
      await ensurePersonaOwnership(req.userId, req.params.id);
      const persona = await prisma.persona.update({
        where: { id: Number(req.params.id) },
        data: {
          description
        }
      });
      res.json(persona);
    } catch (error) {
      if (error?.status) {
        return res.status(error.status).json({ error: error.message });
      }
      console.error('Error updating persona:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  deletePersona: async(req, res) => {
    try {
      await ensurePersonaOwnership(req.userId, req.params.id);
      await prisma.persona.delete({
        where: { id: Number(req.params.id) }
      });
      res.status(204).send();
    } catch (error) {
      if (error?.status) {
        return res.status(error.status).json({ error: error.message });
      }
      console.error('Error deleting persona:', error);
      if (error?.code === 'P2025') {
        return res.status(404).json({ error: 'Persona not found' });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};

export default personaController;
