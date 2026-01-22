import prisma from '../db/prismaClient.js';
import scriptRepository from '../repositories/scriptRepository.js';
import scriptVersionRepository from '../repositories/scriptVersionRepository.js';

const toScriptWithVersion = (script, version) => {
  if (!script) return null;
  return {
    ...script,
    versionNumber: version ? version.versionNumber : 1,
    content: version ? version.content : '',
    updatedAt: script.updatedAt,
    createdAt: script.createdAt
  };
};

const scriptModel = {
  getScript: async(id, versionNumber = null) => {
    const script = await scriptRepository.getById(id);
    if (!script) return null;

    if (versionNumber !== null && versionNumber !== undefined) {
      const version = await scriptVersionRepository.getByScriptIdAndVersion(id, versionNumber);
      return toScriptWithVersion(script, version);
    }

    const version = await scriptVersionRepository.getLatestByScriptId(id);
    return toScriptWithVersion(script, version);
  },
  createScript: async(script) => {
    const result = await prisma.$transaction(async(tx) => {
      const createdScript = await tx.script.create({
        data: {
          userId: script.userId,
          title: script.title,
          status: script.status,
          author: script.author || null
        }
      });

      const version = await tx.scriptVersion.create({
        data: {
          scriptId: createdScript.id,
          versionNumber: 1,
          content: script.content
        }
      });

      await tx.scriptCommand.create({
        data: {
          scriptId: createdScript.id,
          type: 'create_script',
          payload: { versionNumber: 1 },
          author: 'user'
        }
      });

      return { script: createdScript, version };
    });

    return toScriptWithVersion(result.script, result.version);
  },
  updateScript: async(id, script) => {
    const result = await prisma.$transaction(async(tx) => {
      const currentScript = await tx.script.findUnique({ where: { id: Number(id) } });
      if (!currentScript) {
        throw new Error('Script not found');
      }

      const latestVersion = await tx.scriptVersion.findFirst({
        where: { scriptId: currentScript.id },
        orderBy: { versionNumber: 'desc' }
      });

      const nextVersionNumber = latestVersion ? latestVersion.versionNumber + 1 : 1;

      const updatedScript = await tx.script.update({
        where: { id: currentScript.id },
        data: {
          title: script.title,
          status: script.status,
          author: script.author || null
        }
      });

      const version = await tx.scriptVersion.create({
        data: {
          scriptId: currentScript.id,
          versionNumber: nextVersionNumber,
          content: script.content
        }
      });

      await tx.scriptCommand.create({
        data: {
          scriptId: currentScript.id,
          type: 'update_script',
          payload: { versionNumber: nextVersionNumber },
          author: 'user'
        }
      });

      return { script: updatedScript, version };
    });

    return toScriptWithVersion(result.script, result.version);
  },
  getAllScriptsByUser: async(userId) => {
    const scripts = await prisma.script.findMany({
      where: { userId: Number(userId) },
      select: {
        id: true,
        userId: true,
        title: true,
        author: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1,
          select: {
            versionNumber: true,
            content: true,
            createdAt: true
          }
        }
      }
    });

    return scripts.map((script) => toScriptWithVersion(script, script.versions[0]));
  },
  getScriptProfile: async(id) => {
    console.log('getScriptProfile');
    const script = await scriptModel.getScript(id);
    if (!script) return null;

    // Get additional profile data
    const elements = await prisma.scriptElement.findMany({
      where: { scriptId: Number(id) }
    });
    const personas = await prisma.persona.findMany({
      where: { scriptId: Number(id) }
    });

    return {
      ...script,
      elements,
      personas
    };
  },
  getScriptStats: async(id) => {
    console.log('getScriptStats');
    const stats = await prisma.scriptElement.groupBy({
      by: ['type'],
      where: { scriptId: Number(id) },
      _count: { _all: true }
    });

    return stats.map((stat) => ({
      type: stat.type,
      subtype: null,
      content: null,
      count: stat._count._all
    }));
  },

  deleteScript: async(id) => {
    const scriptId = Number(id);
    return await prisma.$transaction(async(tx) => {
      await tx.chatMessage.deleteMany({ where: { scriptId } });
      await tx.scriptCommand.deleteMany({ where: { scriptId } });
      await tx.scriptVersion.deleteMany({ where: { scriptId } });
      await tx.scriptElement.deleteMany({ where: { scriptId } });
      await tx.scriptPage.deleteMany({ where: { scriptId } });
      await tx.persona.deleteMany({ where: { scriptId } });

      const deletedScript = await tx.script.delete({
        where: { id: scriptId }
      });

      return toScriptWithVersion(deletedScript, null);
    });
  }
};

export default scriptModel;
