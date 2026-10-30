// Account provisioning uses a separate server-only client. Classroom queries
// continue to use the signed-in teacher's JWT and row-level security.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const error = (status, message) => Object.assign(new Error(message), { status });
const normalEmail = value => typeof value === 'string' ? value.trim().toLowerCase() : '';

export function isAdministrator(user, adminEmail) {
  return Boolean(adminEmail && user?.email_confirmed_at && normalEmail(user.email) === normalEmail(adminEmail));
}

export function accountFor(user, adminEmail) {
  const admin = isAdministrator(user, adminEmail);
  const metadata = user.app_metadata || {};
  const status = admin ? 'active' : metadata.sprout_status === 'inactive' ? 'inactive'
    : metadata.sprout_role === 'teacher' && metadata.sprout_status === 'active' ? 'active' : 'pending';
  return {
    id: user.id, email: user.email || '',
    name: typeof user.user_metadata?.name === 'string' ? user.user_metadata.name.slice(0, 80) : '',
    role: admin ? 'admin' : 'teacher', status,
    createdAt: user.created_at || null, lastSignInAt: user.last_sign_in_at || null,
  };
}

export function requireApprovedAccount(user, adminEmail) {
  const account = accountFor(user, adminEmail);
  if (account.status !== 'active') {
    throw error(403, account.status === 'inactive'
      ? 'Your account is inactive. Please contact your administrator.'
      : 'Your account needs administrator approval. Please contact your administrator.');
  }
  return account;
}

function bodyFields(body, allowed) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw error(400, 'Send a JSON object.');
  if (Object.keys(body).some(key => !allowed.includes(key))) throw error(400, 'This account change contains unsupported fields.');
  return body;
}

function nameField(value) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 80) throw error(400, 'Enter a name of 1 to 80 characters.');
  return value.trim();
}

export function validateEmail(value) {
  const email = normalEmail(value);
  if (!EMAIL.test(email) || email.length > 254) throw error(400, 'Enter a valid email address.');
  return email;
}

export function validatePassword(value) {
  if (typeof value !== 'string' || value.length < 12 || value.length > 128 || !value.trim()) throw error(400, 'Choose a password of 12 to 128 characters.');
  return value;
}

function unwrap(result) {
  if (!result.error) return result.data;
  const { code, status } = result.error;
  if (['email_exists', 'user_already_exists'].includes(code) || status === 422 && /already.*registered|already.*exists/i.test(result.error.message || '')) {
    throw error(409, 'An account with this email already exists. Find it in the account list.');
  }
  if (code === 'user_not_found' || status === 404) throw error(404, 'This account no longer exists. Refresh the account list.');
  if (code === 'weak_password') throw error(400, 'Choose a stronger password for this account.');
  if (code === 'email_address_invalid') throw error(400, 'Enter a valid email address.');
  throw error(502, 'Account management could not reach Supabase. Please try again.');
}

function pageNumber(value, fallback, max) {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) || Number(value) > max) throw error(400, 'Choose a valid account-list page.');
  return Number(value);
}

export function mountAccounts(app, { env, clientFactory, url }) {
  const adminEmail = normalEmail(env.ADMIN_EMAIL);
  const secret = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  let adminClient;
  const creations = new Map();
  const activeCreations = new Set();
  const activeUpdates = new Set();
  function service() {
    if (!secret) throw error(503, 'Account management is not connected yet. Add SUPABASE_SECRET_KEY to the server .env and restart the server.');
    adminClient ||= clientFactory(url, secret, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    return adminClient.auth.admin;
  }

  app.get('/api/account', (req, res) => {
    const { id, email, name, role, status } = req.account;
    res.json({ id, email, name, role, status, canManageAccounts: role === 'admin' });
  });
  app.use('/api/admin', (req, _res, next) => {
    if (!isAdministrator(req.user, adminEmail)) return next(error(403, 'Only the administrator can manage accounts.'));
    next();
  });
  app.get('/api/admin/users', async (req, res) => {
    const page = pageNumber(req.query.page, 1, 100000);
    const perPage = pageNumber(req.query.perPage, 20, 100);
    const data = unwrap(await service().listUsers({ page, perPage }));
    const users = data.users || [];
    res.json({ users: users.map(user => accountFor(user, adminEmail)), page,
      hasMore: data.nextPage != null ? data.nextPage > page : typeof data.total === 'number' ? page * perPage < data.total : users.length === perPage });
  });
  app.post('/api/admin/users', async (req, res) => {
    const body = bodyFields(req.body, ['name', 'email', 'password']);
    const name = nameField(body.name), email = validateEmail(body.email), password = validatePassword(body.password);
    if (email === adminEmail) throw error(409, 'The administrator account is managed separately.');
    const admin = service();
    const now = Date.now();
    const recent = (creations.get(req.user.id) || []).filter(time => now - time < 60000);
    if (recent.length >= 10) { res.set('Retry-After', String(Math.ceil((recent[0] + 60000 - now) / 1000))); throw error(429, 'Please wait a moment before creating another account.'); }
    if (activeCreations.has(email)) throw error(409, 'This account is already being created. Please wait.');
    creations.set(req.user.id, [...recent, now]);
    activeCreations.add(email);
    try {
      const { user } = unwrap(await admin.createUser({ email, password, email_confirm: true, user_metadata: { name }, app_metadata: { sprout_role: 'teacher', sprout_status: 'active' } }));
      if (!user) throw error(502, 'The account could not be created. Please refresh and try again.');
      res.status(201).json(accountFor(user, adminEmail));
    } finally { activeCreations.delete(email); }
  });
  app.patch('/api/admin/users/:id', async (req, res) => {
    if (!UUID.test(req.params.id)) throw error(400, 'Invalid account ID.');
    const body = bodyFields(req.body, ['name', 'status', 'password']);
    if (!Object.keys(body).length) throw error(400, 'No account changes were supplied.');
    const name = body.name === undefined ? undefined : nameField(body.name);
    const password = body.password === undefined ? undefined : validatePassword(body.password);
    if (body.status !== undefined && !['active', 'inactive'].includes(body.status)) throw error(400, 'Choose active or inactive account access.');
    if (req.params.id === req.user.id) throw error(403, 'The administrator account cannot be changed here.');
    const admin = service();
    if (activeUpdates.has(req.params.id)) throw error(409, 'This account is already being updated. Please wait.');
    activeUpdates.add(req.params.id);
    try {
      const { user: existing } = unwrap(await admin.getUserById(req.params.id));
      if (!existing) throw error(404, 'This account no longer exists.');
      if (normalEmail(existing.email) === adminEmail) throw error(403, 'The administrator account cannot be changed here.');
      const attributes = {};
      if (password !== undefined) attributes.password = password;
      if (name !== undefined) attributes.user_metadata = { ...existing.user_metadata, name };
      if (body.status !== undefined) attributes.app_metadata = { ...existing.app_metadata, sprout_role: 'teacher', sprout_status: body.status };
      const { user } = unwrap(await admin.updateUserById(req.params.id, attributes));
      if (!user) throw error(502, 'The account could not be updated. Please refresh and try again.');
      res.json(accountFor(user, adminEmail));
    } finally { activeUpdates.delete(req.params.id); }
  });
}
