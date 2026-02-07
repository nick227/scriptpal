import prisma from '../../../db/prismaClient.js';
import { parseNumericId, parseSortIndex } from '../../../utils/idUtils.js';
import { listScriptItems } from '../../../utils/queryUtils.js';

const normalizeItems = (raw) => {
  if (!Array.isArray(raw)) return [];
  return raw.map((entry) => {
    if (typeof entry === 'string') return { text: entry };
    if (entry && typeof entry.text === 'string') return { text: entry.text };
    return { text: String(entry ?? '') };
  }).filter((e) => e.text.trim());
};

const outlineController = {
  getScriptOutlines: async (req, res) => {
    try {
      const { script } = req;
      if (!script || !script.id) {
        return res.status(404).json({ error: 'Script not found' });
      }
      const outlines = await listScriptItems(prisma.outline, script.id);
      res.json(outlines);
    } catch (error) {
      console.error('Error getting outlines:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  createOutline: async (req, res) => {
    try {
      const { script } = req;
      const body = req.manualBody || req.body;
      const { title, items, sortIndex } = body;
      if (!title || typeof title !== 'string' || !title.trim()) {
        return res.status(400).json({ error: 'Title is required' });
      }
      if (!script || !script.id) {
        return res.status(404).json({ error: 'Script not found' });
      }

      let nextSortIndex = parseSortIndex(sortIndex);
      if (nextSortIndex === null) {
        const count = await prisma.outline.count({
          where: { scriptId: script.id }
        });
        nextSortIndex = count;
      }

      const itemsArray = Array.isArray(items) ? items : [];
      const normalizedItems = itemsArray.map((t) =>
        typeof t === 'string' ? { text: t } : (t && typeof t.text === 'string' ? t : { text: String(t ?? '') })
      ).filter((e) => e.text.trim());

      const outline = await prisma.outline.create({
        data: {
          scriptId: script.id,
          title: title.trim(),
          items: normalizedItems,
          sortIndex: nextSortIndex
        }
      });
      res.status(201).json(outline);
    } catch (error) {
      console.error('Error creating outline:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  updateOutline: async (req, res) => {
    try {
      const { script, params } = req;
      const body = req.manualBody || req.body;
      if (!script || !script.id) {
        return res.status(404).json({ error: 'Script not found' });
      }
      const outlineId = parseNumericId(params.outlineId);
      if (!outlineId) {
        return res.status(400).json({ error: 'Invalid outline ID' });
      }

      const outline = await prisma.outline.findFirst({
        where: { id: outlineId, scriptId: script.id }
      });
      if (!outline) {
        return res.status(404).json({ error: 'Outline not found' });
      }

      const data = {};
      if (Object.prototype.hasOwnProperty.call(body, 'title')) {
        const t = body.title;
        if (typeof t !== 'string' || !t.trim()) {
          return res.status(400).json({ error: 'Title cannot be empty' });
        }
        data.title = t.trim();
      }
      if (Object.prototype.hasOwnProperty.call(body, 'items')) {
        data.items = normalizeItems(body.items);
      }
      if (Object.prototype.hasOwnProperty.call(body, 'sortIndex')) {
        const parsedSortIndex = parseSortIndex(body.sortIndex);
        if (parsedSortIndex === null) {
          return res.status(400).json({ error: 'Sort index must be a non-negative integer' });
        }
        data.sortIndex = parsedSortIndex;
      }
      if (Object.keys(data).length === 0) {
        return res.status(400).json({ error: 'No outline updates provided' });
      }

      const updated = await prisma.outline.update({
        where: { id: outline.id },
        data
      });
      res.json(updated);
    } catch (error) {
      console.error('Error updating outline:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  deleteOutline: async (req, res) => {
    try {
      const { script, params } = req;
      if (!script || !script.id) {
        return res.status(404).json({ error: 'Script not found' });
      }
      const outlineId = parseNumericId(params.outlineId);
      if (!outlineId) {
        return res.status(400).json({ error: 'Invalid outline ID' });
      }

      const outline = await prisma.outline.findFirst({
        where: { id: outlineId, scriptId: script.id }
      });
      if (!outline) {
        return res.status(404).json({ error: 'Outline not found' });
      }

      await prisma.outline.delete({
        where: { id: outline.id }
      });
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting outline:', error);
      if (error?.code === 'P2025') {
        return res.status(404).json({ error: 'Outline not found' });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  reorderOutlines: async (req, res) => {
    try {
      const { script, body } = req;
      if (!script || !script.id) {
        return res.status(404).json({ error: 'Script not found' });
      }
      const { order } = body;
      if (!Array.isArray(order) || order.length === 0) {
        return res.status(400).json({ error: 'Outline order is required' });
      }

      const outlineIds = order
        .map((entry) => parseNumericId(entry.outlineId))
        .filter(Boolean);

      if (outlineIds.length !== order.length) {
        return res.status(400).json({ error: 'Invalid outline order payload' });
      }

      const outlines = await prisma.outline.findMany({
        where: { id: { in: outlineIds }, scriptId: script.id },
        select: { id: true }
      });

      if (outlines.length !== outlineIds.length) {
        return res.status(400).json({ error: 'Outline order contains invalid outline IDs' });
      }

      const updateOps = order.map((entry, index) => {
        const outlineId = parseNumericId(entry.outlineId);
        return prisma.outline.update({
          where: { id: outlineId },
          data: { sortIndex: index }
        });
      });

      await prisma.$transaction(updateOps);
      res.status(204).send();
    } catch (error) {
      console.error('Error reordering outlines:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};

export default outlineController;
