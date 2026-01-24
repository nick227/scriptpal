import prisma from './server/db/prismaClient.js';
const script = await prisma.script.findUnique({ where: { id: 1 } });
console.log('script visibility:', script.visibility);
await prisma.();
