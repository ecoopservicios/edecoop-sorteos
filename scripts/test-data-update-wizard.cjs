const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const { chromium, request } = require('playwright');
require('@next/env').loadEnvConfig(process.cwd());
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
const base = process.env.TEST_BASE_URL || 'http://localhost:3002';
const ratePrefix = 'dataUpdate.rateLimit.';
const sign = value => crypto.createHmac('sha256', process.env.AUTH_SECRET || 'edecoop-dev-secret-change-me').update('data-update:' + value).digest('base64url');
async function main() {
  let browser, oldQuestions;
  const companies = [], members = [], rateKeys = new Set();
  let settingRead = false;
  const ip = '203.0.113.' + (10 + crypto.randomInt(150));
  for (const scope of ['lookup', 'submit']) rateKeys.add(ratePrefix + scope + '.' + sign(ip));
  try {
    assert(['localhost', '127.0.0.1'].includes(new URL(process.env.DATABASE_URL).hostname));
    assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
    const form = await db.enrollmentForm.findFirstOrThrow();
    for (const lookup of ['EMPLOYEE_NUMBER', 'DOCUMENT_ID']) companies.push(await db.enrollmentCompany.create({ data: { formId: form.id, name: 'PRUEBA PREGUNTAS ' + crypto.randomUUID(), dataUpdateEnabled: true, dataUpdateLookupField: lookup } }));
    for (let i = 0; i < 5; i++) members.push(await db.memberDirectory.create({ data: { enrollmentCompanyId: companies[i === 2 ? 1 : 0].id, firstName: 'SOCIA', lastName: 'PRUEBA ' + ['UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO'][i], employeeNumber: String(99990 + i), documentId: '0010000000' + i } }));
    oldQuestions = await db.appSetting.findUnique({ where: { key: 'dataUpdate.questions' } }); settingRead = true;
    const questionValue = JSON.stringify([
      { id: 'custom-zone', fieldKey: 'customZone', label: 'Zona de residencia', type: 'SELECT', section: 'ADDITIONAL', required: true, options: ['NORTE', 'SUR'] },
      { id: 'personalEmail', fieldKey: 'personalEmail', label: 'Correo electronico personal', section: 'CONTACT' },
      { id: 'emergencyContactPhone', fieldKey: 'emergencyContactPhone', label: 'Telefono emergencia', section: 'EMERGENCY' },
      { id: 'emergencyContactRelation', fieldKey: 'emergencyContactRelation', label: 'Relacion', section: 'EMERGENCY' }
    ]);
    await db.appSetting.upsert({ where: { key: 'dataUpdate.questions' }, create: { key: 'dataUpdate.questions', value: questionValue }, update: { value: questionValue } });
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    fs.mkdirSync('tmp/data-update-questions', { recursive: true });
    for (const [index, mode] of ['SAME', 'OTHER', 'NONE'].entries()) {
      const member = members[index];
      const company = companies[index === 2 ? 1 : 0];
      const viewport = index === 1 ? { width: 1366, height: 900 } : { width: 390, height: 844 };
      const context = await browser.newContext({ viewport, extraHTTPHeaders: { 'x-real-ip': ip } });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      let attempts = 0;
      await page.route('**/api/actualizacion-datos/solicitudes', async route => {
        attempts++;
        if (attempts === 1) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Prueba de conexión: reintenta el envio.' }) });
        await new Promise(resolve => setTimeout(resolve, 500));
        return route.continue();
      });
      const heading = title => page.getByRole('heading', { name: title, exact: true });
      const next = () => page.getByRole('button', { name: 'Continuar', exact: true }).click();
      await page.goto(base + '/actualizar-datos');
      await heading('Selecciona tu empresa').waitFor();
      assert.equal(await page.locator('header p').count(), 0);
      assert.equal(await page.locator('[id$="-help"]').count(), 0);
      await heading('Actualización de datos').waitFor();
      assert.equal(await page.locator('form input:visible').count(), 0);
      await page.getByLabel('Empresa', { exact: true }).selectOption(company.id);
      await next();
      const employeeLookup = index !== 2;
      await page.getByLabel(employeeLookup ? 'Número de empleado' : 'Cédula', { exact: true }).fill(employeeLookup ? member.employeeNumber : member.documentId);
      if (employeeLookup) {
        const identityResponse = page.waitForResponse('**/api/actualizacion-datos/buscar');
        await next();
        assert.deepEqual(await (await identityResponse).json(), { requiresDocument: true });
        await heading('Valida tu cédula').waitFor();
        assert(!(await page.locator('body').innerText()).includes(member.lastName));
        await page.getByLabel('Cédula', { exact: true }).fill('00199999999');
        await next();
        await page.getByRole('status').filter({ hasText: 'No encontramos' }).waitFor();
        assert(!(await page.locator('body').innerText()).includes(member.lastName));
        await page.getByLabel('Cédula', { exact: true }).fill(member.documentId);
      }
      await next();
      await heading('Teléfono personal').waitFor();
      assert.equal(await page.getByRole('button', { name: 'Sí, soy yo', exact: true }).count(), 0);
      assert.equal(await heading('Confirma tu nombre').count(), 0);
      assert.equal(await page.locator('[id$="-help"]').count(), 0);
      assert.equal(await page.getByText('Debe contener exactamente 10 números.', { exact: true }).count(), 0);
      assert.equal(await page.locator('form input:visible').count(), 1);
      const identity = page.getByRole('complementary', { name: 'Socio validado' });
      assert((await identity.innerText()).includes(member.documentId));
      assert((await identity.innerText()).includes(member.employeeNumber));
      await next();
      await page.getByRole('alert').filter({ hasText: 'obligatorio' }).waitFor();
      await page.getByLabel('Teléfono personal', { exact: true }).fill('8095551234');
      await next();
      await heading('¿Tu teléfono personal tiene WhatsApp?').waitFor();
      await page.getByRole('button', { name: 'Atrás', exact: true }).click();
      assert.equal(await page.getByLabel('Teléfono personal', { exact: true }).inputValue(), '8095551234');
      await page.getByLabel('Teléfono personal', { exact: true }).fill('8095551235');
      await page.screenshot({ path: 'tmp/data-update-questions/phone-' + viewport.width + '-' + mode + '.png', fullPage: true });
      await next();
      await page.locator('input[name=whatsappMode][value=' + mode + ']').check();
      await next();
      if (mode === 'OTHER') {
        await heading('WhatsApp personal').waitFor();
        await page.getByLabel('WhatsApp personal', { exact: true }).fill('8495551234');
        await next();
      }
      await heading('Correo electrónico personal').waitFor();
      await page.getByLabel('Correo electrónico personal', { exact: true }).fill('prueba@edesur.com.do');
      await next();
      await page.getByRole('alert').filter({ hasText: 'no el institucional' }).waitFor();
      await page.getByLabel('Correo electrónico personal', { exact: true }).fill('prueba@example.com');
      await next();
      await heading('Contacto de emergencia').waitFor();
      assert.equal(await page.locator('form input:visible').count(), 2);
      await next();
      await page.getByRole('alert').filter({ hasText: 'nombre del contacto' }).waitFor();
      await page.getByLabel('Nombre', { exact: true }).fill('MARIA');
      await next();
      await page.getByRole('alert').filter({ hasText: 'apellido del contacto' }).waitFor();
      await page.getByLabel('Apellido', { exact: true }).fill('PEREZ');
      await next();
      await heading('Teléfono de emergencia').waitFor();
      await page.getByRole('button', { name: 'Atrás', exact: true }).click();
      assert.equal(await page.getByLabel('Nombre', { exact: true }).inputValue(), 'MARIA');
      assert.equal(await page.getByLabel('Apellido', { exact: true }).inputValue(), 'PEREZ');
      await page.screenshot({ path: 'tmp/data-update-questions/emergency-' + viewport.width + '-' + mode + '.png', fullPage: true });
      await next();
      await page.getByLabel('Teléfono de emergencia', { exact: true }).fill('8295551234');
      await next();
      await page.getByLabel('Relación', { exact: true }).selectOption('FAMILIAR');
      await next();
      await heading('Zona de residencia').waitFor();
      await page.getByLabel('Zona de residencia', { exact: true }).selectOption('SUR');
      await next();
      await heading('Revisa tu actualización').waitFor();
      await page.getByRole('button', { name: 'Editar contacto de emergencia', exact: true }).click();
      assert.equal(await page.getByLabel('Nombre', { exact: true }).inputValue(), 'MARIA');
      await page.getByLabel('Apellido', { exact: true }).fill('PEREZ GOMEZ');
      await page.getByRole('button', { name: 'Volver al resumen', exact: true }).click();
      await heading('Revisa tu actualización').waitFor();
      assert(await page.getByText('MARIA PEREZ GOMEZ', { exact: true }).isVisible());
      await page.getByRole('button', { name: 'Editar correo electrónico personal', exact: true }).click();
      await page.getByLabel('Correo electrónico personal', { exact: true }).fill('editado@example.com');
      await page.getByRole('button', { name: 'Volver al resumen', exact: true }).click();
      await heading('Revisa tu actualización').waitFor();
      assert(await page.getByText('editado@example.com', { exact: true }).isVisible());
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.waitForFunction(() => {
        const bar = document.querySelector('[role=progressbar]');
        return bar && bar.firstElementChild.getBoundingClientRect().width >= bar.getBoundingClientRect().width - 0.5;
      });
      await page.screenshot({ path: 'tmp/data-update-questions/review-' + viewport.width + '-' + mode + '.png', fullPage: true });
      await page.getByRole('button', { name: 'Enviar actualización', exact: true }).click();
      await page.getByRole('alert').filter({ hasText: 'Prueba de conexión' }).waitFor();
      await page.getByRole('button', { name: 'Enviar actualización', exact: true }).evaluate(button => { button.click(); button.click(); });
      await heading('Actualización recibida').waitFor();
      assert.equal(attempts, 2);
      assert.equal(await page.getByRole('button', { name: 'Continuar', exact: true }).count(), 0);
      assert.equal(await page.locator('form').count(), 0);
      await page.reload();
      await heading('Actualización recibida').waitFor();
      assert.equal(await page.locator('form').count(), 0);
      const submission = await db.memberDataUpdateSubmission.findFirstOrThrow({ where: { memberDirectoryId: member.id } });
      assert.equal(await db.memberDataUpdateSubmission.count({ where: { memberDirectoryId: member.id } }), 1);
      assert.equal(submission.whatsappPhone, mode === 'NONE' ? '' : mode === 'SAME' ? '8095551235' : '8495551234');
      assert.equal(submission.customResponses.whatsappPreference, mode);
      assert.equal(submission.customResponses.customZone, 'SUR');
      assert.equal(submission.emergencyContactName, 'MARIA PEREZ GOMEZ');
      assert.equal(submission.customResponses.emergencyContactFirstName, 'MARIA');
      assert.equal(submission.customResponses.emergencyContactLastName, 'PEREZ GOMEZ');
      assert.deepEqual(errors, []);
      const cookies = await context.cookies();
      assert(cookies.find(c => c.name === 'edecoop_data_update_receipt')?.httpOnly);
      await context.close();
    }
    const api = await request.newContext({ extraHTTPHeaders: { 'x-real-ip': ip } });
    const target = members[3];
    const lookupData = { enrollmentCompanyId: companies[0].id, lookupValue: target.employeeNumber, documentId: target.documentId };
    const verified = await api.post(base + '/api/actualizacion-datos/buscar', { data: lookupData });
    const identity = await verified.json();
    assert(identity.verificationToken);
    assert.equal(identity.member.personalPhone, undefined);
    const payload = { memberDirectoryId: target.id, lookupValue: target.employeeNumber, verificationToken: identity.verificationToken, personalPhone: '8095551234', whatsappMode: 'NONE', personalEmail: 'prueba@example.com', emergencyContactName: 'NOMBRE IGNORADO', emergencyContactFirstName: 'MARIA', emergencyContactLastName: 'PEREZ', emergencyContactPhone: '8295551234', emergencyContactRelation: 'FAMILIAR', customResponses: { customZone: 'SUR' } };
    const invalid = await api.post(base + '/api/actualizacion-datos/solicitudes', { data: { ...payload, verificationToken: identity.verificationToken + 'x' } });
    assert.equal(invalid.status(), 403);
    const wrongMember = await api.post(base + '/api/actualizacion-datos/solicitudes', { data: { ...payload, memberDirectoryId: members[4].id, lookupValue: members[4].employeeNumber } });
    assert.equal(wrongMember.status(), 403);
    const unsafeWhatsapp = await api.post(base + '/api/actualizacion-datos/solicitudes', { data: { ...payload, whatsappMode: 'OTHER', whatsappPhone: '123' } });
    assert.equal(unsafeWhatsapp.status(), 422);
    const missingLastName = await api.post(base + '/api/actualizacion-datos/solicitudes', { data: { ...payload, emergencyContactLastName: '' } });
    assert.equal(missingLastName.status(), 422);
    const results = await Promise.all([api.post(base + '/api/actualizacion-datos/solicitudes', { data: payload }), api.post(base + '/api/actualizacion-datos/solicitudes', { data: payload })]);
    assert.deepEqual(results.map(r => r.status()).sort(), [200, 409]);
    assert.equal(await db.memberDataUpdateSubmission.count({ where: { memberDirectoryId: target.id } }), 1);
    assert.equal((await db.memberDataUpdateSubmission.findFirstOrThrow({ where: { memberDirectoryId: target.id } })).emergencyContactName, 'MARIA PEREZ');
    const fresh = await request.newContext({ extraHTTPHeaders: { 'x-real-ip': ip } });
    const duplicateLookup = await fresh.post(base + '/api/actualizacion-datos/buscar', { data: lookupData });
    assert.equal(duplicateLookup.status(), 409);
    const rateKey = ratePrefix + 'lookup.' + sign(ip);
    await db.appSetting.update({ where: { key: rateKey }, data: { value: JSON.stringify({ count: 120, resetAt: Date.now() + 60000 }) } });
    const limited = await fresh.post(base + '/api/actualizacion-datos/buscar', { data: lookupData, headers: { 'x-forwarded-for': '8.8.8.8' } });
    assert.equal(limited.status(), 429);
    assert(Number(limited.headers()['retry-after']) > 0);
    await api.dispose(); await fresh.dispose();
    console.log('PASS: one question at a time, mobile/desktop, employee + cedula validation, cedula lookup, identity retained, three WhatsApp modes, editing, retry/double click, persistent completion, signed proof, wrong-member rejection, concurrent deduplication and durable IP rate limit.');
  } finally {
    if (browser) await browser.close();
    if (settingRead) {
      if (oldQuestions) await db.appSetting.upsert({ where: { key: oldQuestions.key }, create: { key: oldQuestions.key, value: oldQuestions.value }, update: { value: oldQuestions.value } });
      else await db.appSetting.deleteMany({ where: { key: 'dataUpdate.questions' } });
    }
    if (companies.length) {
      const ids = companies.map(c => c.id);
      const submissions = await db.memberDataUpdateSubmission.findMany({ where: { enrollmentCompanyId: { in: ids } }, select: { id: true } });
      await db.auditLog.deleteMany({ where: { entityType: 'MemberDataUpdateSubmission', entityId: { in: submissions.map(s => s.id) } } });
      await db.memberDataUpdateSubmission.deleteMany({ where: { enrollmentCompanyId: { in: ids } } });
      await db.memberDirectory.deleteMany({ where: { enrollmentCompanyId: { in: ids } } });
      await db.enrollmentCompany.deleteMany({ where: { id: { in: ids } } });
    }
    await db.appSetting.deleteMany({ where: { key: { in: [...rateKeys] } } });
    await db.$disconnect();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
