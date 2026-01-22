import prisma from '../db/prismaClient.js';

const scriptCommandRepository = {
  create: async({ scriptId, type, payload, author }) => {
    return await prisma.scriptCommand.create({
      data: {
        scriptId,
        type,
        payload,
        author
      }
    });
  }
};

export default scriptCommandRepository;
