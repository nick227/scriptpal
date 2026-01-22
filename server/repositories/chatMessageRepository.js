import prisma from '../db/prismaClient.js';

const chatMessageRepository = {
  listByUser: async(userId, scriptId = null, limit = 30, offset = 0) => {
    const where = { userId };
    if (scriptId !== null && scriptId !== undefined) {
      where.scriptId = scriptId;
    }

    return await prisma.chatMessage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    });
  },

  create: async({ userId, scriptId = null, role, content, intent = null, metadata = null }) => {
    return await prisma.chatMessage.create({
      data: {
        userId,
        scriptId,
        role,
        content,
        intent,
        metadata
      }
    });
  },

  clearByUserAndScript: async(userId, scriptId) => {
    const result = await prisma.chatMessage.deleteMany({
      where: { userId, scriptId }
    });
    return result.count > 0;
  }
};

export default chatMessageRepository;
