import { test as base, expect } from '@playwright/test';
import { createDemo } from '../src/lib/garden.js';

export { expect };
export const TEACHER_ID = '11111111-1111-4111-8111-111111111111';
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
export function teacherSession() {
  return {
    access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: TEACHER_ID, aud: 'authenticated', role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.synthetic-test-signature`,
    refresh_token: 'synthetic-refresh-token', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: TEACHER_ID, email: 'teacher@example.test', aud: 'authenticated', role: 'authenticated', created_at: new Date().toISOString(), app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {} },
  };
}

// Test-only server: every request is mocked; the production app has no local
// classroom mode. Storage snapshots preserve the preexisting UI test fixtures.
export const test = base.extend({
  page: async ({ page }, use) => {
    const session = teacherSession();
    const unexpected = [];
    let gardens = [];
    let current;
    await page.route(/https:\/\/[^/]+\.supabase\.co\//, route => {
      const url = new URL(route.request().url());
      if (url.pathname === '/auth/v1/token') return route.fulfill({ json: session });
      if (url.pathname === '/auth/v1/user') return route.fulfill({ json: session.user });
      if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204 });
      unexpected.push(url.pathname);
      return route.fulfill({ status: 500, json: { error: 'Unexpected mocked auth operation' } });
    });
    async function snapshot() {
      await page.evaluate(({ gardens, current }) => {
        localStorage.setItem('sprout-classroom-v1', JSON.stringify(current));
        localStorage.setItem('sprout-classrooms-v1', JSON.stringify({ gardens, activeId: current.classroom.id }));
      }, { gardens, current });
    }
    await page.route('**/api/**', async route => {
      const request = route.request(), method = request.method(), path = new URL(request.url()).pathname;
      const body = request.postData() ? request.postDataJSON() : null;
      expect(request.headers().authorization, 'All dashboard requests need the teacher token').toBe(`Bearer ${session.access_token}`);
      if (method === 'GET' && path === '/api/account') return route.fulfill({ json: { id: session.user.id, email: session.user.email, name: 'Teacher', role: 'teacher', status: 'active', canManageAccounts: false } });
      if (!gardens.length) {
        const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('sprout-classroom-v1') || 'null'));
        current = stored || createDemo(); gardens = [current];
      }
      const selectedId = request.headers()['x-classroom-id'];
      if (selectedId) current = gardens.find(garden => garden.classroom.id === selectedId) || current;
      if (method === 'GET' && path === '/api/classroom') {
        // Some layout tests adjust the fixture roster before reloading.
        const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('sprout-classroom-v1') || 'null'));
        if (stored?.classroom.id === current.classroom.id) {
          current = stored; gardens = gardens.map(garden => garden.classroom.id === current.classroom.id ? current : garden);
        }
        await snapshot();
        return route.fulfill({ json: current });
      }
      if (method === 'GET' && path === '/api/classrooms') return route.fulfill({ json: gardens.map(garden => garden.classroom) });
      if (method === 'POST' && path === '/api/classrooms') {
        current = { classroom: { ...body, id: `test-class-${gardens.length + 1}` }, students: [], activities: [] };
        gardens.push(current); await snapshot(); return route.fulfill({ status: 201, json: current.classroom });
      }
      if (method === 'POST' && path === '/api/awards') {
        const selected = body.studentIds === 'all' ? current.students : current.students.filter(student => body.studentIds.includes(student.id));
        const activities = selected.map(student => {
          student.points += body.points;
          return { id: `award-${student.id}-${Date.now()}`, studentId: student.id, studentName: student.name, reason: body.reason, points: body.points, createdAt: new Date().toISOString() };
        });
        current.activities.unshift(...activities); await snapshot(); return route.fulfill({ json: current });
      }
      if (method === 'POST' && path === '/api/students/batch') {
        const students = body.students.map((student, index) => ({ ...student, id: `test-student-${current.students.length + index}`, points: 0 }));
        current.students.push(...students); await snapshot(); return route.fulfill({ status: 201, json: students });
      }
      if (method === 'PATCH' && path === '/api/classroom') {
        Object.assign(current.classroom, body); await snapshot(); return route.fulfill({ json: current.classroom });
      }
      if (path.startsWith('/api/students/')) {
        const id = path.split('/').at(-1), student = current.students.find(student => student.id === id);
        if (method === 'PATCH') { Object.assign(student, body); await snapshot(); return route.fulfill({ json: student }); }
        if (method === 'DELETE') { current.students = current.students.filter(student => student.id !== id); current.activities = current.activities.filter(activity => activity.studentId !== id); await snapshot(); return route.fulfill({ status: 204 }); }
      }
      unexpected.push(`${method} ${path}`);
      return route.fulfill({ status: 500, json: { error: 'Unexpected mocked classroom operation' } });
    });
    const originalGoto = page.goto.bind(page);
    page.goto = async (...args) => {
      const response = await originalGoto(...args);
      await page.getByRole('button', { name: 'Sign in', exact: true }).first().click();
      await page.getByLabel('Teacher email').fill(session.user.email);
      await page.getByLabel('Password', { exact: true }).fill('synthetic-test-password');
      await page.getByRole('button', { name: 'Open my classroom', exact: true }).click();
      await expect(page.getByRole('navigation', { name: 'Main navigation', includeHidden: true })).toBeAttached();
      await expect(page.getByRole('button', { name: 'Add student', exact: true })).toBeEnabled();
      return response;
    };
    await use(page);
    expect(unexpected).toEqual([]);
  },
});
