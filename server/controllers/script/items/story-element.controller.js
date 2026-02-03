import prisma from '../../../db/prismaClient.js';
import { ensureElementOwnership } from '../../../middleware/scriptOwnership.js';

const storyElementController = {
  getScriptElements: async(req, res) => {
    try {
      const script = req.script;
      if (!script || !script.id) {
        return res.status(404).json({ error: 'Script not found' });
      }
      const elements = await prisma.scriptElement.findMany({
        where: { scriptId: script.id }
      });
      res.json(elements);
    } catch (error) {
      console.error('Error getting story elements:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  getElement: async(req, res) => {
    try {
      const element = await ensureElementOwnership(req.userId, req.params.id);
      const { script, ...payload } = element;
      res.json(payload);
    } catch (error) {
      if (error?.status) {
        return res.status(error.status).json({ error: error.message });
      }
      console.error('Error getting story element:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  createElement: async(req, res) => {
    try {
      const { type, subtype, content } = req.body;
      if (!type || !content) {
        return res.status(400).json({ error: 'Required fields missing' });
      }
      const script = req.script;
      if (!script || !script.id) {
        return res.status(404).json({ error: 'Script not found' });
      }
      const element = await prisma.scriptElement.create({
        data: {
          scriptId: script.id,
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
      const elementOwner = await ensureElementOwnership(req.userId, req.params.id);
      const element = await prisma.scriptElement.update({
        where: { id: elementOwner.id },
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
      if (error?.status) {
        return res.status(error.status).json({ error: error.message });
      }
      console.error('Error updating story element:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  deleteElement: async(req, res) => {
    try {
      const elementOwner = await ensureElementOwnership(req.userId, req.params.id);
      await prisma.scriptElement.delete({
        where: { id: elementOwner.id }
      });
      res.status(204).send();
    } catch (error) {
      if (error?.status) {
        return res.status(error.status).json({ error: error.message });
      }
      console.error('Error deleting story element:', error);
      if (error?.code === 'P2025') {
        return res.status(404).json({ error: 'Story element not found' });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};

export default storyElementController;
