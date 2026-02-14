import prisma from '../db/prismaClient.js';
import userModel from '../models/user.js';

const run = async() => {
  const users = await prisma.user.findMany({
    where: {
      deletedAt: null,
      OR: [
        { username: null },
        { usernameNormalized: null }
      ]
    },
    select: { id: true }
  });

  let updated = 0;
  for (const user of users) {
    await userModel.ensureUsername(user.id);
    updated += 1;
  }

  console.log(`[backfillUsernames] Updated ${updated} user(s)`);
};

run()
  .catch((error) => {
    console.error('[backfillUsernames] Failed:', error);
    process.exitCode = 1;
  })
  .finally(async() => {
    await prisma.$disconnect();
  });
