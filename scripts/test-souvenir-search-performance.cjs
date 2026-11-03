const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const { PrismaClient } = require('@prisma/client');
const { chromium } = require('playwright');
process.loadEnvFile('.env');
const base = process.env.TEST_BASE_URL || 'http://localhost:3004';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname) || !['localhost', '127.0.0.1'].includes(new URL(process.env.DATABASE_URL).hostname)) throw Error('Local test only');
const db = new PrismaClient();
const sign = value => crypto.createHmac('sha256', process.env.AUTH_SECRET || 'edecoop-dev-secret-change-me').update(value).digest('base64url');
(async () => {
  let browser;
  try {
    const admin = await db.user.findFirstOrThrow({ where: { role: 'ADMIN', isActive: true, mustChangePassword: false } });
    const company = await db.enrollmentCompany.findFirstOrThrow({ where: { name: 'EDESUR', isActive: true, deletedAt: null, dataUpdateLookupField: 'EMPLOYEE_NUMBER' } });
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    for (const width of [1366, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const body = Buffer.from(JSON.stringify({ userId: admin.id, expiresAt: Date.now() + 3600000 })).toString('base64url');
      const session = `${body}.${sign(body)}`;
      await context.addCookies([{ name: 'edecoop_session', value: session, url: base }, { name: 'edecoop_document_entry', value: sign(`document-entry:${session}`), url: base }]);
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const members = Array.from({ length: 2200 }, (_, i) => ({ id: `qa-${i}`, listNumber: i + 1, firstName: 'SOCIO', lastName: `PRUEBA ${i}`, employeeNumber: String(i + 10000), displayDocumentId: null, sex: null, office: 'OFICINA', unit: null, approximateLocation: 'SANTO DOMINGO', organizationalDirection: null, physicalListPage: null, souvenirDelivery: i % 2 ? { deliveredAt: '2026-10-23T16:00:00.000Z', deliveredBy: { name: 'Admin QA' }, collectedByOther: false, collectorName: null, collectorEmployeeNumber: null } : null }));
      let lookups = [];
      await page.route('**/api/souvenir?**', async route => {
        if (route.request().method() !== 'GET') return route.abort();
        const url = new URL(route.request().url());
        if (url.searchParams.has('lookup')) {
          const lookup = url.searchParams.get('lookup');
          lookups.push(lookup);
          if (lookup === '99999') return route.fulfill({ status: 404, json: { error: 'No se encontró el socio.' } });
          return route.fulfill({ json: { member: members.find(m => m.employeeNumber === lookup) } });
        }
        return route.fulfill({ json: { members, total: members.length, delivered: 1100, pending: 1100 } });
      });
      await page.goto(`${base}/entrega-souvenir`);
      await page.getByRole('button', { name: 'Entregar Souvenir', exact: true }).click();
      await page.getByRole('dialog', { name: 'Seleccionar empresa' }).getByRole('combobox').selectOption(company.id);
      await page.getByRole('button', { name: 'Continuar', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Buscar socio', exact: true });
      const input = dialog.getByLabel('Número de empleado', { exact: true });
      await dialog.getByRole('button', { name: 'Buscar', exact: true }).waitFor({ state: 'visible' });
      await page.waitForFunction(() => !document.querySelector('dialog[open] button[type="submit"]')?.disabled);
      await page.waitForTimeout(500);
      await input.fill('12A-34');
      assert.equal(await input.inputValue(), '1234');
      await input.fill('');
      const start = Date.now();
      await input.pressSequentially('10000', { delay: 20 });
      const typingMs = Date.now() - start;
      assert.equal(await input.inputValue(), '10000');
      assert.equal(lookups.length, 0);
      await input.press('Enter');
      await page.getByRole('dialog', { name: 'Confirmar entrega', exact: true }).waitFor();
      assert.deepEqual(lookups, ['10000']);
      await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
      assert.equal(await input.inputValue(), '');
      await input.fill('99999');
      await input.press('Enter');
      await dialog.getByRole('alert').waitFor();
      await input.fill('10002');
      assert.equal(await dialog.getByRole('alert').count(), 0);
      await input.press('Enter');
      await page.getByRole('dialog', { name: 'Confirmar entrega', exact: true }).waitFor();
      fs.mkdirSync('tmp/souvenir-search', { recursive: true });
      await page.screenshot({ path: `tmp/souvenir-search/${width}.png`, fullPage: true });
      assert.deepEqual(errors, []);
      console.log(JSON.stringify({ width, members: members.length, typingMs, requestsWhileTyping: 0, submitted: lookups }));
      if (process.env.ASSERT_FAST === '1') assert.ok(typingMs < 1500, `Typing took ${typingMs}ms`);
      await context.close();
    }
  } finally { await browser?.close(); await db.$disconnect(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
