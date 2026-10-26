const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const { chromium } = require('playwright');
require('@next/env').loadEnvConfig(process.cwd());
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
const base = process.env.TEST_BASE_URL || 'http://localhost:3002';

async function main() {
  let browser, company, oldQuestions;
  let settingRead = false;
  try {
    assert(['localhost', '127.0.0.1'].includes(new URL(process.env.DATABASE_URL).hostname));
    assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
    const form = await db.enrollmentForm.findFirstOrThrow();
    company = await db.enrollmentCompany.create({ data: { formId: form.id, name: 'PRUEBA ETAPAS ' + crypto.randomUUID(), dataUpdateEnabled: true, dataUpdateLookupField: 'EMPLOYEE_NUMBER' } });
    const member = await db.memberDirectory.create({ data: { enrollmentCompanyId: company.id, firstName: 'SOCIA', lastName: 'PRUEBA ETAPAS', employeeNumber: '99991', documentId: '00100000001', personalPhone: '8095550000', personalEmail: 'anterior@example.com' } });
    oldQuestions = await db.appSetting.findUnique({ where: { key: 'dataUpdate.questions' } });
    settingRead = true;
    await db.appSetting.upsert({ where: { key: 'dataUpdate.questions' }, create: { key: 'dataUpdate.questions', value: JSON.stringify([{ id: 'custom-zone', fieldKey: 'customZone', label: 'Zona de residencia', type: 'SELECT', section: 'ADDITIONAL', required: true, options: ['NORTE', 'SUR'] }]) }, update: { value: JSON.stringify([{ id: 'custom-zone', fieldKey: 'customZone', label: 'Zona de residencia', type: 'SELECT', section: 'ADDITIONAL', required: true, options: ['NORTE', 'SUR'] }]) } });
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    fs.mkdirSync('tmp/data-update-wizard', { recursive: true });
    for (const viewport of [{ width: 390, height: 844 }, { width: 1366, height: 900 }]) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      let attempts = 0;
      await page.route('**/api/actualizacion-datos/solicitudes', async route => {
        attempts++;
        if (attempts === 1) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Prueba de conexion: reintenta el envio.' }) });
        await new Promise(resolve => setTimeout(resolve, 700));
        return route.continue();
      });
      const heading = title => page.getByRole('heading', { name: title, exact: true });
      const next = () => page.getByRole('button', { name: 'Continuar', exact: true }).click();
      const back = () => page.getByRole('button', { name: 'Atras', exact: true }).click();
      await page.goto(base + '/actualizar-datos');
      await heading('Identificacion').waitFor();
      await page.getByLabel('Empresa', { exact: true }).selectOption(company.id);
      await page.getByLabel('Numero de empleado', { exact: true }).fill('88888');
      await next();
      await page.getByRole('status').filter({ hasText: 'No encontramos' }).waitFor();
      await page.getByLabel('Numero de empleado', { exact: true }).fill('99991');
      await next();
      await heading('Confirma tus datos').waitFor();
      await page.getByRole('button', { name: 'No soy yo', exact: true }).click();
      await heading('Identificacion').waitFor();
      await next();
      await page.getByRole('button', { name: 'Si, soy yo', exact: true }).click();
      await heading('Datos de contacto').waitFor();
      await next();
      assert(await heading('Datos de contacto').isVisible());
      await page.getByLabel('Telefono personal', { exact: false }).first().fill('8095551234');
      await page.getByRole('checkbox').check();
      await page.getByLabel('Correo electronico personal', { exact: false }).fill('prueba@edesur.com.do');
      await next();
      await page.getByText('Ingresa tu correo personal, no el institucional.', { exact: false }).first().waitFor();
      await page.getByLabel('Correo electronico personal', { exact: false }).fill('prueba@example.com');
      await next();
      await heading('Contacto de emergencia').waitFor();
      await back();
      assert.equal(await page.locator('[name=personalPhone]').inputValue(), '8095551234');
      assert.equal(await page.locator('[name=whatsappPhone]').inputValue(), '8095551234');
      await page.locator('[name=personalPhone]').fill('8095551235');
      assert.equal(await page.locator('[name=whatsappPhone]').inputValue(), '8095551235');
      await page.screenshot({ path: `tmp/data-update-wizard/contact-${viewport.width}.png`, fullPage: true });
      await next();
      await page.locator('[name=emergencyContactName]').fill('MARIA PEREZ');
      await page.locator('[name=emergencyContactPhone]').fill('8295551234');
      await page.locator('[name=emergencyContactRelation]').selectOption('FAMILIAR');
      await next();
      await heading('Informacion adicional').waitFor();
      await next();
      assert(await heading('Informacion adicional').isVisible());
      await page.getByLabel('Zona de residencia', { exact: false }).selectOption('SUR');
      await next();
      await heading('Revisa tu actualizacion').waitFor();
      assert.equal(await page.getByRole('progressbar').getAttribute('aria-valuenow'), '6');
      await page.getByRole('button', { name: 'Editar datos de contacto', exact: true }).click();
      await page.locator('[name=personalEmail]').fill('editado@example.com');
      await next(); await next(); await next();
      await heading('Revisa tu actualizacion').waitFor();
      assert(await page.getByText('editado@example.com', { exact: true }).isVisible());
      assert(await page.getByText('SUR', { exact: true }).isVisible());
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: `tmp/data-update-wizard/review-${viewport.width}.png`, fullPage: true });
      await page.getByRole('button', { name: 'Enviar actualizacion', exact: true }).click();
      await page.getByRole('alert').filter({ hasText: 'Prueba de conexion' }).waitFor();
      await page.getByRole('button', { name: 'Enviar actualizacion', exact: true }).evaluate(button => { button.click(); button.click(); });
      await heading('Actualizacion recibida').waitFor();
      assert.equal(attempts, 2);
      assert.deepEqual(errors, []);
      const submissions = await db.memberDataUpdateSubmission.findMany({ where: { memberDirectoryId: member.id }, orderBy: { createdAt: 'desc' } });
      assert.equal(submissions.length, viewport.width === 390 ? 1 : 2);
      assert.equal(submissions[0].personalPhone, '8095551235');
      assert.equal(submissions[0].whatsappPhone, '8095551235');
      assert.equal(submissions[0].personalEmail, 'editado@example.com');
      assert.equal(submissions[0].customResponses.customZone, 'SUR');
      await page.screenshot({ path: `tmp/data-update-wizard/success-${viewport.width}.png`, fullPage: true });
      await context.close();
    }
    await db.appSetting.update({ where: { key: 'dataUpdate.questions' }, data: { value: '[]' } });
    const page = await browser.newPage();
    await page.goto(base + '/actualizar-datos');
    assert.equal(await page.getByRole('progressbar').getAttribute('aria-valuemax'), '5');
    console.log('PASS: mobile/desktop, identification, not found, validation, retained values, WhatsApp, custom questions, review/edit, failed request/retry, single submit, real local API and five/six stages.');
  } finally {
    if (browser) await browser.close();
    if (settingRead) {
      if (oldQuestions) await db.appSetting.upsert({ where: { key: oldQuestions.key }, create: { key: oldQuestions.key, value: oldQuestions.value }, update: { value: oldQuestions.value } });
      else await db.appSetting.deleteMany({ where: { key: 'dataUpdate.questions' } });
    }
    if (company) {
      await db.memberDataUpdateSubmission.deleteMany({ where: { enrollmentCompanyId: company.id } });
      await db.memberDirectory.deleteMany({ where: { enrollmentCompanyId: company.id } });
      await db.enrollmentCompany.delete({ where: { id: company.id } });
    }
    await db.$disconnect();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
