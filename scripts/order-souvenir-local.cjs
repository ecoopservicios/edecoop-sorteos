const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
require('@next/env').loadEnvConfig(process.cwd());
const { PrismaClient } = require('@prisma/client');

function loadLocalTs(relative) {
  const filename = path.resolve(relative);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = module.paths;
  const originalRequire = loaded.require.bind(loaded);
  loaded.require = name => name === '@/lib/souvenir-order' ? loadLocalTs('lib/souvenir-order.ts') : originalRequire(name);
  loaded._compile(compiled, filename);
  return loaded.exports;
}

async function main() {
  assert(['localhost', '127.0.0.1'].includes(new URL(process.env.DATABASE_URL).hostname), 'Local database only');
  const db = new PrismaClient();
  try {
    await db.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(209831)`;
      await loadLocalTs('lib/souvenir-numbering.ts').resequenceSouvenirList(tx);
    }, { timeout: 60000 });
    const members = await db.souvenirMember.findMany({ include: { enrollmentCompany: { select: { name: true } } }, orderBy: { listNumber: 'asc' } });
    const expected = [...members].map(m => ({ ...m, companyName: m.enrollmentCompany.name })).sort(loadLocalTs('lib/souvenir-order.ts').compareSouvenirMembers);
    assert.deepEqual(members.map(m => m.id), expected.map(m => m.id));
    assert(members.every((m, i) => m.listNumber === i + 1));
    console.log(`PASS: ${members.length} socios numerados por empresa/ubicación/identificación; primera empresa: ${members[0]?.enrollmentCompany.name || '-'}.`);
  } finally { await db.$disconnect(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
