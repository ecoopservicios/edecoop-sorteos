const assert = require('node:assert/strict');
const crypto = require('node:crypto');
require('@next/env').loadEnvConfig(process.cwd());
const { PrismaClient } = require('@prisma/client');
const { chromium } = require('playwright');
const { selectFilter } = require('./test-filter-helper.cjs');
const db = new PrismaClient();
const base = 'http://localhost:3002';
const stamp = crypto.randomUUID();
const users = [];
let company, browser;
async function main() {
  assert(['localhost', '127.0.0.1'].includes(new URL(process.env.DATABASE_URL).hostname));
  try {
    const form = await db.enrollmentForm.findFirst(); assert(form);
    company = await db.enrollmentCompany.create({ data: { formId: form.id, name: 'REFRESCO ' + stamp, dataUpdateLookupField: 'EMPLOYEE_NUMBER' } });
    const add = i => db.souvenirMember.create({ data: { enrollmentCompanyId: company.id, firstName: 'REFRESCO ' + stamp, lastName: String(i), employeeNumber: '999' + Date.now() + i, office: 'OFICINA REFRESCO' } });
    await add(1);
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const pages = [];
    const documents = [0, 0];
    for (let i = 0; i < 2; i++) {
      const user = await db.user.create({ data: { name: 'Prueba refresco ' + i, email: `refresh-${stamp}-${i}@example.invalid`, passwordHash: 'test-only', role: 'ADMIN' } }); users.push(user);
      const body = Buffer.from(JSON.stringify({ userId: user.id, expiresAt: Date.now() + 600000 })).toString('base64url');
      const cookie = body + '.' + crypto.createHmac('sha256', process.env.AUTH_SECRET || 'edecoop-dev-secret-change-me').update(body).digest('base64url');
      const context = await browser.newContext({ viewport: { width: i ? 390 : 1280, height: 900 } });
      await context.addCookies([{ name: 'edecoop_session', value: cookie, url: base }]);
      const page = await context.newPage(); pages.push(page);
      await page.goto(base + '/entrega-souvenir/' + (i ? 'estado' : 'listado'));
      await selectFilter(page, 'Empresa', [company.id]);
      await selectFilter(page, 'Oficina', ['OFICINA REFRESCO']);
      await page.getByLabel('Buscar socio', { exact: true }).fill('REFRESCO');
      await page.getByRole('heading', { name: 'Detalle de socios (1)', exact: true }).waitFor();
      page.on('request', request => { if (request.isNavigationRequest() && request.resourceType() === 'document') documents[i]++; });
    }
    await add(2);
    await pages[0].getByRole('button', { name: 'Actualizar datos', exact: true }).click();
    try { await pages[0].getByRole('heading', { name: 'Detalle de socios (2)', exact: true }).waitFor(); }
    catch (error) { await pages[0].screenshot({ path: 'outputs/refresh-debug.png', fullPage: true }); throw error; }
    await pages[1].getByRole('heading', { name: 'Detalle de socios (2)', exact: true }).waitFor({ timeout: 22000 });
    await add(3);
    for (const page of pages) {
      await page.getByRole('heading', { name: 'Detalle de socios (3)', exact: true }).waitFor({ timeout: 22000 });
      assert.equal(await page.getByLabel('Buscar socio', { exact: true }).inputValue(), 'REFRESCO');
      assert((await page.getByRole('button', { name: 'Empresa', exact: true }).innerText()).includes(company.name));
      assert((await page.getByRole('button', { name: 'Oficina', exact: true }).innerText()).includes('OFICINA REFRESCO'));
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    }
    assert.deepEqual(documents, [0, 0]);
    await pages[1].screenshot({ path: 'outputs/data-refresh-mobile.png' });
    await pages[0].goto(base + '/entrega-souvenir/imprimir');
    await selectFilter(pages[0], 'Empresa', [company.id]);
    assert.equal(await pages[0].locator('tbody tr').count(), 3);
    await add(4);
    await pages[0].getByRole('button', { name: 'Actualizar datos', exact: true }).click();
    await pages[0].locator('tbody tr').nth(3).waitFor();
    assert.equal(await pages[0].locator('tbody tr').count(), 4);
    console.log('PASS: manual and 15-second refresh in two user sessions, server and client data updated, filters/search retained, no document reloads, mobile layout.');
  } finally {
    if (browser) await browser.close();
    if (company) { await db.souvenirMember.deleteMany({ where: { enrollmentCompanyId: company.id } }); await db.enrollmentCompany.delete({ where: { id: company.id } }); }
    for (const user of users) await db.user.delete({ where: { id: user.id } });
    await db.$disconnect();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
