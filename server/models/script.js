import prisma from '../db/prismaClient.js';
import { listScriptItems } from '../utils/queryUtils.js';
import scriptRepository from '../repositories/scriptRepository.js';
import scriptCommentRepository from '../repositories/scriptCommentRepository.js';
import scriptVersionRepository from '../repositories/scriptVersionRepository.js';
import { generateUniqueSlug } from '../lib/slug.js';
import { generatePublicId } from '../lib/id.js';
import scriptSlugRepository from '../repositories/scriptSlugRepository.js';

const toScriptWithVersion = (script, version) => {
  if (!script) return null;
  return {
    ...script,
    versionNumber: version ? version.versionNumber : 1,
    content: version ? version.content : '',
    visibility: script.visibility ?? 'private',
    commentCount: script.commentCount ?? 0,
    updatedAt: script.updatedAt,
    createdAt: script.createdAt
  };
};

/** Normalize content for equality (trim; if JSON, parse+stringify to ignore key order/whitespace). Same idea as save path. */
const normalizeContentForCompare = (content) => {
  if (content == null) return '';
  const s = String(content).trim();
  if (!s) return '';
  if (s.charAt(0) === '{') {
    try {
      return JSON.stringify(JSON.parse(s));
    } catch {
      return s;
    }
  }
  return s;
};

const buildCloneTitleCandidate = (baseTitle, copyIndex) => {
  if (copyIndex <= 1) {
    return `${baseTitle} (Copy)`;
  }
  return `${baseTitle} (Copy ${copyIndex})`;
};

const generateUniqueCloneTitle = async({
  userId,
  sourceTitle,
  client = prisma,
  maxAttempts = 200
}) => {
  const normalizedUserId = Number(userId);
  const baseTitle = (typeof sourceTitle === 'string' && sourceTitle.trim())
    ? sourceTitle.trim()
    : 'Untitled Script';

  for (let copyIndex = 1; copyIndex <= maxAttempts; copyIndex += 1) {
    const candidate = buildCloneTitleCandidate(baseTitle, copyIndex);
    const existing = await client.script.findFirst({
      where: {
        userId: normalizedUserId,
        title: candidate
      },
      select: { id: true }
    });
    if (!existing) {
      return candidate;
    }
  }

  const error = new Error('Unable to generate unique clone title');
  error.code = 'CLONE_TITLE_COLLISION_EXHAUSTED';
  throw error;
};

const scriptModel = {
  getScript: async(id, versionNumber = null) => {
    const scriptId = Number(id);
    if (!Number.isFinite(scriptId)) {
      return null;
    }
    const script = await scriptRepository.getById(scriptId);
    if (!script) return null;

    if (versionNumber !== null && versionNumber !== undefined) {
      const version = await scriptVersionRepository.getByScriptIdAndVersion(scriptId, versionNumber);
      if (!version) return null;
      return toScriptWithVersion(script, version);
    }

    const version = await scriptVersionRepository.getLatestByScriptId(scriptId);
    console.log('[ScriptModel] getScript', {
      scriptId,
      visibility: script.visibility,
      requestedVersion: versionNumber,
      latestVersion: version?.versionNumber
    });
    return toScriptWithVersion(script, version);
  },
  createScript: async(script) => {
    const normalizedVisibility = script.visibility || 'private';
    const result = await prisma.$transaction(async(tx) => {
      const slug = await generateUniqueSlug({
        title: script.title,
        isTaken: async(candidate) => {
          const takenForUser = await scriptSlugRepository.existsSlugForUser({
            userId: script.userId,
            slug: candidate
          }, tx);
          if (takenForUser) return true;
          if (normalizedVisibility === 'public') {
            return await scriptSlugRepository.existsPublicSlug({ slug: candidate }, tx);
          }
          return false;
        }
      });

      const createdScript = await tx.script.create({
        data: {
          userId: script.userId,
          title: script.title,
          status: script.status,
          author: script.author || null,
          description: script.description || null,
          visibility: normalizedVisibility,
          slug,
          publicId: normalizedVisibility === 'public' ? generatePublicId() : null
        }
      });

      await tx.scriptSlug.create({
        data: {
          userId: script.userId,
          scriptId: createdScript.id,
          slug,
          isCanonical: true
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

      const resolvedTitle = script.title ?? currentScript.title;
      const resolvedStatus = script.status ?? currentScript.status;
      const resolvedAuthor = script.author !== undefined
        ? (script.author || null)
        : currentScript.author;
      const resolvedDescription = script.description !== undefined
        ? (script.description || null)
        : currentScript.description;

      const resolvedContent = script.content !== undefined && script.content !== null
        ? script.content
        : latestVersion?.content ?? '';

      const requestedVisibility = script.visibility === 'public'
        ? 'public'
        : script.visibility === 'private'
          ? 'private'
          : undefined;
      const desiredVisibility = requestedVisibility ?? currentScript.visibility;

      const contentUnchanged = normalizeContentForCompare(resolvedContent) === normalizeContentForCompare(latestVersion?.content ?? '');
      const metadataUnchanged = resolvedTitle === currentScript.title
        && resolvedStatus === currentScript.status
        && resolvedAuthor === currentScript.author
        && resolvedDescription === currentScript.description
        && desiredVisibility === currentScript.visibility;

      if (latestVersion && metadataUnchanged && contentUnchanged) {
        return { script: currentScript, version: latestVersion };
      }

      let nextSlug = currentScript.slug;
      let nextPublicId = currentScript.publicId;
      const shouldRefreshSlug = resolvedTitle !== currentScript.title
        || (desiredVisibility === 'public' && currentScript.visibility !== 'public');

      if (shouldRefreshSlug) {
        const candidateSlug = await generateUniqueSlug({
          title: resolvedTitle,
          isTaken: async(candidate) => {
            const takenForUser = await scriptSlugRepository.existsSlugForUser({
              userId: currentScript.userId,
              slug: candidate,
              excludeScriptId: currentScript.id
            }, tx);
            if (takenForUser) return true;
            if (desiredVisibility === 'public') {
              return await scriptSlugRepository.existsPublicSlug({
                slug: candidate,
                excludeScriptId: currentScript.id
              }, tx);
            }
            return false;
          }
        });
        if (candidateSlug && candidateSlug !== currentScript.slug) {
          await scriptSlugRepository.deactivateCanonical(currentScript.id, tx);
          await scriptSlugRepository.ensureCanonical({
            userId: currentScript.userId,
            scriptId: currentScript.id,
            slug: candidateSlug
          }, tx);
          nextSlug = candidateSlug;
        }
      }

      if (desiredVisibility === 'public' && !nextPublicId) {
        nextPublicId = generatePublicId();
      }

      const updatedScript = await tx.script.update({
        where: { id: currentScript.id },
        data: {
          title: resolvedTitle,
          status: resolvedStatus,
          author: resolvedAuthor,
          description: resolvedDescription,
          visibility: desiredVisibility,
          slug: nextSlug,
          publicId: nextPublicId
        }
      });

      const version = await tx.scriptVersion.create({
        data: {
          scriptId: currentScript.id,
          versionNumber: nextVersionNumber,
          content: resolvedContent
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
        slug: true,
        visibility: true,
        createdAt: true,
        updatedAt: true,
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1,
          select: {
            versionNumber: true,
            createdAt: true
          }
        }
      }
    });

    return scripts.map((script) => toScriptWithVersion(script, script.versions[0]));
  },
  getScriptProfile: async(id) => {
    console.log('getScriptProfile');
    const scriptId = Number(id);
    const [
      script,
      elements,
      personas,
      scenes,
      characters,
      locations,
      themes
    ] = await Promise.all([
      scriptModel.getScript(scriptId),
      prisma.scriptElement.findMany({ where: { scriptId } }),
      prisma.persona.findMany({ where: { scriptId } }),
      listScriptItems(prisma.scene, scriptId),
      listScriptItems(prisma.character, scriptId),
      listScriptItems(prisma.location, scriptId),
      listScriptItems(prisma.theme, scriptId)
    ]);
    if (!script) return null;

    return {
      ...script,
      elements,
      personas,
      scenes,
      characters,
      locations,
      themes
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
      await tx.scene.deleteMany({ where: { scriptId } });
      await tx.character.deleteMany({ where: { scriptId } });
      await tx.location.deleteMany({ where: { scriptId } });
      await tx.theme.deleteMany({ where: { scriptId } });

      const deletedScript = await tx.script.delete({
        where: { id: scriptId }
      });

      return toScriptWithVersion(deletedScript, null);
    });
  },

  getPublicScripts: async(options = {}) => {
    const result = await scriptRepository.getPublicScripts(options);
    const scripts = (result.scripts || []).map((script) => {
      const version = Array.isArray(script.versions) ? script.versions[0] : null;
      return toScriptWithVersion(script, version);
    });
    const scriptIds = scripts.map((script) => script.id);
    const commentCounts = await scriptCommentRepository.countByScripts(scriptIds);
    scripts.forEach((script) => {
      script.commentCount = commentCounts[script.id] || 0;
    });
    return {
      scripts,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize
    };
  },

  getPublicScript: async(id) => {
    const script = await scriptRepository.getPublicScriptById(Number(id));
    if (!script) return null;
    const version = Array.isArray(script.versions) ? script.versions[0] : null;
    const commentCount = await scriptCommentRepository.countByScript(script.id);
    script.commentCount = commentCount;
    return toScriptWithVersion(script, version);
  },

  getPublicScriptByPublicId: async(publicId) => {
    const script = await scriptRepository.getPublicScriptByPublicId(publicId);
    if (!script) return null;
    const version = Array.isArray(script.versions) ? script.versions[0] : null;
    const commentCount = await scriptCommentRepository.countByScript(script.id);
    script.commentCount = commentCount;
    return toScriptWithVersion(script, version);
  },

  getScriptBySlug: async(userId, slug) => {
    const slugRecord = await scriptSlugRepository.getBySlugForUser(Number(userId), slug);
    if (!slugRecord) return null;
    const script = await scriptRepository.getById(slugRecord.scriptId);
    if (!script) return null;
    const version = await scriptVersionRepository.getLatestByScriptId(script.id);
    return toScriptWithVersion(script, version);
  },

  getPublicScriptBySlug: async(slug) => {
    const slugRecord = await scriptSlugRepository.getPublicBySlug(slug);
    if (!slugRecord) return null;
    const script = await scriptRepository.getPublicScriptById(slugRecord.scriptId);
    if (!script) return null;
    const version = Array.isArray(script.versions) ? script.versions[0] : null;
    const commentCount = await scriptCommentRepository.countByScript(script.id);
    script.commentCount = commentCount;
    return toScriptWithVersion(script, version);
  },

  listVersions: async(scriptId, userId) => {
    const script = await scriptRepository.getById(Number(scriptId));
    if (!script || script.userId !== userId) return null;
    const rows = await scriptVersionRepository.listSummaryByScriptId(script.id);
    return rows.map((v) => ({ versionNumber: v.versionNumber, createdAt: v.createdAt }));
  },

  restoreVersion: async(scriptId, versionNumber, userId) => {
    const script = await scriptRepository.getById(Number(scriptId));
    if (!script || script.userId !== userId) return null;

    const result = await prisma.$transaction(async(tx) => {
      const target = await tx.scriptVersion.findFirst({
        where: { scriptId: script.id, versionNumber }
      });
      if (!target) return null;

      const latest = await tx.scriptVersion.findFirst({
        where: { scriptId: script.id },
        orderBy: { versionNumber: 'desc' }
      });
      if (!latest) return null;

      const contentSame = normalizeContentForCompare(target.content) === normalizeContentForCompare(latest.content);
      if (contentSame) {
        return { version: latest, fromVersion: versionNumber, toVersion: latest.versionNumber };
      }

      const nextVersionNumber = latest.versionNumber + 1;
      const newVersion = await tx.scriptVersion.create({
        data: {
          scriptId: script.id,
          versionNumber: nextVersionNumber,
          content: target.content
        }
      });

      await tx.scriptCommand.create({
        data: {
          scriptId: script.id,
          type: 'restore_version',
          payload: { fromVersion: versionNumber, toVersion: nextVersionNumber },
          author: 'user'
        }
      });

      return { version: newVersion, fromVersion: versionNumber, toVersion: nextVersionNumber };
    });

    if (!result) return null;

    const scriptWithVersion = toScriptWithVersion(script, result.version);
    return {
      script: scriptWithVersion,
      fromVersion: result.fromVersion,
      toVersion: result.toVersion
    };
  },

  clonePublicScriptByPublicId: async({ publicId, targetUserId, versionNumber } = {}) => {
    const normalizedUserId = Number(targetUserId);
    if (!publicId || !Number.isFinite(normalizedUserId) || normalizedUserId <= 0) {
      return null;
    }

    const result = await prisma.$transaction(async(tx) => {
      const sourceScript = await tx.script.findFirst({
        where: {
          publicId,
          visibility: 'public'
        }
      });
      if (!sourceScript) {
        return null;
      }

      const normalizedVersion = Number.isFinite(Number(versionNumber)) && Number(versionNumber) > 0
        ? Math.floor(Number(versionNumber))
        : null;

      const sourceVersion = normalizedVersion
        ? await tx.scriptVersion.findFirst({
            where: {
              scriptId: sourceScript.id,
              versionNumber: normalizedVersion
            }
          })
        : await tx.scriptVersion.findFirst({
            where: { scriptId: sourceScript.id },
            orderBy: { versionNumber: 'desc' }
          });

      if (!sourceVersion) {
        return null;
      }

      const cloneTitle = await generateUniqueCloneTitle({
        userId: normalizedUserId,
        sourceTitle: sourceScript.title,
        client: tx
      });

      const slug = await generateUniqueSlug({
        title: cloneTitle,
        isTaken: async(candidate) => {
          return await scriptSlugRepository.existsSlugForUser({
            userId: normalizedUserId,
            slug: candidate
          }, tx);
        }
      });

      const createdScript = await tx.script.create({
        data: {
          userId: normalizedUserId,
          title: cloneTitle,
          author: sourceScript.author || null,
          description: sourceScript.description || null,
          status: sourceScript.status || 'draft',
          visibility: 'private',
          slug,
          publicId: null
        }
      });

      await tx.scriptSlug.create({
        data: {
          userId: normalizedUserId,
          scriptId: createdScript.id,
          slug,
          isCanonical: true
        }
      });

      const createdVersion = await tx.scriptVersion.create({
        data: {
          scriptId: createdScript.id,
          versionNumber: 1,
          content: sourceVersion.content || ''
        }
      });

      await tx.scriptCommand.create({
        data: {
          scriptId: createdScript.id,
          type: 'clone_script',
          payload: {
            sourceScriptId: sourceScript.id,
            sourcePublicId: sourceScript.publicId,
            sourceVersionNumber: sourceVersion.versionNumber
          },
          author: 'user'
        }
      });

      return {
        script: createdScript,
        version: createdVersion
      };
    });

    if (!result) {
      return null;
    }

    return toScriptWithVersion(result.script, result.version);
  }
};

export default scriptModel;
