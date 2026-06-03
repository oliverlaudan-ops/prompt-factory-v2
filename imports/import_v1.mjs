import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const args = process.argv.slice(2);
const file = args.find(a => a.endsWith('.json'));
if (!file) { console.error('Usage: node import_v1.mjs [--email=<addr>] [--force] [--dry-run] <file.json>'); process.exit(1); }
const emailArg = args.find(a => a.startsWith('--email='));
const email = emailArg ? emailArg.split('=')[1] : 'oliver.laudan@gmail.com';
const force = args.includes('--force');
const dryRun = args.includes('--dry-run');

const prisma = new PrismaClient();
const backup = JSON.parse(fs.readFileSync(file, 'utf8'));
const v1User = backup.user || {};
const prompts = backup.prompts || [];
console.log(`V1-Backup: ${prompts.length} Prompts, User: ${v1User.email}`);

const user = await prisma.user.findUnique({ where: { email } });
if (!user) { console.error(`User ${email} existiert nicht.`); process.exit(1); }
console.log(`→ v2-User: ${user.id} (${user.email})\n`);

let ins = 0, upd = 0, skip = 0;
for (const p of prompts) {
  const title = (p.title || '').trim();
  if (!title) { console.log(`  SKIP (kein Titel)`); skip++; continue; }
  const existing = await prisma.prompt.findFirst({ where: { userId: user.id, title } });
  const data = {
    userId: user.id,
    title,
    description: p.description || null,
    content: p.content,
    category: p.category || null,
    tags: p.tags || null,
    isFavorite: Boolean(p.isFavorite),
    isPublic: Boolean(p.isPublic),
    createdAt: p.createdAt ? new Date(p.createdAt) : new Date(),
    updatedAt: p.updatedAt ? new Date(p.updatedAt) : new Date(),
  };
  if (existing) {
    if (!force) { console.log(`  SKIP: ${title}`); skip++; continue; }
    if (!dryRun) await prisma.prompt.update({ where: { id: existing.id }, data });
    console.log(`  UPD: ${title}`); upd++;
  } else {
    if (!dryRun) await prisma.prompt.create({ data });
    console.log(`  ADD: ${title}`); ins++;
  }
}
console.log(`\n=== ${ins} inserted, ${upd} updated, ${skip} skipped ===`);
if (dryRun) console.log('(dry-run, nichts geschrieben)');
await prisma.$disconnect();
