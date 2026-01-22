import prisma from '../db/prismaClient.js';

const scriptSelect = {
  id: true,
  userId: true,
  title: true,
  author: true,
  status: true,
  createdAt: true,
  updatedAt: true
};

const scriptRepository = {
  create: async({ userId, title, status, author }) => {
    return await prisma.script.create({
      data: {
        userId,
        title,
        status,
        author
      }
    });
  },

  getById: async(id) => {
    return await prisma.script.findUnique({
      where: { id },
      select: scriptSelect
    });
  },

  getByUserId: async(userId) => {
    return await prisma.script.findMany({
      where: { userId },
      select: scriptSelect
    });
  },

  updateMetadata: async(id, { title, status, author }) => {
    return await prisma.script.update({
      where: { id },
      data: {
        title,
        status,
        author
      }
    });
  }
};

export default scriptRepository;
