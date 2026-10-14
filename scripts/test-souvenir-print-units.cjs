const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { PDFDocument } = require('pdf-lib');

function load(relative) {
  const filename = path.resolve(relative), loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  const original = loaded.require.bind(loaded);
  loaded.require = name => name.startsWith('@/lib/') ? load(name.replace('@/', '') + '.ts') : original(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText, filename);
  return loaded.exports;
}

async function main() {
  const rows = Array.from({ length: 25 }, (_, i) => ({ id: String(i), listNumber: 125 + i, firstName: 'ANA', lastName: `PÉREZ ${i}`, displayDocumentId: '***-*******-*', employeeNumber: String(12000 + i), companyId: 'test', companyName: 'EDESUR', office: 'Sector Baní', unit: i < 22 ? 'COMERCIAL' : i < 24 ? 'OPERACIONES' : null }));
  const { souvenirPrintSheets } = load('lib/souvenir-print.ts');
  const sheets = souvenirPrintSheets(rows);
  assert(sheets.every(sheet => new Set(sheet.members.map(m => m.unit)).size === 1));
  assert.deepEqual(sheets.flatMap(sheet => sheet.members.map(m => m.listNumber)), rows.map(m => m.listNumber));
  assert.equal(sheets[0].unit, 'COMERCIAL');
  assert.equal(sheets.find(s => s.unit === 'OPERACIONES').unitTotal, 2);
  const { createSouvenirOfficePdf, createSouvenirListPdf } = load('lib/souvenir-print-pdf.ts');
  const bytes = await createSouvenirOfficePdf('Sector Baní', rows);
  const document = await PDFDocument.load(bytes);
  assert.equal(document.getPageCount(), 5);
  assert(document.getPages().every(page => page.getWidth() === 792 && page.getHeight() === 612));
  fs.writeFileSync('outputs/souvenir-units-test.pdf', bytes);
  const other = await PDFDocument.load(await createSouvenirOfficePdf('Sector Baní', rows.slice(21, 24).map(m => ({ ...m, companyName: 'OTRA EMPRESA' }))));
  assert.equal(other.getPageCount(), 1);
  const mergedBytes = await createSouvenirListPdf([
    { office: 'Otra oficina', members: rows.slice(21, 24).map(m => ({ ...m, listNumber: m.listNumber + 100, companyName: 'OTRA EMPRESA' })) },
    { office: 'Sector Baní', members: rows }
  ]);
  const merged = await PDFDocument.load(mergedBytes);
  assert.equal(merged.getPageCount(), 6);
  fs.writeFileSync('outputs/souvenir-combined-test.pdf', mergedBytes);
  console.log('PASS: EDESUR units start on separate pages, continuous member numbers, 5 landscape pages in one PDF; other companies unchanged.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
