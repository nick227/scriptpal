import prisma from '../db/prismaClient.js';

const tokenUsageRepository = {
  getTotalsForUser: async (userId) => {
    const rows = await prisma.$queryRaw`
      SELECT
        SUM(prompt_tokens) AS promptTokens,
        SUM(completion_tokens) AS completionTokens,
        SUM(total_tokens) AS totalTokens,
        SUM(cost_usd) AS costUsd,
        MAX(createdAt) AS lastUpdated
      FROM chat_messages
      WHERE userId = ${userId}
    `;

    const row = Array.isArray(rows) ? rows[0] : rows;
    return {
      promptTokens: Number(row?.promptTokens ?? 0),
      completionTokens: Number(row?.completionTokens ?? 0),
      totalTokens: Number(row?.totalTokens ?? 0),
      costUsd: Number(row?.costUsd ?? 0),
      lastUpdated: row?.lastUpdated ? new Date(row.lastUpdated).toISOString() : null
    };
  }
};

export default tokenUsageRepository;
