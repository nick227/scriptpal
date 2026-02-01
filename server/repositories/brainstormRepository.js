import prisma from '../db/prismaClient.js';

const boardSelect = {
  id: true,
  userId: true,
  title: true,
  seed: true,
  createdAt: true,
  updatedAt: true
};

const noteSelect = {
  id: true,
  boardId: true,
  category: true,
  content: true,
  createdAt: true
};

const brainstormRepository = {
  listByUser: async(userId) => {
    return prisma.brainstormBoard.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: boardSelect
    });
  },

  getByIdForUser: async(id, userId) => {
    return prisma.brainstormBoard.findFirst({
      where: { id, userId },
      select: {
        ...boardSelect,
        notes: {
          orderBy: { createdAt: 'asc' },
          select: noteSelect
        }
      }
    });
  },

  createForUser: async({ userId, title, seed, notes }) => {
    return prisma.brainstormBoard.create({
      data: {
        userId,
        title,
        seed,
        notes: {
          create: notes
        }
      },
      select: {
        ...boardSelect,
        notes: {
          orderBy: { createdAt: 'asc' },
          select: noteSelect
        }
      }
    });
  },

  updateForUser: async({ id, userId, title, seed, notes }) => {
    const board = await prisma.brainstormBoard.findFirst({
      where: { id, userId },
      select: boardSelect
    });
    if (!board) {
      return null;
    }

    await prisma.$transaction(async(tx) => {
      await tx.brainstormBoard.update({
        where: { id },
        data: { seed, title }
      });
      await tx.brainstormNote.deleteMany({
        where: { boardId: id }
      });
      if (notes.length) {
        await tx.brainstormNote.createMany({
          data: notes.map(note => ({
            boardId: id,
            category: note.category,
            content: note.content
          }))
        });
      }
    });

    return prisma.brainstormBoard.findFirst({
      where: { id, userId },
      select: {
        ...boardSelect,
        notes: {
          orderBy: { createdAt: 'asc' },
          select: noteSelect
        }
      }
    });
  },

  deleteForUser: async({ id, userId }) => {
    const board = await prisma.brainstormBoard.findFirst({
      where: { id, userId },
      select: { id: true }
    });
    if (!board) {
      return false;
    }

    await prisma.$transaction(async(tx) => {
      await tx.brainstormNote.deleteMany({
        where: { boardId: id }
      });
      await tx.brainstormBoard.delete({
        where: { id }
      });
    });

    return true;
  }
};

export default brainstormRepository;
