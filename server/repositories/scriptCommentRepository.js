import prisma from '../db/prismaClient.js';
import scriptRepository from './scriptRepository.js';

const DEFAULT_PAGE_SIZE = 20;

const scriptCommentRepository = {
  async countByScript (scriptId) {
    if (!Number.isFinite(Number(scriptId))) {
      return 0;
    }
    const total = await prisma.scriptComment.count({
      where: {
        scriptId: Number(scriptId),
        isDeleted: false
      }
    });
    return total || 0;
  },

  async countByScripts (scriptIds) {
    const normalizedIds = scriptIds.map((id) => Number(id));
    const results = await prisma.scriptComment.groupBy({
      by: ['scriptId'],
      where: {
        scriptId: { in: normalizedIds },
        isDeleted: false
      },
      _count: { _all: true }
    });
    return results.reduce((counts, row) => {
      counts[row.scriptId] = row._count._all;
      return counts;
    }, {});
  },

  async listByScript (scriptId, { limit = DEFAULT_PAGE_SIZE, offset = 0 } = {}) {
    if (!Number.isFinite(Number(scriptId))) {
      return [];
    }

    return prisma.scriptComment.findMany({
      where: {
        scriptId: Number(scriptId),
        isDeleted: false
      },
      orderBy: { createdAt: 'desc' },
      skip: Number(offset) || 0,
      take: Number(limit) || DEFAULT_PAGE_SIZE,
      select: {
        id: true,
        scriptId: true,
        userId: true,
        authorLabel: true,
        content: true,
        createdAt: true,
        updatedAt: true
      }
    });
  },

  async createForPublicScript ({ scriptId, userId, content, authorLabel }) {
    const targetScript = await scriptRepository.getPublicScriptById(Number(scriptId));
    if (!targetScript) {
      throw new Error('Public script not found');
    }

    return prisma.scriptComment.create({
      data: {
        scriptId: Number(scriptId),
        userId: Number(userId),
        content,
        authorLabel
      }
    });
  }
};

export default scriptCommentRepository;
