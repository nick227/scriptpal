import prisma from '../db/prismaClient.js';

const scriptVersionRepository = {
  getLatestByScriptId: async(scriptId) => {
    return await prisma.scriptVersion.findFirst({
      where: { scriptId },
      orderBy: { versionNumber: 'desc' }
    });
  },

  getByScriptIdAndVersion: async(scriptId, versionNumber) => {
    return await prisma.scriptVersion.findFirst({
      where: { scriptId, versionNumber }
    });
  },

  listByScriptId: async(scriptId) => {
    return await prisma.scriptVersion.findMany({
      where: { scriptId },
      orderBy: { versionNumber: 'desc' }
    });
  },

  listSummaryByScriptId: async(scriptId) => {
    return await prisma.scriptVersion.findMany({
      where: { scriptId },
      orderBy: { versionNumber: 'desc' },
      select: { versionNumber: true, createdAt: true }
    });
  },

  create: async({ scriptId, versionNumber, content }) => {
    return await prisma.scriptVersion.create({
      data: {
        scriptId,
        versionNumber,
        content
      }
    });
  }
};

export default scriptVersionRepository;
