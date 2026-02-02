import prisma from '../db/prismaClient.js';
import { parseNumericId, parseSortIndex } from '../utils/idUtils.js';
import { listScriptItems } from '../utils/queryUtils.js';
import { attachMediaToItems, shouldIncludeMedia } from '../services/media/MediaIncludeService.js';

export const createScriptItemController = (options) => {
  const { modelName, itemLabel, idParam, orderKey, ownerType } = options;

  if (!modelName || !itemLabel || !idParam || !orderKey) {
    throw new Error('Script item controller factory requires modelName, itemLabel, idParam, and orderKey');
  }

  const model = prisma[modelName];
  if (!model) {
    throw new Error(`Prisma model not found: ${modelName}`);
  }

  return {
    getScriptItems: async(req, res) => {
      try {
        const { script } = req;
        if (!script || !script.id) {
          return res.status(404).json({ error: 'Script not found' });
        }
        const items = await listScriptItems(model, script.id);
        if (!shouldIncludeMedia(req)) {
          return res.json(items);
        }
        const decorated = await attachMediaToItems({
          items,
          userId: req.userId,
          ownerType: ownerType || modelName,
          ownerIdKey: 'id'
        });
        res.json(decorated);
      } catch (error) {
        console.error(`Error getting ${itemLabel.toLowerCase()}s:`, error);
        res.status(500).json({ error: 'Internal server error' });
      }
    },

    createItem: async(req, res) => {
      try {
        const { script, body } = req;
        const { title, description, notes, tags, sortIndex } = body;
        if (!title) {
          return res.status(400).json({ error: 'Title is required' });
        }
        if (!script || !script.id) {
          return res.status(404).json({ error: 'Script not found' });
        }
        if (tags !== undefined && !Array.isArray(tags)) {
          return res.status(400).json({ error: 'Tags must be an array' });
        }

        let nextSortIndex = parseSortIndex(sortIndex);
        if (nextSortIndex === null) {
          const count = await model.count({
            where: { scriptId: script.id }
          });
          nextSortIndex = count;
        }

        const data = {
          scriptId: script.id,
          title,
          tags: Array.isArray(tags) ? tags : [],
          sortIndex: nextSortIndex
        };
        if (Object.prototype.hasOwnProperty.call(body, 'description')) {
          data.description = description;
        }
        if (Object.prototype.hasOwnProperty.call(body, 'notes')) {
          data.notes = notes;
        }

        const item = await model.create({ data });
        res.status(201).json(item);
      } catch (error) {
        console.error(`Error creating ${itemLabel.toLowerCase()}:`, error);
        res.status(500).json({ error: 'Internal server error' });
      }
    },

    updateItem: async(req, res) => {
      try {
        const { script, body, params } = req;
        if (!script || !script.id) {
          return res.status(404).json({ error: 'Script not found' });
        }
        const itemId = parseNumericId(params[idParam]);
        if (!itemId) {
          return res.status(400).json({ error: `Invalid ${itemLabel.toLowerCase()} ID` });
        }

        const item = await model.findFirst({
          where: { id: itemId, scriptId: script.id }
        });
        if (!item) {
          return res.status(404).json({ error: `${itemLabel} not found` });
        }

        const data = {};
        if (Object.prototype.hasOwnProperty.call(body, 'title')) {
          data.title = body.title;
        }
        if (Object.prototype.hasOwnProperty.call(body, 'description')) {
          data.description = body.description;
        }
        if (Object.prototype.hasOwnProperty.call(body, 'notes')) {
          data.notes = body.notes;
        }
        if (Object.prototype.hasOwnProperty.call(body, 'tags')) {
          if (!Array.isArray(body.tags)) {
            return res.status(400).json({ error: 'Tags must be an array' });
          }
          data.tags = body.tags;
        }
        if (Object.prototype.hasOwnProperty.call(body, 'sortIndex')) {
          const parsedSortIndex = parseSortIndex(body.sortIndex);
          if (parsedSortIndex === null) {
            return res.status(400).json({ error: 'Sort index must be a non-negative integer' });
          }
          data.sortIndex = parsedSortIndex;
        }
        if (Object.keys(data).length === 0) {
          return res.status(400).json({ error: `No ${itemLabel.toLowerCase()} updates provided` });
        }

        const updated = await model.update({
          where: { id: item.id },
          data
        });
        res.json(updated);
      } catch (error) {
        console.error(`Error updating ${itemLabel.toLowerCase()}:`, error);
        res.status(500).json({ error: 'Internal server error' });
      }
    },

    deleteItem: async(req, res) => {
      try {
        const { script, params } = req;
        if (!script || !script.id) {
          return res.status(404).json({ error: 'Script not found' });
        }
        const itemId = parseNumericId(params[idParam]);
        if (!itemId) {
          return res.status(400).json({ error: `Invalid ${itemLabel.toLowerCase()} ID` });
        }

        const item = await model.findFirst({
          where: { id: itemId, scriptId: script.id }
        });
        if (!item) {
          return res.status(404).json({ error: `${itemLabel} not found` });
        }

        await model.delete({
          where: { id: item.id }
        });
        res.status(204).send();
      } catch (error) {
        console.error(`Error deleting ${itemLabel.toLowerCase()}:`, error);
        if (error && error.code === 'P2025') {
          return res.status(404).json({ error: `${itemLabel} not found` });
        }
        res.status(500).json({ error: 'Internal server error' });
      }
    },

    reorderItems: async(req, res) => {
      try {
        const { script, body } = req;
        if (!script || !script.id) {
          return res.status(404).json({ error: 'Script not found' });
        }
        const { order } = body;
        if (!Array.isArray(order) || order.length === 0) {
          return res.status(400).json({ error: `${itemLabel} order is required` });
        }

        const itemIds = order
          .map(entry => parseNumericId(entry[orderKey]))
          .filter(Boolean);

        if (itemIds.length !== order.length) {
          return res.status(400).json({ error: `Invalid ${itemLabel.toLowerCase()} order payload` });
        }

        const items = await model.findMany({
          where: { id: { in: itemIds }, scriptId: script.id },
          select: { id: true }
        });

        if (items.length !== itemIds.length) {
          return res.status(400).json({ error: `${itemLabel} order contains invalid IDs` });
        }

        const updateOps = order.map((entry, index) => {
          const itemId = parseNumericId(entry[orderKey]);
          return model.update({
            where: { id: itemId },
            data: { sortIndex: index }
          });
        });

        await prisma.$transaction(updateOps);
        res.status(204).send();
      } catch (error) {
        console.error(`Error reordering ${itemLabel.toLowerCase()}s:`, error);
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  };
};
