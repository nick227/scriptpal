import prisma from '../db/prismaClient.js';

const mediaJobRepository = {
  create: async(data) => {
    return prisma.mediaGenerationJob.create({ data });
  },

  updateById: async(id, data) => {
    return prisma.mediaGenerationJob.update({
      where: { id },
      data
    });
  },

  getByIdForUser: async(id, userId) => {
    return prisma.mediaGenerationJob.findFirst({
      where: {
        id,
        userId
      }
    });
  }
};

export default mediaJobRepository;
