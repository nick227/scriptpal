import prisma from '../db/prismaClient.js';

const personaController = {
  getScriptPersonas: async(req, res) => {
    try {
      const personas = await prisma.persona.findMany({
        where: { scriptId: Number(req.params.scriptId) }
      });
      res.json(personas);
    } catch (error) {
      console.error('Error getting personas:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  getPersona: async(req, res) => {
    try {
      const persona = await prisma.persona.findUnique({
        where: { id: Number(req.params.id) }
      });
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
      const { description } = req.body;
      const scriptId = Number(req.params.scriptId);
      if (!scriptId || !description) {
        return res.status(400).json({ error: 'Required fields missing' });
      }

      const persona = await prisma.persona.create({
        data: {
          scriptId,
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

      const persona = await prisma.persona.update({
        where: { id: Number(req.params.id) },
        data: {
          description
        }
      });

      res.json(persona);
    } catch (error) {
      console.error('Error updating persona:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  deletePersona: async(req, res) => {
    try {
      await prisma.persona.delete({
        where: { id: Number(req.params.id) }
      });
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting persona:', error);
      if (error?.code === 'P2025') {
        return res.status(404).json({ error: 'Persona not found' });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};

export default personaController;
