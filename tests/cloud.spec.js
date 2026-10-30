import { test, expect } from '@playwright/test';

const STORE = 'sprout-classroom-v1';
const TEACHER_ID = '11111111-1111-4111-8111-111111111111';
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const accessToken = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: TEACHER_ID, aud: 'authenticated', role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.synthetic-test-signature`;
const session = {
  access_token: accessToken,
  refresh_token: 'synthetic-refresh-token',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: { id: TEACHER_ID, email: 'teacher@example.test', aud: 'authenticated', role: 'authenticated', created_at: new Date().toISOString(), app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {} },
};

function cloudGarden() {
  return {
    classroom: { id: 'cloud-classroom', name: 'Cloud Garden Class', goal: 500, theme: 'sunshine', decorations: [] },
    students: [
      { id: 'cloud-1', name: 'Cloud Lily', plant: 'tulip', points: 45 },
      { id: 'cloud-2', name: 'Cloud Ben', plant: 'cactus', points: 20 },
    ],
    activities: [],
  };
}

async function mockCloud(page, { failInitialLoad = false } = {}) {
  const control = { state: cloudGarden(), failLoad: failInitialLoad, apiCalls: [], authCalls: [], unexpected: [], errors: [] };
  control.gardens = [control.state];
  page.on('pageerror', error => control.errors.push(error.message));
  // Every Supabase request is fulfilled locally. No auth, email, or database request leaves the browser.
  await page.route(/https:\/\/[^/]+\.supabase\.co\//, async route => {
    const request = route.request();
    const url = new URL(request.url());
    control.authCalls.push({ method: request.method(), path: url.pathname, query: url.search });
    if (url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'password' && request.method() === 'POST') {
      return route.fulfill({ json: session });
    }
    if (url.pathname === '/auth/v1/logout' && request.method() === 'POST') return route.fulfill({ status: 204 });
    if (url.pathname === '/auth/v1/user' && request.method() === 'GET') return route.fulfill({ json: session.user });
    control.unexpected.push(`${request.method()} ${url.pathname}`);
    return route.fulfill({ status: 500, json: { error: 'Unexpected mocked auth operation' } });
  });
  await page.route('**/api/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    const body = request.postData() ? request.postDataJSON() : null;
    const selected = control.gardens.find(g => g.classroom.id === request.headers()['x-classroom-id']);
    if (selected) control.state = selected;
    control.apiCalls.push({ path, method, body, authorization: request.headers().authorization });
    if (path === '/api/account' && method === 'GET') return route.fulfill({ json: { id: session.user.id, email: session.user.email, name: 'Teacher', role: 'teacher', status: 'active', canManageAccounts: false } });
    if (path === '/api/classrooms' && method === 'GET') return route.fulfill({ json: control.gardens.map(g => g.classroom) });
    if (path === '/api/classrooms' && method === 'POST') {
      control.state = { classroom: { ...body, id: `cloud-classroom-${control.gardens.length + 1}` }, students: [], activities: [] };
      control.gardens.push(control.state);
      return route.fulfill({ status: 201, json: control.state.classroom });
    }
    if (path === '/api/classroom' && method === 'GET') {
      if (control.failLoad) return route.fulfill({ status: 503, json: { error: 'Classroom is temporarily unavailable. Please retry.' } });
      return route.fulfill({ json: control.state });
    }
    if (path === '/api/awards' && method === 'POST') {
      if (control.failAward) return route.fulfill({ status: 503, json: { error: 'Watering could not be saved. Please try again.' } });
      control.awardStarted = true;
      const selected = body.studentIds === 'all' ? control.state.students : control.state.students.filter(student => body.studentIds.includes(student.id));
      for (const student of selected) {
        student.points += body.points;
        control.state.activities.unshift({ id: `award-${control.state.activities.length + 1}`, studentId: student.id, studentName: student.name, reason: body.reason, points: body.points, createdAt: new Date().toISOString() });
      }
      if (control.awardGate) await control.awardGate;
      return route.fulfill({ json: control.state });
    }
    if (path === '/api/students/batch' && method === 'POST') {
      const students = body.students.map((student, i) => ({ ...student, id: `new-${control.state.students.length + i}`, points: 0 }));
      control.state.students.push(...students);
      return route.fulfill({ status: 201, json: students });
    }
    if (path.startsWith('/api/students/') && method === 'DELETE') {
      const id = path.split('/').at(-1);
      control.state.students = control.state.students.filter(student => student.id !== id);
      control.state.activities = control.state.activities.filter(activity => activity.studentId !== id);
      return route.fulfill({ status: 204 });
    }
    control.unexpected.push(`${method} ${path}`);
    return route.fulfill({ status: 500, json: { error: 'Unexpected mocked classroom operation' } });
  });
  return control;
}

async function signIn(page) {
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByLabel('Teacher email').fill('teacher@example.test');
  await page.getByLabel('Password', { exact: true }).fill('synthetic-test-password');
  await page.getByRole('button', { name: 'Open my classroom', exact: true }).click();
  await expect(page.getByRole('button', { name: 'My account', exact: true })).toBeVisible();
}

test('signed-in actions use the cloud and bearer token and sign-out hides the classroom', async ({ page }) => {
  const control = await mockCloud(page);
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toHaveCount(0);
  const previousLocalGarden = await page.evaluate(key => localStorage.getItem(key), STORE);

  await signIn(page);
  await expect(page.locator('.class-switch')).toHaveText('Cloud Garden Class');
  await expect(page.locator('.plant-spot')).toHaveCount(2);
  await page.getByRole('button', { name: 'Cloud Lily, Tulip, 45 points. Give points.', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Cloud Lily, Tulip, 55 points. Give points.', exact: true })).toBeVisible();
  expect(control.apiCalls.find(call => call.path === '/api/awards')).toMatchObject({
    method: 'POST', authorization: `Bearer ${accessToken}`, body: { studentIds: ['cloud-1'], points: 10, reason: 'Homework complete' },
  });
  expect(await page.evaluate(key => localStorage.getItem(key), STORE)).toBe(previousLocalGarden);

  await page.getByRole('button', { name: 'Add student', exact: true }).click();
  await page.getByLabel(/Student names/).fill('Cloud Zoe\nCloud Kai');
  await page.getByRole('button', { name: 'Plant a new beginning', exact: true }).click();
  await expect(page.locator('.plant-spot')).toHaveCount(4);
  await expect(page.getByRole('button', { name: 'Cloud Zoe, Sunflower, 0 points. Give points.', exact: true })).toBeVisible();
  expect(control.apiCalls.filter(call => call.path === '/api/students/batch')).toEqual([
    expect.objectContaining({ method: 'POST', body: { students: [{ name: 'Cloud Zoe', plant: 'sunflower' }, { name: 'Cloud Kai', plant: 'sunflower' }] } }),
  ]);

  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: /^Students/ }).click();
  await page.getByRole('button', { name: 'Edit Cloud Ben', exact: true }).click();
  await page.getByRole('button', { name: 'Remove student', exact: true }).click();
  await page.getByRole('dialog', { name: 'Remove Cloud Ben?', exact: true }).getByRole('button', { name: 'Remove student', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.student-card')).toHaveCount(3);
  await expect(page.getByRole('heading', { name: 'Cloud Ben', exact: true })).toHaveCount(0);
  expect(control.apiCalls.some(call => call.method === 'DELETE' && call.path === '/api/students/cloud-2')).toBe(true);
  expect(await page.evaluate(key => localStorage.getItem(key), STORE)).toBe(previousLocalGarden);

  await page.getByRole('button', { name: 'My account', exact: true }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toHaveCount(0);
  await expect(page.locator('.plant-spot')).toHaveCount(0);
  expect(await page.evaluate(key => localStorage.getItem(key), STORE)).toBe(previousLocalGarden);
  expect(control.apiCalls.every(call => call.authorization === `Bearer ${accessToken}`)).toBe(true);
  expect(control.authCalls.filter(call => call.path === '/auth/v1/token')).toHaveLength(1);
  expect(control.authCalls.some(call => call.path === '/auth/v1/logout')).toBe(true);
  expect(control.unexpected).toEqual([]);
  expect(control.errors).toEqual([]);
});

test('a teacher can create and switch cloud classes without mixing their students', async ({ page }) => {
  const control = await mockCloud(page);
  await page.goto('/');
  await signIn(page);
  await expect(page.locator('.class-switch')).toHaveText('Cloud Garden Class');
  await page.getByRole('button', { name: 'Switch or create classroom' }).click();
  await page.getByRole('button', { name: 'Create class', exact: true }).click();
  await page.getByLabel('New class name').fill('Maple Class');
  await page.getByRole('button', { name: 'Create class', exact: true }).click();
  await expect(page.locator('.class-switch')).toHaveText('Maple Class');
  await expect(page.locator('.plant-spot')).toHaveCount(0);
  await page.getByRole('button', { name: 'Add student', exact: true }).click();
  await page.getByLabel(/Student names/).fill('Maple Mia');
  await page.getByRole('button', { name: 'Plant a new beginning' }).click();
  await expect(page.locator('.plant-spot')).toHaveCount(1);
  await page.getByRole('button', { name: 'Switch or create classroom' }).click();
  await page.getByRole('button', { name: 'Open Cloud Garden Class', exact: true }).click();
  await expect(page.locator('.plant-spot')).toHaveCount(2);
  await expect(page.getByRole('button', { name: /^Cloud Lily, Tulip, 45/ })).toBeVisible();
  await page.getByRole('button', { name: 'Switch or create classroom' }).click();
  await page.getByRole('button', { name: 'Open Maple Class', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Maple Mia, Sunflower, 0/ })).toBeVisible();
  expect(control.gardens[0].students).toHaveLength(2);
  expect(control.gardens[1].students).toHaveLength(1);
  expect(control.errors).toEqual([]);
});

test('failed watering does not grow a plant or play a success animation and can be retried', async ({ page }) => {
  const control = await mockCloud(page);
  await page.goto('/');
  await signIn(page);
  control.failAward = true;
  const plant = page.getByRole('button', { name: 'Cloud Lily, Tulip, 45 points. Give points.', exact: true });
  await plant.click();
  await expect(page.getByText('Watering could not be saved. Please try again.')).toBeVisible();
  await expect(plant).toBeEnabled();
  await expect(page.locator('.pouring-can')).toHaveCount(0);
  control.failAward = false;
  await plant.click();
  await expect(page.getByRole('button', { name: 'Cloud Lily, Tulip, 55 points. Give points.', exact: true })).toBeVisible();
  await expect(page.locator('.pouring-can')).toHaveCount(1);
  expect(control.state.students[0].points).toBe(55);
});

test('an initial cloud error prevents edits and Retry recovers the saved classroom', async ({ page }) => {
  const control = await mockCloud(page, { failInitialLoad: true });
  await page.goto('/');
  await signIn(page);
  await expect(page.getByText('Classroom is temporarily unavailable. Please retry.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add student', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Give points', exact: true })).toHaveCount(0);
  await expect(page.locator('.plant-spot')).toHaveCount(0);
  expect(control.apiCalls.every(call => call.method === 'GET')).toBe(true);

  control.failLoad = false;
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.locator('.class-switch')).toHaveText('Cloud Garden Class');
  await expect(page.getByText('Classroom is temporarily unavailable. Please retry.', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add student', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Give points', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Cloud Lily, Tulip, 45 points. Give points.', exact: true })).toBeEnabled();
  expect(control.apiCalls.filter(call => call.path === '/api/classroom').length).toBeGreaterThanOrEqual(2);
  expect(control.apiCalls.every(call => call.authorization === `Bearer ${accessToken}`)).toBe(true);
  expect(control.unexpected).toEqual([]);
  expect(control.errors).toEqual([]);
});

test('a completed cloud deletion stays successful when the next refresh is unavailable', async ({ page }) => {
  const control = await mockCloud(page);
  await page.goto('/');
  await signIn(page);
  await expect(page.locator('.class-switch')).toHaveText('Cloud Garden Class');
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: /^Students/ }).click();
  await page.getByRole('button', { name: 'Edit Cloud Ben', exact: true }).click();
  await page.getByRole('button', { name: 'Remove student', exact: true }).click();
  control.failLoad = true;
  await page.getByRole('dialog', { name: 'Remove Cloud Ben?', exact: true }).getByRole('button', { name: 'Remove student', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Cloud Ben', exact: true })).toHaveCount(0);
  await expect(page.locator('.student-card')).toHaveCount(1);
  expect(control.apiCalls.filter(call => call.method === 'DELETE')).toHaveLength(1);
  expect(control.errors).toEqual([]);
});

test('signing out during an award ignores the late response and allows a new sign-in', async ({ page }) => {
  const control = await mockCloud(page);
  let releaseAward;
  control.awardGate = new Promise(resolve => { releaseAward = resolve; });
  await page.goto('/');
  await signIn(page);
  await page.getByRole('button', { name: 'Cloud Lily, Tulip, 45 points. Give points.', exact: true }).click();
  await expect.poll(() => Boolean(control.awardStarted)).toBe(true);
  await page.evaluate(async () => {
    const { supabase } = await import('/src/lib/supabase.js');
    await supabase.auth.signOut();
  });
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const response = page.waitForResponse('**/api/awards');
  releaseAward();
  await response;
  await expect(page.locator('.class-switch')).toHaveCount(0);
  await expect(page.locator('.plant-spot')).toHaveCount(0);
  await signIn(page);
  await expect(page.locator('.class-switch')).toHaveText('Cloud Garden Class');
  await expect(page.getByRole('button', { name: 'Cloud Lily, Tulip, 55 points. Give points.', exact: true })).toBeEnabled();
  expect(control.apiCalls.filter(call => call.path === '/api/awards')).toHaveLength(1);
  expect(control.errors).toEqual([]);
});
