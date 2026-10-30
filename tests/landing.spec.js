import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { teacherSession } from './authenticated-fixture.js';

async function mockAuth(page, { empty = false, failSignIn = false, admin = false } = {}) {
  const session = teacherSession();
  const state = { classroom: empty ? null : { id: 'private-class', name: 'Private class', goal: 1200, theme: 'sunshine', decorations: [] }, students: empty ? [] : [{ id: 'private-student', name: 'Private Student', plant: 'rose', points: 180 }], activities: [] };
  const control = { state, calls: [], failSignIn, unexpected: [] };
  await page.route(/https:\/\/[^/]+\.supabase\.co\//, async route => {
    const url = new URL(route.request().url());
    if(url.pathname === '/auth/v1/token') {
      if (url.searchParams.get('grant_type') === 'refresh_token' && control.refreshGate) {
        control.refreshStarted = true;
        await control.refreshGate;
      }
      return route.fulfill(control.failSignIn ? { status: 400, json: { error: 'invalid_grant', error_description: 'Invalid login credentials' } } : { json: session });
    }
    if(url.pathname === '/auth/v1/signup') return route.fulfill({ json: { user: session.user, session: null } });
    if(url.pathname === '/auth/v1/user') return route.fulfill({ json: session.user });
    if(url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204 });
    control.unexpected.push(url.pathname);
    return route.fulfill({ status: 500, json: { error: 'Unexpected mocked auth operation' } });
  });
  await page.route('**/api/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    control.calls.push({ method: request.method(), path, token: request.headers().authorization });
    expect(request.headers().authorization).toBe(`Bearer ${session.access_token}`);
    if (path === '/api/account') return route.fulfill(control.rejectSession ? { status: 401, json: { error: 'Your session expired. Sign in again.' } } : { json: { id: session.user.id, email: session.user.email, name: 'Teacher', role: admin ? 'admin' : 'teacher', status: 'active', canManageAccounts: admin } });
    if (path === '/api/admin/users' && admin) return route.fulfill({ json: { users: [], page: 1, hasMore: false } });
    if (path === '/api/classroom' && request.method() === 'GET') return route.fulfill(control.rejectSession ? { status: 401, json: { error: 'Your session expired. Sign in again.' } } : { json: state });
    if (path === '/api/classrooms' && request.method() === 'GET') return route.fulfill({ json: state.classroom ? [state.classroom] : [] });
    if (path === '/api/classrooms' && request.method() === 'POST') {
      state.classroom = { ...request.postDataJSON(), id: 'new-private-class' };
      return route.fulfill({ status: 201, json: state.classroom });
    }
    control.unexpected.push(`${request.method()} ${path}`);
    return route.fulfill({ status: 500, json: { error: 'Unexpected mocked classroom operation' } });
  });
  return control;
}

async function signIn(page) {
  await page.getByRole('button', { name: 'Sign in', exact: true }).first().click();
  await page.getByLabel('Teacher email').fill('teacher@example.test');
  await page.getByLabel('Password', { exact: true }).fill('synthetic-test-password');
  await page.getByRole('button', { name: 'Open my classroom', exact: true }).click();
}

async function assertPublic(page) {
  await expect(page.getByRole('button', { name: 'Sign in', exact: true }).first()).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toHaveCount(0);
  await expect(page.locator('.student-grid, .growth-board, .plant-spot, .class-switch')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Try demo|Demo garden|Use demo/ })).toHaveCount(0);
  await expect(page.getByText('Private Student', { exact: true })).toHaveCount(0);
}

test('public landing stays responsive and cannot expose classrooms via old demo storage or hashes', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const control = await mockAuth(page);
  await page.addInitScript(() => localStorage.setItem('sprout-classroom-v1', JSON.stringify({ classroom: { id: 'demo', name: 'Old private demo', goal: 1000, theme: 'sunshine', decorations: [] }, students: [{ id: 'old', name: 'Old private student', plant: 'rose', points: 880 }], activities: [] })));
  await page.goto('/#students');
  for (const size of [{ width: 1440, height: 1000 }, { width: 768, height: 1024 }, { width: 390, height: 844 }, { width: 320, height: 640 }]) {
    await page.setViewportSize(size);
    await assertPublic(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await expect(page.getByText('Old private student', { exact: true })).toHaveCount(0);
  await page.evaluate(() => { location.hash = 'garden'; });
  await assertPublic(page);
  await page.reload();
  await assertPublic(page);
  expect(control.calls).toEqual([]);
  await page.getByRole('group', { name: 'Choose an illustration plant' }).getByRole('button', { name: 'Rose', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Choose an illustration plant' }).getByRole('button', { name: 'Rose', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByLabel('Plant growth illustration').fill('180');
  await page.getByRole('button', { name: 'Show moonlight illustration', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Show moonlight illustration', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const summary = page.locator('details summary').first();
  await summary.click();
  await expect(page.locator('details').first()).toHaveAttribute('open', '');
  await mkdir('.local/screenshots', { recursive: true });
  await page.screenshot({ path: '.local/screenshots/landing-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: '.local/screenshots/landing-desktop.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('public registration is removed and sign-in errors keep the dashboard protected', async ({ page }) => {
  const control = await mockAuth(page, { failSignIn: true });
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Create.*account|Start your class garden/ })).toHaveCount(0);
  const trigger = page.getByRole('button', { name: 'Open your class garden', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: 'Create account', exact: true })).toHaveCount(0);
  await page.getByLabel('Teacher email').fill('teacher@example.test');
  await page.getByLabel('Password', { exact: true }).fill('synthetic-test-password');
  await page.getByRole('button', { name: 'Open my classroom', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Invalid login credentials');
  await page.getByRole('button', { name: 'Close dialog', exact: true }).focus();
  await page.keyboard.press('Shift+Tab');
  expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await assertPublic(page);
  expect(control.calls).toEqual([]);
  expect(control.unexpected).toEqual([]);
});

test('sign-in opens only the owned classroom, reload restores it, and sign-out returns home', async ({ page }) => {
  const control = await mockAuth(page);
  await page.goto('/');
  await signIn(page);
  await expect(page.locator('.class-switch')).toHaveText('Private class');
  await expect(page.getByRole('button', { name: 'Private Student, Rose, 180 points. Give points.', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator('.class-switch')).toHaveText('Private class');
  await page.getByRole('button', { name: 'My account', exact: true }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await assertPublic(page);
  await page.reload();
  await assertPublic(page);
  expect(control.unexpected).toEqual([]);
});

test('a new account creates an empty first classroom instead of receiving demo students', async ({ page }) => {
  const control = await mockAuth(page, { empty: true });
  await page.goto('/');
  await signIn(page);
  await expect(page.getByRole('heading', { name: 'Your classroom starts here.', exact: true })).toBeVisible();
  await expect(page.locator('.plant-spot')).toHaveCount(0);
  await page.getByRole('button', { name: 'Create your first class', exact: true }).click();
  await page.getByLabel('New class name').fill('Our first garden');
  await page.getByRole('button', { name: 'Create class', exact: true }).click();
  await expect(page.locator('.class-switch')).toHaveText('Our first garden');
  await expect(page.getByRole('button', { name: 'Add your first student', exact: true })).toBeVisible();
  expect(control.state.students).toHaveLength(0);
  expect(control.unexpected).toEqual([]);
});


test('restoring an expired session never flashes a classroom before authentication finishes', async ({ page }) => {
  const control = await mockAuth(page);
  await page.goto('/');
  await signIn(page);
  await expect(page.locator('.class-switch')).toHaveText('Private class');
  await page.evaluate(() => {
    const key = Object.keys(localStorage).find(key => /^sb-.*-auth-token$/.test(key));
    const saved = JSON.parse(localStorage.getItem(key));
    saved.expires_at = Math.floor(Date.now() / 1000) - 60;
    const parts = saved.access_token.split('.');
    const payload = JSON.parse(atob(parts[1].replaceAll('-', '+').replaceAll('_', '/')));
    payload.exp = saved.expires_at;
    parts[1] = btoa(JSON.stringify(payload)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
    saved.access_token = parts.join('.');
    localStorage.setItem(key, JSON.stringify(saved));
  });
  let release;
  control.refreshGate = new Promise(resolve => { release = resolve; });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect.poll(() => Boolean(control.refreshStarted)).toBe(true);
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toHaveCount(0);
  await expect(page.locator('.plant-spot')).toHaveCount(0);
  release();
  await expect(page.locator('.class-switch')).toHaveText('Private class');
  expect(control.unexpected).toEqual([]);
});

test('a rejected session returns to the public landing without a demo fallback', async ({ page }) => {
  const control = await mockAuth(page);
  control.rejectSession = true;
  await page.goto('/');
  await signIn(page);
  await assertPublic(page);
  await expect(page.locator('.plant-spot')).toHaveCount(0);
  expect(control.calls.length).toBeGreaterThan(0);
  expect(control.unexpected).toEqual([]);
});

test('the discreet heart requires a double click and supports keyboard and focus restoration', async ({ page }) => {
  await mockAuth(page);
  await page.goto('/');
  const heart = page.getByRole('button', { name: 'Administrator sign-in', exact: true });
  await expect(heart).toHaveText('');
  await heart.click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.waitForTimeout(500);
  await heart.click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Sign in', exact: true }).focus();
  await heart.dblclick();
  await expect(page.getByRole('dialog')).toHaveAccessibleName('Welcome back, administrator');
  await expect(page.getByLabel('Administrator email', { exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(heart).toBeFocused();
  await heart.click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toHaveAccessibleName('Welcome back, administrator');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveAccessibleName('A home for your classroom');
});

test('the hidden form rejects teacher credentials without publishing a session', async ({ page }) => {
  const control = await mockAuth(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Administrator sign-in', exact: true }).dblclick();
  await page.getByLabel('Administrator email').fill('teacher@example.test');
  await page.getByLabel('Password', { exact: true }).fill('synthetic-test-password');
  await page.getByRole('button', { name: 'Open administration', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('does not have administrator access');
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toHaveCount(0);
  expect(control.calls.map(call => call.path)).toEqual(['/api/account']);
  expect(await page.evaluate(() => Object.keys(localStorage).some(key => /^sb-.*-auth-token$/.test(key) || key.startsWith('sprout-admin-sign-in')))).toBe(false);
  await expect(page.getByRole('button', { name: 'Open administration', exact: true })).toBeEnabled();
  await page.keyboard.press('Escape');
  await signIn(page);
  await expect(page.locator('.class-switch')).toHaveText('Private class');
  expect(control.unexpected).toEqual([]);
});

test('administrator sign-in from the heart verifies permissions before opening administration', async ({ page }) => {
  const control = await mockAuth(page, { admin: true, failSignIn: true });
  await page.goto('/');
  await page.getByRole('button', { name: 'Administrator sign-in', exact: true }).dblclick();
  await page.getByLabel('Administrator email').fill('teacher@example.test');
  await page.getByLabel('Password', { exact: true }).fill('synthetic-test-password');
  await page.getByRole('button', { name: 'Open administration', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Invalid login credentials');
  control.failSignIn = false;
  await page.getByRole('button', { name: 'Open administration', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Account management', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Account management', exact: true })).toBeVisible();
  expect(control.unexpected).toEqual([]);
});

test.describe('hidden admin entry on touch screens', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test('two heart taps open the admin form without zoom or overflow', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/');
    const heart = page.getByRole('button', { name: 'Administrator sign-in', exact: true });
    await heart.tap();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await heart.tap();
    await expect(page.getByRole('dialog')).toHaveAccessibleName('Welcome back, administrator');
    expect(await page.evaluate(() => visualViewport.scale)).toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: '.local/screenshots/hidden-admin-mobile.png', fullPage: true, animations: 'disabled' });
  });
});
