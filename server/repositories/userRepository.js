import prisma from '../db/prismaClient.js';

const userRepository = {
  getById: async(id) => {
    return await prisma.user.findUnique({ where: { id } });
  },

  getByEmail: async(email) => {
    return await prisma.user.findFirst({
      where: {
        email,
        deletedAt: null
      }
    });
  },

  getByNormalizedUsername: async(usernameNormalized) => {
    return await prisma.user.findUnique({ where: { usernameNormalized } });
  },

  create: async({ email, username, usernameNormalized, passwordHash, passwordSalt }) => {
    return await prisma.user.create({
      data: {
        email,
        username,
        usernameNormalized,
        passwordHash,
        passwordSalt
      }
    });
  },

  updateEmail: async(id, email) => {
    return await prisma.user.update({
      where: { id },
      data: { email }
    });
  },

  updateProfile: async(id, { username, usernameNormalized }) => {
    return await prisma.user.update({
      where: { id },
      data: {
        username,
        usernameNormalized
      }
    });
  },

  updatePassword: async(id, { passwordHash, passwordSalt }) => {
    return await prisma.user.update({
      where: { id },
      data: {
        passwordHash,
        passwordSalt
      }
    });
  },

  softDelete: async(id, { deleteReason } = {}) => {
    return await prisma.user.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deleteReason: deleteReason || null
      }
    });
  },

  getPublicProfileByUsername: async(usernameNormalized, { page = 1, pageSize = 12 } = {}) => {
    const normalizedPage = Number.isInteger(page) && page > 0 ? page : 1;
    const normalizedPageSize = Number.isInteger(pageSize) && pageSize > 0 ? pageSize : 12;
    const skip = (normalizedPage - 1) * normalizedPageSize;

    const user = await prisma.user.findFirst({
      where: {
        usernameNormalized,
        deletedAt: null
      },
      select: {
        id: true,
        username: true,
        usernameNormalized: true
      }
    });
    if (!user) {
      return null;
    }

    const [scripts, total] = await prisma.$transaction([
      prisma.script.findMany({
        where: {
          userId: user.id,
          visibility: 'public'
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: normalizedPageSize,
        include: {
          versions: {
            orderBy: { versionNumber: 'desc' },
            take: 1,
            select: {
              versionNumber: true,
              createdAt: true
            }
          }
        }
      }),
      prisma.script.count({
        where: {
          userId: user.id,
          visibility: 'public'
        }
      })
    ]);

    return {
      user,
      scripts,
      total,
      page: normalizedPage,
      pageSize: normalizedPageSize
    };
  }
};

export default userRepository;
