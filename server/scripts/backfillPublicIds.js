import prisma from '../db/prismaClient.js';
import { generatePublicId } from '../lib/id.js';

const createUniquePublicId = async () => {
  let publicId;
  let exists = true;
  while (exists) {
    publicId = generatePublicId();
    const existing = await prisma.script.findUnique({ where: { publicId } });
    exists = Boolean(existing);
  }
  return publicId;
};

const ensureCanonicalSlug = async (script) => {
  if (!script.slug) return;
  const hasCanonical = await prisma.scriptSlug.findFirst({
    where: {
      scriptId: script.id,
      isCanonical: true
    }
  });
  if (!hasCanonical) {
    await prisma.scriptSlug.create({
      data: {
        userId: script.userId,
        scriptId: script.id,
        slug: script.slug,
        isCanonical: true
      }
    });
  }
};

const backfill = async () => {
  console.log('Starting publicId backfill for legacy public scripts...');
  const scripts = await prisma.script.findMany({
    where: {
      visibility: 'public',
      publicId: null
    },
    select: {
      id: true,
      userId: true,
      slug: true
    }
  });

  if (!scripts.length) {
    console.log('No legacy public scripts without publicId found.');
    return;
  }

  for (const script of scripts) {
    const publicId = await createUniquePublicId();
    await ensureCanonicalSlug(script);
    await prisma.script.update({
      where: { id: script.id },
      data: { publicId }
    });
    console.log(`Assigned publicId ${publicId} to script ${script.id}`);
  }

  console.log('Backfill complete.');
};

backfill()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Public ID backfill failed:', error);
    process.exit(1);
  });
