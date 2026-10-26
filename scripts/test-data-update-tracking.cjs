const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const { PrismaClient } = require('@prisma/client');
const { chromium } = require('playwright');
process.loadEnvFile('.env');
const base = process.env.TEST_BASE_URL || 'http://localhost:3004';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname) || !['localhost', '127.0.0.1'].includes(new URL(process.env.DATABASE_URL).hostname)) throw Error('Local test only');
const db = new PrismaClient();
const sign = (value) => crypto.createHmac('sha256', process.env.AUTH_SECRET || 'edecoop-dev-secret-change-me').update(value).digest('base64url');
(async () => {
  let browser, company;
  try {
    const admin = await db.user.findFirstOrThrow({ where: { role: 'ADMIN', isActive: true, mustChangePassword: false } });
    const form = await db.enrollmentForm.findFirstOrThrow();
    company = await db.enrollmentCompany.create({ data: { formId: form.id, name: `QA TRACKING ${Date.now()}` } });
    await db.memberDirectory.createMany({ data: Array.from({ length: 129 }, (_, i) => ({ enrollmentCompanyId: company.id, firstName: `PRUEBA ${String(i).padStart(3, '0')}`, lastName: 'SEGUIMIENTO', employeeNumber: String(900000 + i) })) });
    const members = await db.memberDirectory.findMany({ where: { enrollmentCompanyId: company.id }, orderBy: { employeeNumber: 'asc' } });
    await db.memberDataUpdateSubmission.createMany({ data: members.slice(0, 101).map((member) => ({ memberDirectoryId: member.id, enrollmentCompanyId: company.id, lookupField: 'EMPLOYEE_NUMBER', lookupValue: member.employeeNumber, personalPhone: '8095550100', whatsappPhone: '', personalEmail: 'qa@example.com', emergencyContactName: 'PRUEBA CONTACTO', emergencyContactPhone: '8095550101', emergencyContactRelation: 'FAMILIAR', phoneValidationStatus: 'NEW', whatsappValidationStatus: 'NEW', emailValidationStatus: 'NEW' })) });
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    for (const width of [1366, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const body = Buffer.from(JSON.stringify({ userId: admin.id, expiresAt: Date.now() + 3600000 })).toString('base64url');
      const session = `${body}.${sign(body)}`;
      await context.addCookies([{ name: 'edecoop_session', value: session, url: base }, { name: 'edecoop_document_entry', value: sign(`document-entry:${session}`), url: base }]);
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(`${base}/actualizacion-datos`);
      await page.getByRole('heading', { name: 'Avance por empresa' }).waitFor();
      await page.getByRole('button', { name: 'Empresa', exact: true }).click();
      await page.getByRole('checkbox', { name: company.name, exact: true }).check();
      await page.keyboard.press('Escape');
      const row = page.getByRole('row').filter({ hasText: company.name });
      await row.getByRole('button', { name: '129', exact: true }).waitFor();
      assert.match(await row.innerText(), /101/);
      assert.match(await row.innerText(), /28/);
      fs.mkdirSync('tmp/data-update-tracking', { recursive: true });
      await page.screenshot({ path: `tmp/data-update-tracking/dashboard-${width}.png`, fullPage: true });
      await row.getByRole('button', { name: '129', exact: true }).click();
      const pager = page.getByRole('navigation', { name: 'Paginación del listado' });
      assert.match(await pager.innerText(), /de 129/);
      assert.equal(await page.locator('tbody tr').count(), 25);
      await page.getByRole('spinbutton', { name: 'Número de página' }).fill('6');
      assert.equal(await page.locator('tbody tr').count(), 4);
      await page.getByRole('button', { name: 'Solicitudes recibidas', exact: true }).click();
      assert.match(await pager.innerText(), /de 101/);
      await page.getByRole('combobox', { name: 'Registros por página' }).selectOption('100');
      assert.equal(await page.locator('tbody tr').count(), 100);
      await page.getByRole('button', { name: 'Página siguiente', exact: true }).click();
      assert.equal(await page.locator('tbody tr').count(), 1);
      await page.getByRole('searchbox', { name: 'Buscar socio' }).fill('900000');
      assert.equal(await page.locator('tbody tr').count(), 1);
      assert.match(await pager.innerText(), /de 1/);
      await page.getByRole('searchbox', { name: 'Buscar socio' }).fill('NO EXISTE');
      assert.match(await page.locator('tbody').innerText(), /No hay solicitudes/);
      await page.screenshot({ path: `tmp/data-update-tracking/list-${width}.png`, fullPage: true });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.deepEqual(errors, []);
      await context.close();
    }
    console.log('PASS: desktop/mobile dashboard, 129 members, 101 updates, pagination beyond 100, search, empty state');
  } finally {
    await browser?.close();
    if (company) {
      await db.memberDataUpdateSubmission.deleteMany({ where: { enrollmentCompanyId: company.id } });
      await db.memberDirectory.deleteMany({ where: { enrollmentCompanyId: company.id } });
      await db.enrollmentCompany.delete({ where: { id: company.id } });
    }
    await db.$disconnect();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
