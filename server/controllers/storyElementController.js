import prisma from '../db/prismaClient.js';

const storyElementController = {
  getScriptElements: async(req, res) => {
    try {
      const elements = await prisma.scriptElement.findMany({
        where: { scriptId: Number(req.params.scriptId) }
      });
      res.json(elements);
    } catch (error) {
      console.error('Error getting story elements:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  getElement: async(req, res) => {
    try {
      const element = await prisma.scriptElement.findUnique({
        where: { id: Number(req.params.id) }
      });
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
      const { type, subtype, content } = req.body;
      const scriptId = Number(req.params.scriptId);
      if (!scriptId || !type || !content) {
        return res.status(400).json({ error: 'Required fields missing' });
      }
      const element = await prisma.scriptElement.create({
        data: {
          scriptId,
          type,
          payload: {
            subtype,
            content
          },
          source: 'user'
        }
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
      const element = await prisma.scriptElement.update({
        where: { id: Number(req.params.id) },
        data: {
          type,
          payload: {
            subtype,
            content
          },
          source: 'user'
        }
      });
      res.json(element);
    } catch (error) {
      console.error('Error updating story element:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  deleteElement: async(req, res) => {
    try {
      await prisma.scriptElement.delete({
        where: { id: Number(req.params.id) }
      });
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting story element:', error);
      if (error?.code === 'P2025') {
        return res.status(404).json({ error: 'Story element not found' });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};

export default storyElementController;
