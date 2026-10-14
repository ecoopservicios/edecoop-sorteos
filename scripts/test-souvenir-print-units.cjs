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
  const rows = Array.from({ length: 25 }, (_, i) => ({ id: String(i), listNumber: 125 + i, firstName: 'ANA', lastName: 'PÉREZ ' + i, displayDocumentId: '***-*******-*', documentId: null, employeeNumber: String(12000 + i), companyId: 'test', companyName: 'EDESUR', office: 'Sector Baní', unit: i % 2 ? 'COMERCIAL' : 'OPERACIONES', approximateLocation: i < 22 ? 'Sector Baní' : i < 24 ? 'Oficina Central' : null }));
  const { souvenirPrintSheets } = load('lib/souvenir-print.ts');
  const sheets = souvenirPrintSheets(rows);
  assert(sheets.every(sheet => new Set(sheet.members.map(m => m.approximateLocation)).size === 1));
  assert.deepEqual(sheets.flatMap(sheet => sheet.members.map(m => m.listNumber)), rows.map(m => m.listNumber));
  assert.equal(sheets[0].location, 'Sector Baní');
  assert.equal(sheets.find(s => s.location === 'Oficina Central').total, 2);
  const { compareSouvenirMembers } = load('lib/souvenir-order.ts');
  const example = [
    { id: 'emp10', companyName: 'EDESUR', approximateLocation: 'A', employeeNumber: '10', documentId: null },
    { id: 'doc2', companyName: 'EDESUR', approximateLocation: 'A', employeeNumber: null, documentId: '00000000002' },
    { id: 'other', companyName: 'DATACAMPO', approximateLocation: 'A', employeeNumber: '1', documentId: null },
    { id: 'emp2', companyName: 'EDESUR', approximateLocation: 'A', employeeNumber: '2', documentId: null },
    { id: 'doc1', companyName: 'EDESUR', approximateLocation: 'A', employeeNumber: null, documentId: '00000000001' }
  ];
  assert.deepEqual(example.sort(compareSouvenirMembers).map(r => r.id), ['emp2', 'emp10', 'doc1', 'doc2', 'other']);
  const { compareSouvenirLocations } = load('lib/souvenir-order.ts');
  const locations = [null, 'AZUA', 'SANTO DOMINGO - FERIA', 'SANTO DOMINGO - TORRE CRISTAL', ' santo domingo-torre serrano '];
  assert.deepEqual(locations.sort(compareSouvenirLocations), [' santo domingo-torre serrano ', 'SANTO DOMINGO - TORRE CRISTAL', 'SANTO DOMINGO - FERIA', 'AZUA', null]);
  const companiesFirst = [
    { ...example[0], id: 'other-serrano', companyName: 'DATACAMPO', approximateLocation: 'SANTO DOMINGO - TORRE SERRANO' },
    { ...example[0], id: 'edesur-azua', approximateLocation: 'AZUA' },
    { ...example[0], id: 'edesur-cristal', approximateLocation: 'SANTO DOMINGO - TORRE CRISTAL' },
    { ...example[0], id: 'edesur-serrano', approximateLocation: 'SANTO DOMINGO - TORRE SERRANO' }
  ];
  assert.deepEqual(companiesFirst.sort(compareSouvenirMembers).map(r => r.id), ['edesur-serrano', 'edesur-cristal', 'edesur-azua', 'other-serrano']);
  const { createSouvenirLocationPdf, createSouvenirListPdf } = load('lib/souvenir-print-pdf.ts');
  const bytes = await createSouvenirLocationPdf('Sector Baní', rows.slice(0, 22));
  const document = await PDFDocument.load(bytes);
  assert.equal(document.getPageCount(), 1);
  assert(document.getPages().every(page => page.getWidth() === 792 && page.getHeight() === 612));
  const mergedBytes = await createSouvenirListPdf([
    { location: 'Otra ubicación', members: rows.slice(21, 24).map(m => ({ ...m, listNumber: m.listNumber + 100, companyName: 'OTRA EMPRESA' })) },
    { location: 'Sector Baní', members: rows.slice(0, 22) },
    { location: 'Oficina Central', members: rows.slice(22, 24) },
    { location: 'SIN UBICACIÓN ASIGNADA', members: rows.slice(24) }
  ]);
  const merged = await PDFDocument.load(mergedBytes);
  assert.equal(merged.getPageCount(), 4);
  fs.writeFileSync('outputs/souvenir-combined-test.pdf', mergedBytes);
  const compactRows = Array.from({ length: 101 }, (_, i) => ({ ...rows[0], id: 'compact-' + i, listNumber: i + 1, employeeNumber: String(300 + i), firstName: 'FRANCISCO ALBERTO', lastName: 'DE LOS SANTOS RODRIGUEZ GARCIA', approximateLocation: 'SANTO DOMINGO - TORRE SERRANO' }));
  const compactPdf = await createSouvenirLocationPdf(compactRows[0].approximateLocation, compactRows);
  assert.equal((await PDFDocument.load(compactPdf)).getPageCount(), 3);
  assert.deepEqual(souvenirPrintSheets(compactRows).map(s => s.members.length), [50, 50, 1]);
  fs.writeFileSync('outputs/souvenir-50-rows-test.pdf', compactPdf);
  console.log('PASS: locations start on new pages in one PDF; company, numeric employee and fallback ID ordering.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
