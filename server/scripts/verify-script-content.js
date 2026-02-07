/**
 * One-off: verify what the API layer returns for script 2 (and what's in DB).
 * Run from server: node scripts/verify-script-content.js
 * Or: node --experimental-vm-modules scripts/verify-script-content.js if using ESM.
 */
import scriptModel from '../models/script.js';
import prisma from '../db/prismaClient.js';

const SCRIPT_ID = 2;

async function run() {
  console.log('--- Script by ID (same as GET /script/:id) ---');
  const script = await scriptModel.getScript(SCRIPT_ID);
  if (!script) {
    console.log('Script not found');
    await prisma.$disconnect();
    return;
  }
  const content = script.content || '';
  let lineCount = 0;
  try {
    const parsed = typeof content === 'string' && content.trim().startsWith('{') ? JSON.parse(content) : null;
    lineCount = Array.isArray(parsed?.lines) ? parsed.lines.length : 0;
  } catch (_) {}
  console.log({
    id: script.id,
    versionNumber: script.versionNumber,
    contentLength: content.length,
    lineCount,
    contentPreview: content.length > 120 ? content.slice(0, 120) + '...' : content
  });

  console.log('\n--- All versions for script (DB raw) ---');
  const versions = await prisma.scriptVersion.findMany({
    where: { scriptId: SCRIPT_ID },
    orderBy: { versionNumber: 'desc' },
    take: 5,
    select: { versionNumber: true, createdAt: true }
  });
  for (const v of versions) {
    const row = await prisma.scriptVersion.findFirst({
      where: { scriptId: SCRIPT_ID, versionNumber: v.versionNumber },
      select: { content: true }
    });
    const len = row?.content?.length ?? 0;
    let lines = 0;
    if (row?.content) {
      try {
        const p = JSON.parse(row.content);
        lines = Array.isArray(p?.lines) ? p.lines.length : 0;
      } catch (_) {}
    }
    console.log({ versionNumber: v.versionNumber, contentLength: len, lineCount: lines, createdAt: v.createdAt });
  }

  await prisma.$disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
