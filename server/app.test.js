import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from './app.js';

const OWNER = '11111111-1111-4111-8111-111111111111';
const CLASSROOM = '22222222-2222-4222-8222-222222222222';
const STUDENT = '33333333-3333-4333-8333-333333333333';
const env = { SUPABASE_URL: 'https://test.supabase.co', SUPABASE_ANON_KEY: 'public-test-key' };
const classroom = { id: CLASSROOM, owner_id: OWNER, name: 'Grade 2', goal: 1000, theme: 'sunshine', decorations: [] };

function fakeDb({ authenticated = true, tables = {}, rpcError = null } = {}) {
  const calls = [];
  return {
    calls,
    auth: { async getUser(token) { calls.push(['getUser', token]); return authenticated ? { data: { user: { id: OWNER, app_metadata: { sprout_role: 'teacher', sprout_status: 'active' } } }, error: null } : { data: {}, error: { message: 'Bad token' } }; } },
    from(table) {
      const query = { table, operations: [] };
      calls.push(query);
      const builder = {};
      for (const method of ['select', 'insert', 'update', 'delete', 'eq', 'order', 'limit', 'single', 'maybeSingle']) {
        builder[method] = (...args) => { query.operations.push([method, ...args]); return builder; };
      }
      builder.then = (resolve, reject) => Promise.resolve(typeof tables[table] === 'function' ? tables[table](query) : tables[table] ?? { data: null, error: null }).then(resolve, reject);
      return builder;
    },
    async rpc(name, args) { calls.push(['rpc', name, args]); return { data: null, error: rpcError }; },
  };
}

async function withServer(options, run) {
  const app = createApp({ staticDirectory: '__no_static_files__', ...options });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    await run(async (route, { method = 'GET', body, token = 'valid-token', classroomId } = {}) => {
      const headers = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      if (classroomId) headers['X-Classroom-Id'] = classroomId;
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      const response = await fetch(`${origin}${route}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
      const data = response.status === 204 ? null : await response.json();
      return { status: response.status, data };
    });
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

test('class list is scoped to the signed-in owner', async () => {
  const db = fakeDb({ tables: { classrooms: { data: [classroom], error: null } } });
  await withServer({ env, clientFactory: () => db }, async request => {
    const response = await request('/api/classrooms');
    assert.equal(response.status, 200);
    assert.equal(response.data[0].id, CLASSROOM);
    assert.ok(db.calls.find(call => call.table === 'classrooms').operations.some(op => op[0] === 'eq' && op[1] === 'owner_id' && op[2] === OWNER));
  });
});

test('selected classroom is checked for ownership before any roster write', async () => {
  const db = fakeDb();
  await withServer({ env, clientFactory: () => db }, async request => {
    const response = await request('/api/students', { method: 'POST', classroomId: CLASSROOM, body: { name: 'Mia' } });
    assert.equal(response.status, 404);
    const queries = db.calls.filter(call => call.table);
    assert.equal(queries.length, 1);
    assert.ok(queries[0].operations.some(op => op[0] === 'eq' && op[1] === 'id' && op[2] === CLASSROOM));
    assert.ok(queries[0].operations.some(op => op[0] === 'eq' && op[1] === 'owner_id' && op[2] === OWNER));
  });
});

test('water everyone passes the selected classroom to the atomic RPC', async () => {
  const db = fakeDb({ tables: { classrooms: { data: classroom, error: null }, students: { data: [], error: null }, activities: { data: [], error: null } } });
  await withServer({ env, clientFactory: () => db }, async request => {
    const response = await request('/api/awards', { method: 'POST', classroomId: CLASSROOM, body: { studentIds: 'all', points: 10, reason: 'Teamwork' } });
    assert.equal(response.status, 200);
    assert.deepEqual(db.calls.find(call => Array.isArray(call) && call[0] === 'rpc'), ['rpc', 'award_points', { p_student_ids: null, p_all: true, p_points: 10, p_reason: 'Teamwork', p_classroom_id: CLASSROOM }]);
  });
});

test('new-class creation reports an old database schema instead of pretending to create a class', async () => {
  const db = fakeDb({ tables: { classrooms: { data: null, error: { code: '23505' } } } });
  await withServer({ env, clientFactory: () => db }, async request => {
    const response = await request('/api/classrooms', { method: 'POST', body: { name: 'Another class' } });
    assert.equal(response.status, 503);
    assert.match(response.data.error, /schema.sql/);
  });
});

test('new plant varieties can be created together and selected when editing a student', async () => {
  const plants = ['hibiscus', 'rose', 'marigold', 'bonsai'];
  const db = fakeDb({ tables: {
    classrooms: { data: classroom, error: null },
    students: query => {
      const insert = query.operations.find(op => op[0] === 'insert');
      const update = query.operations.find(op => op[0] === 'update');
      return { data: insert ? insert[1].map((row, i) => ({ ...row, id: `new-${i}`, points: 0 })) : { id: STUDENT, name: 'Mia', points: 145, ...update[1] }, error: null };
    },
  } });
  await withServer({ env, clientFactory: () => db }, async request => {
    const response = await request('/api/students/batch', { method: 'POST', classroomId: CLASSROOM, body: { students: plants.map(plant => ({ name: plant, plant })) } });
    assert.equal(response.status, 201);
    assert.deepEqual(response.data.map(student => student.plant), plants);
    for (const plant of plants) {
      const edited = await request(`/api/students/${STUDENT}`, { method: 'PATCH', classroomId: CLASSROOM, body: { plant } });
      assert.equal(edited.status, 200);
      assert.equal(edited.data.plant, plant);
      assert.equal(edited.data.points, 145);
    }
  });
});

test('an older plant constraint gives the teacher the required migration instead of a false success', async () => {
  const db = fakeDb({ tables: { classrooms: { data: classroom, error: null }, students: { data: null, error: { code: '23514', message: 'violates check constraint "students_plant_check"' } } } });
  await withServer({ env, clientFactory: () => db }, async request => {
    const response = await request('/api/students', { method: 'POST', body: { name: 'Mia', plant: 'hibiscus' } });
    assert.equal(response.status, 503);
    assert.match(response.data.error, /20261027_add_plant_varieties.sql/);
  });
});

test('health is public and missing configuration fails clearly', async () => {
  await withServer({ env: {} }, async request => {
    assert.deepEqual(await request('/api/health', { token: null }), { status: 200, data: { ok: true, configured: false } });
    const response = await request('/api/classroom');
    assert.equal(response.status, 503);
    assert.match(response.data.error, /Supabase/);
  });
});

test('missing and invalid tokens cannot query classroom data', async () => {
  const db = fakeDb({ authenticated: false });
  await withServer({ env, clientFactory: () => db }, async request => {
    assert.equal((await request('/api/classroom', { token: null })).status, 401);
    assert.equal((await request('/api/classroom', { token: 'invalid' })).status, 401);
    assert.deepEqual(db.calls, [['getUser', 'invalid']]);
  });
});

test('user bearer is forwarded and missing classroom returns an empty state', async () => {
  const db = fakeDb();
  let options;
  await withServer({ env, clientFactory: (_url, _key, config) => { options = config; return db; } }, async request => {
    assert.deepEqual(await request('/api/classroom'), { status: 200, data: { classroom: null, students: [], activities: [] } });
    assert.equal(options.global.headers.Authorization, 'Bearer valid-token');
    assert.equal(options.auth.persistSession, false);
    assert.ok(db.calls.find(call => call.table === 'classrooms').operations.some(op => op[0] === 'eq' && op[1] === 'owner_id' && op[2] === OWNER));
  });
});

test('classroom creation always assigns the authenticated owner', async () => {
  const db = fakeDb({ tables: { classrooms: { data: classroom, error: null } } });
  await withServer({ env, clientFactory: () => db }, async request => {
    const result = await request('/api/classroom', { method: 'POST', body: { name: 'Grade 2', owner_id: 'another-teacher' } });
    assert.equal(result.status, 201);
    const insert = db.calls.find(call => call.table === 'classrooms').operations.find(op => op[0] === 'insert');
    assert.equal(insert[1].owner_id, OWNER);
  });
});

test('concurrent/repeated classroom creation preserves the existing classroom settings', async () => {
  const db = fakeDb({ tables: { classrooms: query => query.operations.some(op => op[0] === 'insert')
    ? { data: null, error: { code: '23505' } }
    : { data: classroom, error: null },
  } });
  await withServer({ env, clientFactory: () => db }, async request => {
    const result = await request('/api/classroom', { method: 'POST', body: { name: 'Unexpected overwrite', theme: 'moonlight' } });
    assert.equal(result.status, 200);
    assert.equal(result.data.name, classroom.name);
    assert.equal(result.data.theme, classroom.theme);
    const queries = db.calls.filter(call => call.table === 'classrooms');
    assert.equal(queries.length, 2);
    assert.ok(!queries.some(query => query.operations.some(op => op[0] === 'update')));
  });
});

test('award validation rejects fractions, negative points, empty selection and invalid IDs before RPC', async () => {
  const db = fakeDb();
  await withServer({ env, clientFactory: () => db }, async request => {
    const cases = [
      { studentIds: [STUDENT], points: -1, reason: 'Homework' },
      { studentIds: [STUDENT], points: 1.5, reason: 'Homework' },
      { studentIds: [STUDENT], points: 101, reason: 'Homework' },
      { studentIds: [], points: 5, reason: 'Homework' },
      { studentIds: ['not-an-id'], points: 5, reason: 'Homework' },
      { studentIds: [STUDENT], points: 5, reason: ' ' },
    ];
    for (const body of cases) assert.equal((await request('/api/awards', { method: 'POST', body })).status, 400);
    assert.ok(!db.calls.some(call => Array.isArray(call) && call[0] === 'rpc'));
  });
});

test('valid batch is deduplicated and dispatched once to the atomic RPC', async () => {
  const db = fakeDb({ tables: {
    classrooms: { data: classroom, error: null },
    students: { data: [{ id: STUDENT, name: 'Mia', plant: 'sunflower', points: 15 }], error: null },
    activities: { data: [{ id: 'award-id', student_id: STUDENT, student_name: 'Mia', points: 5, reason: 'Homework', created_at: '2026-10-26T10:00:00Z' }], error: null },
  } });
  await withServer({ env, clientFactory: () => db }, async request => {
    const response = await request('/api/awards', { method: 'POST', body: { studentIds: [STUDENT, STUDENT], points: 5, reason: ' Homework ' } });
    assert.equal(response.status, 200);
    assert.equal(response.data.students[0].points, 15);
    assert.equal(response.data.activities[0].studentName, 'Mia');
    assert.deepEqual(db.calls.filter(call => Array.isArray(call) && call[0] === 'rpc'), [['rpc', 'award_points', { p_student_ids: [STUDENT], p_all: false, p_points: 5, p_reason: 'Homework' }]]);
  });
});

test('database ownership rejection does not fetch a misleading success state', async () => {
  const db = fakeDb({ rpcError: { code: 'P0001', message: 'One or more students are not in your classroom.' } });
  await withServer({ env, clientFactory: () => db }, async request => {
    const result = await request('/api/awards', { method: 'POST', body: { studentIds: [STUDENT], points: 5, reason: 'Homework' } });
    assert.equal(result.status, 400);
    assert.match(result.data.error, /not in your classroom/);
    assert.ok(!db.calls.some(call => call.table));
  });
});

test('student update scopes by owned classroom and ignores a forged points value', async () => {
  const db = fakeDb({ tables: {
    classrooms: { data: classroom, error: null },
    students: { data: { id: STUDENT, name: 'Ava', plant: 'tulip', points: 10 }, error: null },
  } });
  await withServer({ env, clientFactory: () => db }, async request => {
    const result = await request(`/api/students/${STUDENT}`, { method: 'PATCH', body: { name: 'Ava', points: 999, classroom_id: 'other' } });
    assert.equal(result.status, 200);
    const ops = db.calls.find(call => call.table === 'students').operations;
    assert.deepEqual(ops.find(op => op[0] === 'update'), ['update', { name: 'Ava' }]);
    assert.ok(ops.some(op => op[0] === 'eq' && op[1] === 'classroom_id' && op[2] === CLASSROOM));
  });
});

test('batch roster validation rejects invalid later entries before database writes', async () => {
  const db = fakeDb();
  await withServer({ env, clientFactory: () => db }, async request => {
    const result = await request('/api/students/batch', { method: 'POST', body: { students: [
      { name: 'Mia', plant: 'sunflower' },
      { name: '   ', plant: 'tulip' },
    ] } });
    assert.equal(result.status, 400);
    assert.match(result.data.error, /Student name/);
    assert.ok(!db.calls.some(call => call.table));
  });
});

test('batch roster insertion dispatches once and scopes all rows to the owned classroom', async () => {
  const rows = [
    { id: STUDENT, name: 'Mia', plant: 'sunflower', points: 0 },
    { id: '44444444-4444-4444-8444-444444444444', name: 'Ava', plant: 'tulip', points: 0 },
  ];
  const db = fakeDb({ tables: {
    classrooms: { data: classroom, error: null },
    students: { data: rows, error: null },
  } });
  await withServer({ env, clientFactory: () => db }, async request => {
    const result = await request('/api/students/batch', { method: 'POST', body: { students: [
      { name: ' Mia ', plant: 'sunflower', classroom_id: 'another-classroom', points: 999 },
      { name: 'Ava', plant: 'tulip' },
    ] } });
    assert.equal(result.status, 201);
    assert.deepEqual(result.data, rows);
    const queries = db.calls.filter(call => call.table === 'students');
    assert.equal(queries.length, 1);
    assert.deepEqual(queries[0].operations.find(op => op[0] === 'insert'), ['insert', [
      { name: 'Mia', plant: 'sunflower', classroom_id: CLASSROOM },
      { name: 'Ava', plant: 'tulip', classroom_id: CLASSROOM },
    ]]);
  });
});

test('batch roster rejects empty and oversized submissions', async () => {
  const db = fakeDb();
  await withServer({ env, clientFactory: () => db }, async request => {
    for (const students of [[], Array.from({ length: 41 }, () => ({ name: 'Mia', plant: 'sunflower' }))]) {
      const result = await request('/api/students/batch', { method: 'POST', body: { students } });
      assert.equal(result.status, 400);
    }
    assert.ok(!db.calls.some(call => call.table));
  });
});

test('undo validates the activity ID and delegates once to atomic RPC', async () => {
  const db = fakeDb();
  await withServer({ env, clientFactory: () => db }, async request => {
    assert.equal((await request('/api/awards/invalid', { method: 'DELETE' })).status, 400);
    assert.equal((await request(`/api/awards/${STUDENT}`, { method: 'DELETE' })).status, 200);
    assert.deepEqual(db.calls.filter(call => Array.isArray(call) && call[0] === 'rpc'), [['rpc', 'undo_award', { p_activity_id: STUDENT }]]);
  });
});
