import prisma from '../db/prismaClient.js';
import scriptRepository from '../repositories/scriptRepository.js';
import { generateUniqueSlug } from '../lib/slug.js';

const backfillSlugs = async() => {
  const scripts = await prisma.script.findMany({
    where: { slug: null },
    select: {
      id: true,
      userId: true,
      title: true,
      visibility: true
    }
  });

  if (!scripts.length) {
    console.log('[BackfillSlugs] No scripts missing slugs.');
    return;
  }

  for (const script of scripts) {
    const visibility = script.visibility || 'private';
    const isTaken = async(candidate) => {
      const takenForUser = await scriptRepository.existsSlugForUser(script.userId, candidate);
      if (takenForUser) return true;
      if (visibility === 'public') {
        return await scriptRepository.existsPublicSlug(candidate);
      }
      return false;
    };

    const slug = await generateUniqueSlug({
      title: script.title,
      isTaken
    });

    await prisma.script.update({
      where: { id: script.id },
      data: { slug }
    });
  }

  console.log(`[BackfillSlugs] Updated ${scripts.length} scripts.`);
};

backfillSlugs()
  .catch((error) => {
    console.error('[BackfillSlugs] Failed:', error);
    process.exit(1);
  })
  .finally(async() => {
    await prisma.$disconnect();
  });
