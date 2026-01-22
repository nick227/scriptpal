import prisma from '../db/prismaClient.js';

const sessionRepository = {
  create: async(userId, token) => {
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    return await prisma.session.create({
      data: {
        userId,
        token,
        expiresAt
      }
    });
  },

  getByToken: async(token) => {
    return await prisma.session.findFirst({
      where: {
        token,
        expiresAt: {
          gt: new Date()
        }
      }
    });
  },

  deleteByToken: async(token) => {
    const result = await prisma.session.deleteMany({
      where: { token }
    });
    return result.count > 0;
  }
};

export default sessionRepository;
