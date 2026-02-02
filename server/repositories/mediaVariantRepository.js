import prisma from '../db/prismaClient.js';

const mediaVariantRepository = {
  createMany: async(variants) => {
    if (!variants || variants.length === 0) {
      return { count: 0 };
    }
    return prisma.mediaVariant.createMany({
      data: variants
    });
  },

  listByAssetId: async(assetId) => {
    return prisma.mediaVariant.findMany({
      where: { assetId }
    });
  }
};

export default mediaVariantRepository;
