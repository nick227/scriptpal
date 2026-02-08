import prisma from '../db/prismaClient.js';

const scriptSlugRepository = {
  create: async({ userId, scriptId, slug, isCanonical = true }, client = prisma) => {
    return await client.scriptSlug.create({
      data: {
        userId,
        scriptId,
        slug,
        isCanonical
      }
    });
  },

  /** Ensure a slug row for this user/script/slug is canonical. Reuse existing row if present (avoids unique constraint on userId+slug). */
  ensureCanonical: async({ userId, scriptId, slug }, client = prisma) => {
    const existing = await client.scriptSlug.findFirst({
      where: { userId, scriptId, slug }
    });
    if (existing) {
      return await client.scriptSlug.update({
        where: { id: existing.id },
        data: { isCanonical: true }
      });
    }
    return await client.scriptSlug.create({
      data: { userId, scriptId, slug, isCanonical: true }
    });
  },

  getBySlugForUser: async(userId, slug, client = prisma) => {
    if (!userId || !slug) return null;
    return await client.scriptSlug.findFirst({
      where: {
        userId,
        slug
      }
    });
  },

  getPublicBySlug: async(slug, client = prisma) => {
    if (!slug) return null;
    return await client.scriptSlug.findFirst({
      where: {
        slug,
        script: {
          visibility: 'public'
        }
      }
    });
  },

  getCanonicalByScriptId: async(scriptId, client = prisma) => {
    if (!scriptId) return null;
    return await client.scriptSlug.findFirst({
      where: {
        scriptId,
        isCanonical: true
      }
    });
  },

  deactivateCanonical: async(scriptId, client = prisma) => {
    if (!scriptId) return 0;
    return await client.scriptSlug.updateMany({
      where: {
        scriptId,
        isCanonical: true
      },
      data: {
        isCanonical: false
      }
    });
  },

  existsSlugForUser: async({ userId, slug, excludeScriptId } = {}, client = prisma) => {
    if (!userId || !slug) return false;
    const where = {
      userId,
      slug
    };
    if (Number.isFinite(excludeScriptId) && excludeScriptId > 0) {
      where.scriptId = { not: excludeScriptId };
    }
    const count = await client.scriptSlug.count({ where });
    return count > 0;
  },

  existsPublicSlug: async({ slug, excludeScriptId } = {}, client = prisma) => {
    if (!slug) return false;
    const where = {
      slug,
      script: {
        visibility: 'public'
      }
    };
    if (Number.isFinite(excludeScriptId) && excludeScriptId > 0) {
      where.scriptId = { not: excludeScriptId };
    }
    const count = await client.scriptSlug.count({ where });
    return count > 0;
  },

  countPublicBySlug: async(slug, client = prisma) => {
    if (!slug) return 0;
    return await client.scriptSlug.count({
      where: {
        slug,
        script: {
          visibility: 'public'
        }
      }
    });
  }
};

export default scriptSlugRepository;
