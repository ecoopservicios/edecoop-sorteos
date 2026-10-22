const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const { chromium } = require('playwright');
require('@next/env').loadEnvConfig(process.cwd());
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
const base = process.env.TEST_BASE_URL || 'http://localhost:3002';

function sign(value) {
  return crypto.createHmac('sha256', process.env.AUTH_SECRET || 'edecoop-dev-secret-change-me').update(value).digest('base64url');
}
async function main() {
  let browser, user;
  try {
    assert(['localhost', '127.0.0.1'].includes(new URL(process.env.DATABASE_URL).hostname));
    const password = crypto.randomUUID() + '!';
    user = await db.user.create({ data: { name: 'Prueba ciclo de sesion', email: `session-${crypto.randomUUID()}@example.invalid`, passwordHash: await bcrypt.hash(password, 4), role: 'ADMIN', mustChangePassword: false } });
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const context = await browser.newContext();
    let page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    async function login() {
      await page.goto(base + '/login');
      await page.locator('#username').fill(user.email);
      await page.locator('#password').fill(password);
      await page.getByRole('button', { name: 'Entrar', exact: true }).click();
      await page.waitForURL('**/proyectos');
      await page.getByRole('heading', { name: 'Selecciona un proyecto', exact: true }).waitFor();
    }
    await login();
    const cookies = await context.cookies();
    const cookie = cookies.find(c => c.name === 'edecoop_session');
    assert(cookie.httpOnly);
    assert.equal(cookie.expires, -1);
    assert(!cookies.some(c => c.name === 'edecoop_document_entry'));
    const payload = JSON.parse(Buffer.from(cookie.value.split('.')[0], 'base64url').toString());
    const remaining = payload.expiresAt - Date.now();
    assert(remaining <= 12 * 3600000 && remaining > 12 * 3600000 - 60000);
    await page.getByRole('link', { name: /Souvenir Aniversario/ }).click();
    await page.waitForURL('**/entrega-souvenir');
    await page.getByRole('button', { name: 'Actualizar datos', exact: true }).click();
    await page.waitForTimeout(1000);
    assert(new URL(page.url()).pathname === '/entrega-souvenir');
    const me = await context.request.get(base + '/api/auth/me');
    assert.equal((await me.json()).user.id, user.id);
    const reload = await page.reload();
    await page.waitForURL('**/login?expired=1');
    assert(!(await reload.text()).includes('Entrar a entregas'));
    assert.equal((await (await context.request.get(base + '/api/auth/me')).json()).user, null);
    await login();
    await page.close();
    page = await context.newPage();
    await page.goto(base + '/entrega-souvenir');
    await page.waitForURL('**/login?expired=1');
    await login();
    const popup = await context.newPage();
    await popup.goto(base + '/proyectos');
    await popup.waitForURL('**/login?expired=1');
    await popup.close();

    const expiresAt = Date.now() + 4000;
    const body = Buffer.from(JSON.stringify({ userId: user.id, expiresAt })).toString('base64url');
    const value = body + '.' + sign(body);
    await context.addCookies([
      { name: 'edecoop_session', value, url: base, httpOnly: true },
      { name: 'edecoop_document_entry', value: sign('document-entry:' + value), url: base, httpOnly: true },
    ]);
    await page.goto(base + '/proyectos');
    await page.getByRole('heading', { name: 'Selecciona un proyecto', exact: true }).waitFor();
    await page.waitForURL('**/login?expired=1', { timeout: 15000 });
    const expiredApi = await context.request.get(base + '/api/auth/me');
    assert.equal((await expiredApi.json()).user, null);
    const privateApi = await context.request.get(base + '/api/souvenir/listado?view=estado');
    assert([401, 403].includes(privateApi.status()));
    await context.addCookies([{ name: 'edecoop_session', value: 'not-a-session', url: base, httpOnly: true }]);
    await page.goto(base + '/proyectos');
    await page.waitForURL('**/login?expired=1');
    await page.goto(base + '/actualizar-datos');
    assert.equal(new URL(page.url()).pathname, '/actualizar-datos');
    await db.user.update({ where: { id: user.id }, data: { mustChangePassword: true } });
    await page.goto(base + '/login');
    await page.locator('#username').fill(user.email);
    await page.locator('#password').fill(password);
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await page.waitForURL('**/cambiar-clave');
    const nextPassword = crypto.randomUUID() + '!';
    await page.locator('[name="newPassword"]').fill(nextPassword);
    await page.locator('[name="confirmPassword"]').fill(nextPassword);
    await page.getByRole('button', { name: 'Cambiar contraseña', exact: true }).click();
    await page.waitForURL('**/proyectos');
    assert.equal(errors.length, 0, errors.join('\n'));
    console.log('PASS: login, 12-hour fixed expiry, HttpOnly session cookie, one-use document entry, internal navigation and silent refresh, reload, closed/reopened tab, additional tab, active expiry, API rejection, malformed cookie, public form.');
  } finally {
    if (browser) await browser.close();
    if (user) await db.user.delete({ where: { id: user.id } });
    await db.$disconnect();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
