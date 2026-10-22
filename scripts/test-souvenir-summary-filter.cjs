const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { chromium } = require('playwright');
const XLSX = require('xlsx');
require('@next/env').loadEnvConfig(process.cwd());
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
const base = 'http://localhost:3002';

async function main() {
  let browser;
  try {
    assert(['localhost', '127.0.0.1'].includes(new URL(process.env.DATABASE_URL).hostname));
    const user = await db.user.findFirstOrThrow({ where: { role: 'ADMIN', isActive: true, mustChangePassword: false } });
    const body = Buffer.from(JSON.stringify({ userId: user.id, expiresAt: Date.now() + 600000 })).toString('base64url');
    const cookie = body + '.' + crypto.createHmac('sha256', process.env.AUTH_SECRET || 'edecoop-dev-secret-change-me').update(body).digest('base64url');
    const rows = Array.from({ length: 24 }, (_, i) => ({
      id: 'summary-' + i, listNumber: i + 1, companyId: i < 20 ? 'edesur' : 'test', companyName: i < 20 ? 'EDESUR' : 'PRUEBA',
      firstName: 'SOCIO', lastName: String(i), fullName: 'SOCIO ' + i, employeeNumber: String(1000 + i),
      documentId: null, displayDocumentId: null, office: i % 2 ? 'OFICINA B' : 'OFICINA A', unit: null,
      approximateLocation: 'UBICACION', deliveredAt: i < 20 && i % 2 === 0 ? '2026-10-19T15:00:00Z' : null,
      responsible: 'Prueba', collectedByOther: false, collectorName: null, collectorEmployeeNumber: null,
    }));
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    const documentEntry = crypto.createHmac('sha256', process.env.AUTH_SECRET || 'edecoop-dev-secret-change-me').update('document-entry:' + cookie).digest('base64url');
    async function authorizeDocument() {
      await context.addCookies([{ name: 'edecoop_session', value: cookie, url: base }, { name: 'edecoop_document_entry', value: documentEntry, url: base }]);
    }
    const page = await context.newPage();
    await page.route('**/api/souvenir/listado?*', route => route.fulfill({ json: { members: rows } }));
    for (const view of ['estado', 'listado']) {
      await authorizeDocument();
      await page.goto(base + '/entrega-souvenir/' + view);
      const detail = n => page.getByRole('heading', { name: `Detalle de socios (${n})`, exact: true });
      await detail(24).waitFor();
      const originalSummary = await page.getByRole('table').first().innerText();
      await page.getByRole('button', { name: 'Ver pendientes', exact: true }).click();
      await detail(14).waitFor();
      assert.match(await page.getByRole('button', { name: 'Estado', exact: true }).innerText(), /Todos los estados/);
      assert.equal(await page.getByRole('table').first().innerText(), originalSummary);
      await page.getByRole('button', { name: 'Ver socios', exact: true }).click();
      await detail(24).waitFor();
      await page.getByRole('button', { name: 'Ver entregados', exact: true }).click();
      await detail(10).waitFor();
      await page.getByRole('button', { name: 'Ver socios', exact: true }).click();
      await page.getByRole('button', { name: 'Ver pendientes de EDESUR', exact: true }).click();
      await detail(10).waitFor();
      assert.match(await page.getByRole('button', { name: 'Empresa', exact: true }).innerText(), /Todas las empresas/);
      assert.equal(await page.getByRole('table').first().innerText(), originalSummary);
      await page.getByRole('button', { name: 'Ver todos los socios de EDESUR', exact: true }).click();
      await detail(20).waitFor();
      await page.getByRole('button', { name: 'Ver entregados de EDESUR', exact: true }).click();
      await detail(10).waitFor();
      const download = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Descargar Excel', exact: true }).click();
      const workbook = XLSX.readFile(await (await download).path());
      const exported = XLSX.utils.sheet_to_json(workbook.Sheets.Detalle);
      assert.equal(exported.length, 10);
      assert(exported.every(r => r.Empresa === 'EDESUR' && r.Estado === 'Entregado'));
      assert(!('companyId' in XLSX.utils.sheet_to_json(workbook.Sheets['Resumen por empresa'])[0]));
      await page.getByRole('button', { name: 'Ver todos los socios de EDESUR', exact: true }).click();
      await page.getByRole('button', { name: 'Página siguiente', exact: true }).click();
      await page.getByRole('button', { name: 'Ver porcentaje de entrega de EDESUR', exact: true }).click();
      await detail(10).waitFor();
      assert.equal(await page.getByRole('table').last().locator('tbody tr:not([data-souvenir-group])').count(), 10);
      await authorizeDocument();
      await page.reload();
      await detail(24).waitFor();
      await page.getByRole('button', { name: 'Ver entregados de PRUEBA', exact: true }).click();
      await detail(0).waitFor();
      assert.equal(await page.getByRole('table').first().innerText(), originalSummary);
      await page.getByRole('button', { name: 'Ver socios', exact: true }).click();
      await detail(24).waitFor();
      await page.setViewportSize({ width: 390, height: 844 });
      await page.getByRole('button', { name: 'Ver pendientes de PRUEBA', exact: true }).click();
      await detail(4).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Ver socios', exact: true }).innerText(), '24');
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: `outputs/souvenir-summary-${view}-mobile.png`, fullPage: true });
      await page.setViewportSize({ width: 1366, height: 900 });
      await page.screenshot({ path: `outputs/souvenir-summary-${view}-desktop.png`, fullPage: true });
    }
    console.log('PASS: summary counters, company totals/status/percentage, zero results, pagination reset, filtered Excel and mobile layout in both views. No database changes.');
  } finally {
    if (browser) await browser.close();
    await db.$disconnect();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
