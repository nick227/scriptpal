import prisma from '../db/prismaClient.js';

const userId = Number(process.env.SEED_USER_ID);
const title = process.env.SEED_SCRIPT_TITLE;
const content = process.env.SEED_SCRIPT_CONTENT;

if (!Number.isInteger(userId)) {
  throw new Error('SEED_USER_ID is required and must be an integer');
}

if (!title) {
  throw new Error('SEED_SCRIPT_TITLE is required');
}

if (!content) {
  throw new Error('SEED_SCRIPT_CONTENT is required');
}

const run = async() => {
  const result = await prisma.$transaction(async(tx) => {
    const script = await tx.script.create({
      data: {
        userId,
        title
      }
    });

    const version = await tx.scriptVersion.create({
      data: {
        scriptId: script.id,
        versionNumber: 1,
        content
      }
    });

    const command = await tx.scriptCommand.create({
      data: {
        scriptId: script.id,
        type: 'seed_snapshot',
        payload: { versionNumber: 1 },
        author: 'system'
      }
    });

    return { script, version, command };
  });

  console.log('Seeded script, version, command:', {
    scriptId: result.script.id,
    versionId: result.version.id,
    commandId: result.command.id
  });
};

run()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async() => {
    await prisma.$disconnect();
  });
