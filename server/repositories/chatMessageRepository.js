import prisma from '../db/prismaClient.js';

const chatMessageRepository = {
  listByUser: async(userId, scriptId = null, limit = 30, offset = 0) => {
    const where = { userId };
    if (scriptId !== null && scriptId !== undefined) {
      where.scriptId = scriptId;
    }

    return await prisma.chatMessage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    });
  },

  create: async({
    userId,
    scriptId = null,
    role,
    content,
    intent = null,
    metadata = null,
    promptTokens = 0,
    completionTokens = 0,
    totalTokens = 0,
    costUsd = 0
  }) => {
    const metadataValue = metadata === null || metadata === undefined
      ? null
      : (typeof metadata === 'string' ? metadata : JSON.stringify(metadata));
    const normalizedScriptId = scriptId ?? null;
    const normalizedPromptTokens = Number(promptTokens ?? 0);
    const normalizedCompletionTokens = Number(completionTokens ?? 0);
    const normalizedTotalTokens = Number(totalTokens ?? 0);
    const normalizedCostUsd = Number(costUsd ?? 0);

    const insert = prisma.$executeRaw`
      INSERT INTO chat_messages (
        userId,
        scriptId,
        role,
        content,
        intent,
        metadata,
        prompt_tokens,
        completion_tokens,
        total_tokens,
        cost_usd
      ) VALUES (
        ${userId},
        ${normalizedScriptId},
        ${role},
        ${content},
        ${intent},
        ${metadataValue},
        ${normalizedPromptTokens},
        ${normalizedCompletionTokens},
        ${normalizedTotalTokens},
        ${normalizedCostUsd}
      )
    `;

    const [, rows] = await prisma.$transaction([
      insert,
      prisma.$queryRaw`SELECT LAST_INSERT_ID() AS id`
    ]);
    const rawInsertedId = Array.isArray(rows) ? rows[0]?.id : rows?.id ?? null;
    if (rawInsertedId === null || rawInsertedId === undefined) {
      throw new Error('Unable to determine inserted chat message ID');
    }
    const insertedId = Number(rawInsertedId);
    if (Number.isNaN(insertedId)) {
      throw new Error('Unable to parse inserted chat message ID');
    }
    if (!insertedId) {
      throw new Error('Unable to determine inserted chat message ID');
    }
    const saved = await prisma.chatMessage.findUnique({
      where: { id: insertedId }
    });
    return saved;
  },

  clearByUserAndScript: async(userId, scriptId) => {
    const result = await prisma.chatMessage.deleteMany({
      where: { userId, scriptId }
    });
    return result.count > 0;
  }
};

export default chatMessageRepository;
