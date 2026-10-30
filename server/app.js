import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { mountAccounts, requireApprovedAccount } from './accounts.js';

export const PLANTS = ['sunflower', 'daisy', 'tulip', 'cactus', 'monstera', 'lavender', 'strawberry', 'hibiscus', 'rose', 'marigold', 'bonsai'];
export const THEMES = ['sunshine', 'sunset', 'moonlight'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const here = path.dirname(fileURLToPath(import.meta.url));

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function fail(message) { throw new HttpError(400, message); }
function text(value, label, max) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    fail(`${label} must contain 1–${max} characters.`);
  }
  return value.trim();
}
function integer(value, label, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) fail(`${label} must be a whole number from ${min} to ${max}.`);
  return value;
}
function choice(value, choices, label) {
  if (!choices.includes(value)) fail(`Choose a valid ${label}.`);
  return value;
}
function id(value) {
  if (!UUID.test(value || '')) fail('Invalid record ID.');
  return value;
}
function object(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail('Send a JSON object.');
  return body;
}
function classroomFields(body, partial = false) {
  object(body);
  const out = {};
  if (!partial || body.name !== undefined) out.name = text(body.name ?? 'Our little garden', 'Class name', 80);
  if (!partial || body.goal !== undefined) out.goal = integer(body.goal ?? 1000, 'Class goal', 1, 1000000);
  if (!partial || body.theme !== undefined) out.theme = choice(body.theme ?? 'sunshine', THEMES, 'garden theme');
  if (!partial || body.decorations !== undefined) {
    const decorations = body.decorations ?? [];
    if (!Array.isArray(decorations) || decorations.length > 20 || decorations.some(item => typeof item !== 'string' || !/^[a-z-]{1,30}$/.test(item))) {
      fail('Decorations must be a list of up to 20 decoration names.');
    }
    out.decorations = [...new Set(decorations)];
  }
  if (!Object.keys(out).length) fail('No changes were supplied.');
  return out;
}
function studentFields(body, partial = false) {
  object(body);
  const out = {};
  if (!partial || body.name !== undefined) out.name = text(body.name, 'Student name', 60);
  if (!partial || body.plant !== undefined) out.plant = choice(body.plant ?? 'sunflower', PLANTS, 'plant');
  if (!Object.keys(out).length) fail('No changes were supplied.');
  return out;
}
function check(result) {
  if (!result.error) return result.data;
  const { code } = result.error;
  if (code === '23505') throw new HttpError(409, 'This classroom already exists. Refresh to load it.');
  if (code === '42501') throw new HttpError(403, 'You do not have access to this classroom.');
  if (code === '23514' && result.error.message?.includes('students_plant_check')) {
    throw new HttpError(503, 'This plant needs a database update. Run supabase/migrations/20261027_add_plant_varieties.sql in your Supabase SQL editor, then try again.');
  }
  if (code === 'P0001') throw new HttpError(400, result.error.message);
  if (code === '42P01' || code === 'PGRST205' || code === 'PGRST202') {
    throw new HttpError(503, 'The database is not ready. Run supabase/schema.sql in your Supabase SQL editor.');
  }
  throw new HttpError(502, 'The garden could not reach its database. Please try again.');
}

export function mapStudent(student) {
  return { id: student.id, name: student.name, plant: student.plant, points: student.points };
}
export function mapClassroom(classroom) {
  return classroom && { id: classroom.id, name: classroom.name, goal: classroom.goal, theme: classroom.theme, decorations: classroom.decorations };
}
export function mapActivity(activity) {
  return { id: activity.id, studentId: activity.student_id, studentName: activity.student_name, reason: activity.reason, points: activity.points, createdAt: activity.created_at };
}

async function getClassroom(client, userId, required = true, classroomId) {
  let query = client.from('classrooms').select('*').eq('owner_id', userId);
  query = classroomId ? query.eq('id', classroomId) : query.order('created_at', { ascending: true }).order('id', { ascending: true }).limit(1);
  const classroom = check(await query.maybeSingle());
  if (!classroom && classroomId) throw new HttpError(404, 'This classroom is unavailable or belongs to another teacher.');
  if (!classroom && required) throw new HttpError(404, 'Create your classroom first.');
  return classroom;
}

async function getState(client, userId, classroomId) {
  const classroom = await getClassroom(client, userId, false, classroomId);
  if (!classroom) return { classroom: null, students: [], activities: [] };
  const [students, activities] = await Promise.all([
    client.from('students').select('*').eq('classroom_id', classroom.id).order('created_at', { ascending: true }),
    client.from('activities').select('*').eq('classroom_id', classroom.id).order('created_at', { ascending: false }).limit(500),
  ]);
  return { classroom: mapClassroom(classroom), students: check(students).map(mapStudent), activities: check(activities).map(mapActivity) };
}

export function createApp({ env = process.env, clientFactory = createClient, staticDirectory = path.join(here, '..', 'dist') } = {}) {
  const app = express();
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const key = env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
  const configured = Boolean(url && key);
  const origins = (env.CLIENT_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173').split(',').map(origin => origin.trim());
  app.disable('x-powered-by');
  app.use(cors({ origin(origin, callback) { callback(null, !origin || origins.includes(origin)); } }));
  app.use(express.json({ limit: '32kb' }));
  app.use('/api', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  app.get('/api/health', (_req, res) => res.json({ ok: true, configured }));

  app.use('/api', async (req, _res, next) => {
    try {
      if (!configured) throw new HttpError(503, 'Add your Supabase project URL and public key to .env, then restart the server.');
      const match = /^Bearer ([^\s]+)$/i.exec(req.headers.authorization || '');
      if (!match) throw new HttpError(401, 'Sign in to open your classroom.');
      const client = clientFactory(url, key, {
        global: { headers: { Authorization: `Bearer ${match[1]}` } },
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });
      const { data, error } = await client.auth.getUser(match[1]);
      if (error || !data?.user) throw new HttpError(401, 'Your session has expired. Please sign in again.');
      req.db = client;
      req.user = data.user;
      req.account = requireApprovedAccount(data.user, env.ADMIN_EMAIL);
      req.classroomId = req.headers['x-classroom-id'] ? id(req.headers['x-classroom-id']) : undefined;
      next();
    } catch (error) { next(error); }
  });

  mountAccounts(app, { env, clientFactory, url });

  app.get('/api/classrooms', async (req, res) => {
    const list = check(await req.db.from('classrooms').select('*').eq('owner_id', req.user.id).order('created_at', { ascending: true }).order('id', { ascending: true }));
    res.json(list.map(mapClassroom));
  });
  app.post('/api/classrooms', async (req, res) => {
    const fields = classroomFields(req.body);
    const result = await req.db.from('classrooms').insert({ ...fields, owner_id: req.user.id }).select('*').single();
    if (result.error?.code === '23505') throw new HttpError(503, 'Multiple classes need a database update. Run supabase/schema.sql in your Supabase SQL editor, then try again.');
    res.status(201).json(mapClassroom(check(result)));
  });
  app.get('/api/classroom', async (req, res) => res.json(await getState(req.db, req.user.id, req.classroomId)));
  app.post('/api/classroom', async (req, res) => {
    const fields = classroomFields(req.body);
    const result = await req.db.from('classrooms').insert({ ...fields, owner_id: req.user.id }).select('*').single();
    // Compatibility for older clients on the original single-class schema.
    if (result.error?.code === '23505') {
      return res.json(mapClassroom(await getClassroom(req.db, req.user.id, true, req.classroomId)));
    }
    res.status(201).json(mapClassroom(check(result)));
  });
  app.patch('/api/classroom', async (req, res) => {
    const fields = classroomFields(req.body, true);
    const classroom = await getClassroom(req.db, req.user.id, true, req.classroomId);
    const result = await req.db.from('classrooms').update(fields).eq('id', classroom.id).select('*').single();
    res.json(mapClassroom(check(result)));
  });
  app.post('/api/students', async (req, res) => {
    const fields = studentFields(req.body);
    const classroom = await getClassroom(req.db, req.user.id, true, req.classroomId);
    const result = await req.db.from('students').insert({ ...fields, classroom_id: classroom.id }).select('*').single();
    res.status(201).json(mapStudent(check(result)));
  });
  app.post('/api/students/batch', async (req, res) => {
    const body = object(req.body);
    if (!Array.isArray(body.students) || body.students.length < 1 || body.students.length > 40) {
      fail('Add between 1 and 40 students at a time.');
    }
    // Validate every entry first, then use one INSERT so the entire roster
    // addition succeeds or fails together instead of leaving partial additions.
    const students = body.students.map(student => studentFields(student));
    const classroom = await getClassroom(req.db, req.user.id, true, req.classroomId);
    const rows = students.map(student => ({ ...student, classroom_id: classroom.id }));
    const result = await req.db.from('students').insert(rows).select('*');
    res.status(201).json(check(result).map(mapStudent));
  });
  app.patch('/api/students/:id', async (req, res) => {
    const studentId = id(req.params.id);
    const fields = studentFields(req.body, true);
    const classroom = await getClassroom(req.db, req.user.id, true, req.classroomId);
    const result = check(await req.db.from('students').update(fields).eq('id', studentId).eq('classroom_id', classroom.id).select('*').maybeSingle());
    if (!result) throw new HttpError(404, 'Student not found.');
    res.json(mapStudent(result));
  });
  app.delete('/api/students/:id', async (req, res) => {
    const studentId = id(req.params.id);
    const classroom = await getClassroom(req.db, req.user.id, true, req.classroomId);
    const result = check(await req.db.from('students').delete().eq('id', studentId).eq('classroom_id', classroom.id).select('id'));
    if (!result.length) throw new HttpError(404, 'Student not found.');
    res.status(204).end();
  });
  app.post('/api/awards', async (req, res) => {
    const body = object(req.body);
    const points = integer(body.points, 'Points', 1, 100);
    const reason = text(body.reason, 'Reason', 120);
    const all = body.studentIds === 'all';
    if (!all && (!Array.isArray(body.studentIds) || body.studentIds.length < 1 || body.studentIds.length > 1000)) fail('Choose at least one student.');
    const studentIds = all ? null : [...new Set(body.studentIds.map(id))];
    check(await req.db.rpc('award_points', { p_student_ids: studentIds, p_all: all, p_points: points, p_reason: reason, ...(req.classroomId ? { p_classroom_id: req.classroomId } : {}) }));
    res.json(await getState(req.db, req.user.id, req.classroomId));
  });
  app.delete('/api/awards/:id', async (req, res) => {
    const activityId = id(req.params.id);
    check(await req.db.rpc('undo_award', { p_activity_id: activityId, ...(req.classroomId ? { p_classroom_id: req.classroomId } : {}) }));
    res.json(await getState(req.db, req.user.id, req.classroomId));
  });
  app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found.' }));

  if (staticDirectory && fs.existsSync(path.join(staticDirectory, 'index.html'))) {
    app.use(express.static(staticDirectory));
    app.get(/.*/, (_req, res) => res.sendFile(path.join(staticDirectory, 'index.html')));
  }
  app.use((error, _req, res, _next) => {
    if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON request.' });
    if (error.type === 'entity.too.large') return res.status(413).json({ error: 'This request is too large.' });
    res.status(error.status || 500).json({ error: error.status ? error.message : 'Something went wrong. Please try again.' });
  });
  return app;
}
