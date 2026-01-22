import prisma from '../db/prismaClient.js';

const userRepository = {
  getById: async(id) => {
    return await prisma.user.findUnique({ where: { id } });
  },

  getByEmail: async(email) => {
    return await prisma.user.findUnique({ where: { email } });
  },

  create: async({ email, passwordHash, passwordSalt }) => {
    return await prisma.user.create({
      data: {
        email,
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
  }
};

export default userRepository;
