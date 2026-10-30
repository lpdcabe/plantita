import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from './app.js';
import { setupAdministrator } from '../scripts/setup-admin.mjs';

const OWNER = '11111111-1111-4111-8111-111111111111';
const TEACHER = '22222222-2222-4222-8222-222222222222';
const env = { SUPABASE_URL: 'https://test.supabase.co', SUPABASE_ANON_KEY: 'public-key', SUPABASE_SECRET_KEY: 'private-server-key', ADMIN_EMAIL: 'owner@example.test' };
const owner = { id: OWNER, email: env.ADMIN_EMAIL, email_confirmed_at: '2026-10-30T00:00:00Z', user_metadata: { name: 'Owner' } };
const teacher = { id: TEACHER, email: 'teacher@example.test', email_confirmed_at: '2026-10-30T00:00:00Z', user_metadata: { name: 'Teacher' }, app_metadata: { sprout_role: 'teacher', sprout_status: 'active' } };

async function serve({ user = owner, config = env, records = [owner, teacher], createError = null, updateError = null, listData } = {}, run) {
  const calls = [], factories = [];
  const users = records.map(record => structuredClone(record));
  const db = { auth: { getUser: async token => ({ data: { user: token === 'bad-token' ? null : user }, error: null }) } };
  const admin = {
    async listUsers(pagination) { calls.push(['listUsers', pagination]); return { data: listData || { users, total: users.length }, error: null }; },
    async createUser(attributes) { calls.push(['createUser', attributes]); if (createError) return { error: createError }; const newUser = { id: TEACHER, ...attributes, created_at: '2026-10-30T00:00:00Z' }; users.push(newUser); return { data: { user: newUser }, error: null }; },
    async getUserById(id) { calls.push(['getUserById', id]); return { data: { user: users.find(item => item.id === id) || null }, error: null }; },
    async updateUserById(id, attributes) { calls.push(['updateUserById', id, attributes]); if (updateError) return { error: updateError }; const target = users.find(item => item.id === id); Object.assign(target, attributes); return { data: { user: target }, error: null }; },
  };
  const clientFactory = (url, key, options) => { factories.push({ url, key, options }); return key === config.SUPABASE_SECRET_KEY ? { auth: { admin } } : db; };
  const server = createApp({ env: config, clientFactory, staticDirectory: '__none__' }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    await run(async (path, { method = 'GET', body, token = 'user-token' } = {}) => {
      const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
      return { status: response.status, data: await response.json(), retryAfter: response.headers.get('retry-after') };
    }, { calls, factories, users });
  } finally { await new Promise(resolve => server.close(resolve)); }
}

test('account identity uses verified owner email and never user-controlled roles', async () => {
  await serve({}, async (request, { factories }) => {
    const result = await request('/api/account');
    assert.equal(result.status, 200);
    assert.deepEqual(result.data, { id: OWNER, email: owner.email, name: 'Owner', role: 'admin', status: 'active', canManageAccounts: true });
    assert.equal(factories.length, 1);
    assert.equal(factories[0].key, 'public-key');
  });
  await serve({ user: { ...teacher, user_metadata: { role: 'admin', sprout_role: 'admin', email: owner.email } } }, async request => {
    assert.equal((await request('/api/account')).data.canManageAccounts, false);
  });
});

test('unauthenticated, regular teachers, forged roles and unverified owner cannot use admin API', async () => {
  await serve({}, async (request, { factories, calls }) => {
    assert.equal((await request('/api/admin/users', { token: null })).status, 401);
    assert.equal((await request('/api/admin/users', { token: 'bad-token' })).status, 401);
    assert.ok(factories.every(call => call.key === 'public-key'));
    assert.deepEqual(calls, []);
  });
  for (const user of [teacher, { ...teacher, app_metadata: { sprout_role: 'admin', sprout_status: 'active' } }, { ...owner, email_confirmed_at: null }, { ...teacher, user_metadata: { sprout_role: 'admin' } }]) {
    await serve({ user }, async (request, { calls, factories }) => {
      assert.equal((await request('/api/admin/users')).status, 403);
      assert.equal((await request('/api/admin/users', { method: 'POST', body: { name: 'X', email: 'x@example.test', password: 'strong-password' } })).status, 403);
      assert.equal((await request(`/api/admin/users/${TEACHER}`, { method: 'PATCH', body: { status: 'active' } })).status, 403);
      assert.deepEqual(calls, []);
      assert.ok(factories.every(call => call.key === 'public-key'));
    });
  }
});

test('inactive and unapproved accounts cannot use classroom APIs or spoof approval', async () => {
  for (const app_metadata of [{ sprout_role: 'teacher', sprout_status: 'inactive' }, {}, { sprout_role: 'admin', sprout_status: 'active' }]) {
    await serve({ user: { ...teacher, app_metadata, user_metadata: { sprout_role: 'teacher', sprout_status: 'active' } } }, async request => {
      for (const path of ['/api/account', '/api/classroom', '/api/classrooms']) assert.equal((await request(path)).status, 403);
    });
  }
});

test('owner lists only safe account fields with validated pagination and isolated secret client', async () => {
  await serve({ records: [owner, { ...teacher, password: 'never-return', identities: [{ secret: 'no' }], app_metadata: { sprout_role: 'teacher', sprout_status: 'active', private: 'no' } }] }, async (request, { calls, factories }) => {
    const result = await request('/api/admin/users?page=2&perPage=20');
    assert.equal(result.status, 200);
    assert.deepEqual(calls[0], ['listUsers', { page: 2, perPage: 20 }]);
    assert.equal(result.data.page, 2);
    assert.equal(result.data.hasMore, false);
    assert.deepEqual(Object.keys(result.data.users[1]), ['id', 'email', 'name', 'role', 'status', 'createdAt', 'lastSignInAt']);
    assert.equal(factories[1].key, 'private-server-key');
    assert.equal(factories[1].options.global, undefined);
    assert.equal(factories[1].options.auth.persistSession, false);
    assert.equal(factories[0].options.global.headers.Authorization, 'Bearer user-token');
    for (const query of ['page=0', 'page=-1', 'page=2.3', 'perPage=101', 'page=1&page=2', 'page=abc']) assert.equal((await request(`/api/admin/users?${query}`)).status, 400);
  });
});

test('missing private credentials fails only owner provisioning with a clear message', async () => {
  const { SUPABASE_SECRET_KEY: _, ...config } = env;
  await serve({ config }, async (request, { calls }) => {
    assert.equal((await request('/api/account')).status, 200);
    const result = await request('/api/admin/users');
    assert.equal(result.status, 503);
    assert.match(result.data.error, /SUPABASE_SECRET_KEY/);
    assert.deepEqual(calls, []);
  });
});

test('owner creates an approved teacher with no invitation email and no sensitive response', async () => {
  await serve({}, async (request, { calls }) => {
    const result = await request('/api/admin/users', { method: 'POST', body: { name: ' New Teacher ', email: 'NEW@EXAMPLE.TEST ', password: 'a-long-password' } });
    assert.equal(result.status, 201);
    assert.deepEqual(calls[0], ['createUser', { email: 'new@example.test', password: 'a-long-password', email_confirm: true, user_metadata: { name: 'New Teacher' }, app_metadata: { sprout_role: 'teacher', sprout_status: 'active' } }]);
    assert.equal(result.data.role, 'teacher');
    assert.equal(result.data.status, 'active');
    assert.equal(JSON.stringify(result.data).includes('a-long-password'), false);
  });
});

test('invalid provisioning fields and role escalation are rejected before privileged work', async () => {
  const valid = { name: 'Teacher', email: 'teacher@example.test', password: 'a-long-password' };
  await serve({}, async (request, { calls, factories }) => {
    const cases = [null, [], {}, { ...valid, name: ' ' }, { ...valid, name: 'x'.repeat(81) }, { ...valid, email: 'bad' }, { ...valid, password: 'short' }, { ...valid, role: 'admin' }, { ...valid, app_metadata: { sprout_role: 'admin' } }, { ...valid, status: 'active' }];
    for (const body of cases) assert.equal((await request('/api/admin/users', { method: 'POST', body })).status, 400);
    assert.equal((await request('/api/admin/users', { method: 'POST', body: { ...valid, email: owner.email } })).status, 409);
    assert.deepEqual(calls, []);
    assert.ok(factories.every(call => call.key === 'public-key'));
  });
});

test('owner account is protected and account updates preserve unrelated metadata', async () => {
  await serve({ records: [owner, { ...teacher, app_metadata: { ...teacher.app_metadata, provider: 'email' }, user_metadata: { name: 'Teacher', theme: 'sunshine' } }] }, async (request, { calls }) => {
    assert.equal((await request(`/api/admin/users/${OWNER}`, { method: 'PATCH', body: { status: 'inactive' } })).status, 403);
    assert.equal((await request(`/api/admin/users/${TEACHER}`, { method: 'PATCH', body: { role: 'admin' } })).status, 400);
    const result = await request(`/api/admin/users/${TEACHER}`, { method: 'PATCH', body: { name: 'New Name', status: 'inactive' } });
    assert.equal(result.status, 200);
    assert.equal(result.data.status, 'inactive');
    assert.deepEqual(calls[1], ['updateUserById', TEACHER, { user_metadata: { name: 'New Name', theme: 'sunshine' }, app_metadata: { sprout_role: 'teacher', sprout_status: 'inactive', provider: 'email' } }]);
  });
});

test('activation approves a legacy user without deleting classroom data', async () => {
  await serve({ records: [{ ...teacher, app_metadata: {} }] }, async (request, { calls }) => {
    assert.equal((await request('/api/admin/users')).data.users[0].status, 'pending');
    const result = await request(`/api/admin/users/${TEACHER}`, { method: 'PATCH', body: { status: 'active' } });
    assert.equal(result.status, 200);
    assert.equal(result.data.status, 'active');
    assert.ok(calls.every(call => ['listUsers', 'getUserById', 'updateUserById'].includes(call[0])));
  });
});

test('Supabase errors are sanitized and account creation has a bounded request rate', async () => {
  const body = { name: 'Teacher', email: 'teacher@example.test', password: 'a-long-password' };
  for (const [createError, expected] of [[{ code: 'email_exists', message: 'secret diagnostic' }, 409], [{ status: 500, message: 'private-server-key diagnostic' }, 502]]) {
    await serve({ createError }, async request => {
      const result = await request('/api/admin/users', { method: 'POST', body });
      assert.equal(result.status, expected);
      assert.equal(result.data.error.includes('diagnostic'), false);
    });
  }
  await serve({}, async (request, { calls }) => {
    for (let count = 0; count < 10; count++) assert.equal((await request('/api/admin/users', { method: 'POST', body: { ...body, email: `teacher${count}@example.test` } })).status, 201);
    const result = await request('/api/admin/users', { method: 'POST', body });
    assert.equal(result.status, 429);
    assert.ok(Number(result.retryAfter) > 0);
    assert.equal(calls.filter(call => call[0] === 'createUser').length, 10);
  });
});

test('bootstrap promotes only a verified existing owner and never changes their password', async () => {
  const calls = [];
  const client = { auth: { admin: {
    listUsers: async () => ({ data: { users: [owner], total: 1 }, error: null }),
    updateUserById: async (id, attributes) => { calls.push([id, attributes]); return { data: { user: { ...owner, ...attributes } }, error: null }; },
  } } };
  assert.deepEqual(await setupAdministrator({ client, email: owner.email, getPassword: () => { throw new Error('Must not request password'); } }), { created: false, email: owner.email });
  assert.deepEqual(calls, [[OWNER, { app_metadata: { sprout_role: 'admin', sprout_status: 'active' } }]]);
  client.auth.admin.listUsers = async () => ({ data: { users: [{ ...owner, email_confirmed_at: null }], total: 1 }, error: null });
  await assert.rejects(setupAdministrator({ client, email: owner.email }), /not been verified/);
  assert.equal(calls.length, 1);
});

test('bootstrap creates an owner only with a strong locally supplied password', async () => {
  const calls = [];
  const client = { auth: { admin: {
    listUsers: async () => ({ data: { users: [], total: 0 }, error: null }),
    createUser: async attributes => { calls.push(attributes); return { data: { user: owner }, error: null }; },
  } } };
  await assert.rejects(setupAdministrator({ client, email: owner.email, getPassword: () => 'short' }), /12 to 128/);
  assert.equal(calls.length, 0);
  const result = await setupAdministrator({ client, email: owner.email, getPassword: () => 'a-long-password' });
  assert.equal(result.created, true);
  assert.equal(calls[0].email_confirm, true);
  assert.deepEqual(calls[0].app_metadata, { sprout_role: 'admin', sprout_status: 'active' });
});

test('only the owner can reset teacher passwords and responses never disclose them', async () => {
  await serve({}, async (request, { calls }) => {
    for (const password of ['', 'short', ' '.repeat(12), 'x'.repeat(129), null]) {
      assert.equal((await request(`/api/admin/users/${TEACHER}`, { method: 'PATCH', body: { password } })).status, 400);
    }
    assert.equal(calls.length, 0);
    const result = await request(`/api/admin/users/${TEACHER}`, { method: 'PATCH', body: { password: 'new-teacher-password' } });
    assert.equal(result.status, 200);
    assert.deepEqual(calls[1], ['updateUserById', TEACHER, { password: 'new-teacher-password' }]);
    assert.equal('password' in result.data, false);
    assert.equal((await request(`/api/admin/users/${OWNER}`, { method: 'PATCH', body: { password: 'new-teacher-password' } })).status, 403);
  });
  await serve({ user: teacher }, async (request, { calls }) => {
    assert.equal((await request(`/api/admin/users/${TEACHER}`, { method: 'PATCH', body: { password: 'new-teacher-password' } })).status, 403);
    assert.equal(calls.length, 0);
  });
});
