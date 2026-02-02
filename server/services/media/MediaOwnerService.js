import prisma from '../../db/prismaClient.js';

const ownerTypeHandlers = {
  script: async({ ownerId, userId }) => {
    return prisma.script.findFirst({
      where: {
        id: ownerId,
        userId
      },
      select: { id: true }
    });
  },
  scene: async({ ownerId, userId }) => {
    return prisma.scene.findFirst({
      where: {
        id: ownerId,
        script: { userId }
      },
      select: { id: true }
    });
  },
  character: async({ ownerId, userId }) => {
    return prisma.character.findFirst({
      where: {
        id: ownerId,
        script: { userId }
      },
      select: { id: true }
    });
  },
  location: async({ ownerId, userId }) => {
    return prisma.location.findFirst({
      where: {
        id: ownerId,
        script: { userId }
      },
      select: { id: true }
    });
  },
  theme: async({ ownerId, userId }) => {
    return prisma.theme.findFirst({
      where: {
        id: ownerId,
        script: { userId }
      },
      select: { id: true }
    });
  }
};

export const ensureOwnerExists = async({ ownerType, ownerId, userId }) => {
  const handler = ownerTypeHandlers[ownerType];
  if (!handler) {
    return false;
  }
  const record = await handler({ ownerId, userId });
  return Boolean(record);
};
