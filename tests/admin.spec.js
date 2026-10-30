import { test, expect } from '@playwright/test';
import { teacherSession } from './authenticated-fixture.js';

async function setup(page, { role = 'admin', accessDenied = false, listError = false } = {}) {
  const session = teacherSession();
  session.user.email = role === 'admin' ? 'owner@example.test' : 'teacher@example.test';
  // Deliberately forged user metadata cannot grant access in the browser.
  session.user.user_metadata = { role: 'admin' };
  const control = { users: [
    { id: session.user.id, name: 'Administrator', email: 'owner@example.test', role: 'admin', status: 'active' },
    { id: '22222222-2222-4222-8222-222222222222', name: 'Jamie Teacher', email: 'jamie@example.test', role: 'teacher', status: 'active' },
    { id: '33333333-3333-4333-8333-333333333333', name: 'Alex Teacher', email: 'alex@example.test', role: 'teacher', status: 'pending' },
  ], calls: [], createCount: 0, passwordChanges: [], teacherUpdates: [], listError, accessDenied, errors: [], unexpected: [] };
  page.on('pageerror', error => control.errors.push(error.message));
  await page.route(/https:\/\/[^/]+\.supabase\.co\//, route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/auth/v1/token') return route.fulfill({ json: session });
    if (path === '/auth/v1/user') {
      if (route.request().method() === 'PUT') {
        control.passwordChanges.push(route.request().postDataJSON());
        if (control.passwordError) return route.fulfill({ status: 400, json: { msg: 'Current password is incorrect', code: 'invalid_credentials' } });
      }
      return route.fulfill({ json: session.user });
    }
    if (path === '/auth/v1/logout') return route.fulfill({ status: 204 });
    control.unexpected.push(path); return route.fulfill({ status: 500, json: {} });
  });
  await page.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname, method = request.method();
    expect(request.headers().authorization).toBe(`Bearer ${session.access_token}`);
    control.calls.push(`${method} ${path}`);
    if (path === '/api/account') return route.fulfill(control.accessDenied ? { status: 403, json: { error: 'Your account needs administrator approval.' } } : { json: { id: session.user.id, email: session.user.email, role, status: 'active', canManageAccounts: role === 'admin' } });
    if (path === '/api/classroom') return route.fulfill({ json: { classroom: null, students: [], activities: [] } });
    if (path === '/api/admin/users' && method === 'GET') return route.fulfill(control.listError ? { status: 503, json: { error: 'Accounts temporarily unavailable.' } } : { json: { users: control.users, page: 1, hasMore: false } });
    if (path === '/api/admin/users' && method === 'POST') {
      control.createCount++;
      const body = request.postDataJSON();
      expect(Object.keys(body).sort()).toEqual(['email', 'name', 'password']);
      expect(body.password.length).toBeGreaterThanOrEqual(12);
      if (control.createGate) await control.createGate;
      const user = { id: '44444444-4444-4444-8444-444444444444', name: body.name, email: body.email, role: 'teacher', status: 'active' };
      control.users.push(user); return route.fulfill({ status: 201, json: user });
    }
    if (path.startsWith('/api/admin/users/') && method === 'PATCH') {
      const user = control.users.find(user => user.id === path.split('/').at(-1));
      const { password, ...details } = request.postDataJSON();
      control.teacherUpdates.push({ ...details, ...(password ? { password } : {}) });
      Object.assign(user, details); return route.fulfill({ json: user });
    }
    control.unexpected.push(`${method} ${path}`); return route.fulfill({ status: 500, json: {} });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByLabel('Teacher email').fill(session.user.email);
  await page.getByLabel('Password', { exact: true }).fill('test-password-only');
  await page.getByRole('button', { name: 'Open my classroom', exact: true }).click();
  return control;
}

test('administrator creates one teacher, clears credentials, approves and pauses access', async ({ page }) => {
  const control = await setup(page);
  await expect(page.getByRole('heading', { name: 'Account management', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit Administrator', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Create teacher', exact: true }).click();
  await page.getByLabel('Teacher name', { exact: true }).fill('Morgan Teacher');
  await page.getByLabel('Teacher email', { exact: true }).fill('morgan@example.test');
  await page.getByRole('button', { name: 'Generate password', exact: true }).click();
  const password = await page.getByLabel('Password', { exact: true }).inputValue();
  let release;
  control.createGate = new Promise(resolve => { release = resolve; });
  await page.getByRole('button', { name: 'Create teacher account', exact: true }).click();
  await expect(page.getByRole('button', { name: /Saving/ })).toBeDisabled();
  await page.keyboard.press('Enter');
  expect(control.createCount).toBe(1);
  release();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Edit Morgan Teacher' })).toBeVisible();
  expect(await page.evaluate(value => Object.values(localStorage).some(item => item.includes(value)), password)).toBe(false);
  await page.getByRole('button', { name: 'Approve access for Alex Teacher', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Approve access', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause access for Alex Teacher', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Pause access for Jamie Teacher', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Pause access', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Restore access for Jamie Teacher', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Create teacher', exact: true }).click();
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue('');
  await page.keyboard.press('Escape');
  expect(control.errors).toEqual([]);
  expect(control.unexpected).toEqual([]);
});

test('admin layout, search, and forms fit desktop and small mobile screens', async ({ page }) => {
  const control = await setup(page);
  await expect(page.getByRole('button', { name: 'Edit Jamie Teacher' })).toBeVisible();
  await page.screenshot({ path: '.local/screenshots/admin-desktop.png', fullPage: true, animations: 'disabled' });
  for (const width of [768, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.getByLabel('Search accounts on this page').fill('Alex');
  await expect(page.getByRole('button', { name: 'Edit Jamie Teacher' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Approve access for Alex Teacher' })).toBeVisible();
  await page.getByRole('button', { name: 'Clear account search' }).click();
  await page.screenshot({ path: '.local/screenshots/admin-mobile.png', fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'Create teacher', exact: true }).click();
  await expect(page.getByLabel('Teacher name', { exact: true })).toBeVisible();
  expect(await page.getByRole('dialog').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.screenshot({ path: '.local/screenshots/admin-create-mobile.png', fullPage: true, animations: 'disabled' });
  expect(control.errors).toEqual([]);
});

test('account errors are recoverable without showing fake data', async ({ page }) => {
  const control = await setup(page, { listError: true });
  await expect(page.getByRole('alert')).toContainText('Accounts temporarily unavailable.');
  await expect(page.getByRole('button', { name: 'Create teacher', exact: true })).toBeDisabled();
  control.listError = false;
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Edit Jamie Teacher' })).toBeVisible();
});

test('teacher accounts cannot see administration even with forged user metadata', async ({ page }) => {
  const control = await setup(page, { role: 'teacher' });
  await expect(page.getByRole('button', { name: 'Create your first class', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Administration', exact: true })).toHaveCount(0);
  expect(control.calls.some(call => call.includes('/api/admin'))).toBe(false);
});

test('unapproved accounts see an access message and can sign out', async ({ page }) => {
  const control = await setup(page, { role: 'teacher', accessDenied: true });
  await expect(page.getByRole('status')).toContainText('Your account needs administrator approval.');
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toHaveCount(0);
  expect(control.calls).toEqual(['GET /api/account']);
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
});

for (const role of ['admin', 'teacher']) test(`${role} can change their own password with confirmation and recover from errors`, async ({ page }) => {
  const control = await setup(page, { role });
  await page.getByRole('button', { name: 'My account', exact: true }).click();
  await page.getByRole('button', { name: 'Change password', exact: true }).click();
  await page.getByLabel('Current password', { exact: true }).fill('old-account-password');
  await page.getByLabel('New password', { exact: true }).fill('new-account-password');
  await page.getByLabel('Confirm new password', { exact: true }).fill('does-not-match-yet');
  await page.getByRole('button', { name: 'Save new password', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('do not match');
  expect(control.passwordChanges).toEqual([]);
  await page.getByLabel('Confirm new password', { exact: true }).fill('new-account-password');
  control.passwordError = true;
  await page.getByRole('button', { name: 'Save new password', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Current password is incorrect');
  control.passwordError = false;
  await page.getByRole('button', { name: 'Save new password', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Change password', exact: true })).toBeVisible();
  expect(control.passwordChanges.at(-1)).toMatchObject({ password: 'new-account-password', current_password: 'old-account-password' });
  await page.getByRole('button', { name: 'Change password', exact: true }).click();
  await expect(page.getByLabel('Current password', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('New password', { exact: true })).toHaveValue('');
  await page.setViewportSize({ width: 320, height: 640 });
  expect(await page.getByRole('dialog').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.screenshot({ path: `.local/screenshots/${role}-own-password-mobile.png`, fullPage: true, animations: 'disabled' });
  expect(control.unexpected).toEqual([]);
  expect(control.errors).toEqual([]);
});

test('teacher details optionally resets a password and preserves it for name-only edits', async ({ page }) => {
  const control = await setup(page);
  await page.getByRole('button', { name: 'Edit Jamie Teacher' }).click();
  await page.getByRole('button', { name: 'Save details', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(control.teacherUpdates.at(-1)).toEqual({ name: 'Jamie Teacher' });
  await page.getByRole('button', { name: 'Edit Jamie Teacher' }).click();
  await page.getByRole('button', { name: 'Change password', exact: true }).click();
  await page.getByLabel('New password', { exact: true }).fill('replacement-teacher-password');
  await page.getByLabel('Confirm new password', { exact: true }).fill('different-password');
  await page.getByRole('button', { name: 'Save details', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('do not match');
  expect(control.teacherUpdates).toHaveLength(1);
  await page.getByLabel('Confirm new password', { exact: true }).fill('replacement-teacher-password');
  await page.setViewportSize({ width: 320, height: 640 });
  expect(await page.getByRole('dialog').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.screenshot({ path: '.local/screenshots/teacher-change-password-mobile.png', fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'Save details', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(control.teacherUpdates.at(-1)).toEqual({ name: 'Jamie Teacher', password: 'replacement-teacher-password' });
  expect(control.errors).toEqual([]);
});
