import prisma from '../db/prismaClient.js';

const scriptSelect = {
  id: true,
  userId: true,
  title: true,
  author: true,
  description: true,
  slug: true,
  status: true,
  visibility: true,
  createdAt: true,
  updatedAt: true
};

const scriptRepository = {
  create: async({ userId, title, status, author, description, visibility }) => {
    return await prisma.script.create({
      data: {
        userId,
        title,
        status,
        author,
        description,
        visibility
      }
    });
  },

  getById: async(id) => {
    return await prisma.script.findUnique({
      where: { id },
      select: scriptSelect
    });
  },

  getBySlugForUser: async(userId, slug) => {
    if (!userId || !slug) return null;
    return await prisma.script.findFirst({
      where: {
        userId,
        slug
      },
      select: scriptSelect
    });
  },

  getPublicScriptBySlug: async(slug) => {
    if (!slug) return null;
    return await prisma.script.findFirst({
      where: {
        slug,
        visibility: 'public'
      },
      include: {
        user: {
          select: {
            id: true,
            email: true
          }
        },
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
  },

  getPublicSlugById: async(id) => {
    if (!id) return null;
    return await prisma.script.findFirst({
      where: {
        id,
        visibility: 'public'
      },
      select: {
        id: true,
        slug: true
      }
    });
  },

  getSlugByIdForUser: async(id, userId) => {
    if (!id || !userId) return null;
    return await prisma.script.findFirst({
      where: {
        id,
        userId
      },
      select: {
        id: true,
        slug: true
      }
    });
  },

  getByUserId: async(userId) => {
    return await prisma.script.findMany({
      where: { userId },
      select: scriptSelect
    });
  },

  existsSlugForUser: async(userId, slug) => {
    if (!userId || !slug) return false;
    const count = await prisma.script.count({
      where: {
        userId,
        slug
      }
    });
    return count > 0;
  },

  existsPublicSlug: async(slug) => {
    if (!slug) return false;
    const count = await prisma.script.count({
      where: {
        slug,
        visibility: 'public'
      }
    });
    return count > 0;
  },

  updateMetadata: async(id, { title, status, author, description }) => {
    return await prisma.script.update({
      where: { id },
      data: {
        title,
        status,
        author,
        description
      }
    });
  },

  getPublicScripts: async({ page = 1, pageSize = 10, sortBy = 'updatedAt', sortOrder = 'desc' } = {}) => {
    const allowedSortFields = new Set(['createdAt', 'updatedAt', 'title']);
    const sanitizedSortBy = allowedSortFields.has(sortBy) ? sortBy : 'updatedAt';
    const sanitizedSortOrder = sortOrder === 'asc' ? 'asc' : 'desc';
    const normalizedPageSize = Number.isInteger(pageSize) && pageSize > 0 ? pageSize : 10;
    const normalizedPage = Number.isInteger(page) && page > 0 ? page : 1;

    const offset = (normalizedPage - 1) * normalizedPageSize;

    const scriptsPromise = prisma.script.findMany({
      where: { visibility: 'public' },
      include: {
        user: {
          select: {
            id: true,
            email: true
          }
        },
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1,
          select: {
            versionNumber: true,
            createdAt: true
          }
        }
      },
      orderBy: {
        [sanitizedSortBy]: sanitizedSortOrder
      },
      skip: offset,
      take: normalizedPageSize
    });

    const totalPromise = prisma.script.count({
      where: { visibility: 'public' }
    });

    const [scripts, total] = await prisma.$transaction([scriptsPromise, totalPromise]);

    return {
      scripts,
      total,
      page: normalizedPage,
      pageSize: normalizedPageSize
    };
  },

  getPublicScriptById: async(id) => {
    if (!id) return null;
    return await prisma.script.findFirst({
      where: {
        id,
        visibility: 'public'
      },
      include: {
        user: {
          select: {
            id: true,
            email: true
          }
        },
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
  }
};

export default scriptRepository;
