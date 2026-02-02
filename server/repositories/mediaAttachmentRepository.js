import prisma from '../db/prismaClient.js';

const mediaAttachmentRepository = {
  create: async(data) => {
    return prisma.mediaAttachment.create({ data });
  },

  upsertForOwnerRole: async({ assetId, userId, ownerType, ownerId, role, sortOrder, meta }) => {
    const data = {
      assetId,
      userId,
      ownerType,
      ownerId,
      role,
      ...(sortOrder !== undefined ? { sortOrder } : {}),
      ...(meta !== undefined ? { meta } : {})
    };
    return prisma.mediaAttachment.upsert({
      where: {
        ownerType_ownerId_role: {
          ownerType,
          ownerId,
          role
        }
      },
      create: data,
      update: {
        assetId,
        userId,
        ...(sortOrder !== undefined ? { sortOrder } : {}),
        ...(meta !== undefined ? { meta } : {})
      }
    });
  },

  listByOwner: async({ userId, ownerType, ownerId, role }) => {
    return prisma.mediaAttachment.findMany({
      where: {
        userId,
        ownerType,
        ownerId,
        ...(role ? { role } : {}),
        asset: { is: { deletedAt: null } }
      },
      include: {
        asset: {
          include: { variants: true }
        }
      },
      orderBy: { sortOrder: 'asc' }
    });
  },

  listByOwnerIds: async({ userId, ownerType, ownerIds }) => {
    if (!ownerIds || ownerIds.length === 0) {
      return [];
    }
    return prisma.mediaAttachment.findMany({
      where: {
        userId,
        ownerType,
        ownerId: { in: ownerIds },
        asset: { is: { deletedAt: null } }
      },
      include: {
        asset: {
          include: { variants: true }
        }
      },
      orderBy: { sortOrder: 'asc' }
    });
  },

  listByOwnerIdsPublic: async({ ownerType, ownerIds, role }) => {
    if (!ownerIds || ownerIds.length === 0) {
      return [];
    }
    return prisma.mediaAttachment.findMany({
      where: {
        ownerType,
        ownerId: { in: ownerIds },
        ...(role ? { role } : {}),
        asset: { is: { deletedAt: null } }
      },
      include: {
        asset: {
          include: { variants: true }
        }
      },
      orderBy: { sortOrder: 'asc' }
    });
  }
};

export default mediaAttachmentRepository;
