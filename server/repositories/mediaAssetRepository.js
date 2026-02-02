import prisma from '../db/prismaClient.js';

const mediaAssetRepository = {
  create: async(data) => {
    return prisma.mediaAsset.create({ data });
  },

  updateById: async(id, data) => {
    return prisma.mediaAsset.update({
      where: { id },
      data
    });
  },

  getByIdForUser: async(id, userId) => {
    return prisma.mediaAsset.findFirst({
      where: {
        id,
        userId,
        deletedAt: null
      }
    });
  },

  listByUser: async({ userId, type, page = 1, pageSize = 20 }) => {
    const normalizedPage = Number.isInteger(page) && page > 0 ? page : 1;
    const normalizedPageSize = Number.isInteger(pageSize) && pageSize > 0 ? pageSize : 20;
    const offset = (normalizedPage - 1) * normalizedPageSize;

    const where = {
      userId,
      deletedAt: null,
      ...(type ? { type } : {})
    };

    const assetsPromise = prisma.mediaAsset.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { variants: true },
      skip: offset,
      take: normalizedPageSize
    });

    const totalPromise = prisma.mediaAsset.count({ where });

    const [assets, total] = await prisma.$transaction([assetsPromise, totalPromise]);

    return {
      assets,
      total,
      page: normalizedPage,
      pageSize: normalizedPageSize
    };
  }
};

export default mediaAssetRepository;
