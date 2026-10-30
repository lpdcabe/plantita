import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { emitKeypressEvents } from 'node:readline';
import { pathToFileURL } from 'node:url';
import { validateEmail, validatePassword } from '../server/accounts.js';

function authResult(result) {
  if (result.error) throw new Error('Supabase could not complete administrator setup. Check the server secret key, account settings, and database migration, then try again.');
  return result.data;
}

// This is an operator-only script, never an HTTP bootstrap endpoint.
export async function setupAdministrator({ client, email, getPassword }) {
  const address = validateEmail(email);
  let existing;
  for (let page = 1; ; page++) {
    const data = authResult(await client.auth.admin.listUsers({ page, perPage: 1000 }));
    existing = (data.users || []).find(user => user.email?.toLowerCase() === address);
    if (existing) break;
    const hasMore = data.nextPage != null ? data.nextPage > page
      : typeof data.total === 'number' ? page * 1000 < data.total : (data.users || []).length === 1000;
    if (!hasMore) break;
  }
  if (existing) {
    if (!existing.email_confirmed_at) throw new Error('This existing administrator email has not been verified. Confirm ownership of the account in Supabase before promoting it. No changes were made.');
    authResult(await client.auth.admin.updateUserById(existing.id, {
      app_metadata: { ...existing.app_metadata, sprout_role: 'admin', sprout_status: 'active' },
    }));
    return { created: false, email: address };
  }
  let password = validatePassword(await getPassword());
  try {
    const { user } = authResult(await client.auth.admin.createUser({
      email: address, password, email_confirm: true,
      user_metadata: { name: 'Administrator' },
      app_metadata: { sprout_role: 'admin', sprout_status: 'active' },
    }));
    if (!user) throw new Error('Administrator creation could not be confirmed. Check the Supabase user list before trying again.');
    return { created: true, email: address };
  } finally { password = ''; }
}

function hiddenQuestion(prompt) {
  if (!process.stdin.isTTY) throw new Error('Creating a new administrator requires a password. Run this command in an interactive terminal, or set ADMIN_INITIAL_PASSWORD locally for this command. Never put the password in a command argument.');
  return new Promise((resolve, reject) => {
    const input = process.stdin;
    const wasRaw = input.isRaw;
    let value = '';
    emitKeypressEvents(input);
    input.setRawMode(true);
    input.resume();
    process.stdout.write(prompt);
    const finish = () => { input.removeListener('keypress', onKey); input.setRawMode(wasRaw); input.pause(); process.stdout.write('\n'); };
    function onKey(character, key = {}) {
      if (key.ctrl && key.name === 'c') { finish(); reject(new Error('Administrator setup cancelled.')); }
      else if (key.name === 'return' || key.name === 'enter') { finish(); resolve(value); }
      else if (key.name === 'backspace') value = value.slice(0, -1);
      else if (character && !key.ctrl && !key.meta && !character.includes('\u001b')) value += character;
    }
    input.on('keypress', onKey);
  });
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== '--email')) throw new Error('Usage: npm run setup:admin [-- --email your-admin-email]. Passwords must not be supplied as command arguments.');
  const email = validateEmail(args[1] || process.env.ADMIN_EMAIL);
  if (email !== validateEmail(process.env.ADMIN_EMAIL)) throw new Error('The requested email must match ADMIN_EMAIL in the server .env.');
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) throw new Error('Add SUPABASE_URL and SUPABASE_SECRET_KEY to the server .env before setting up the administrator.');
  const client = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const result = await setupAdministrator({ client, email, getPassword: async () => {
    if (process.env.ADMIN_INITIAL_PASSWORD) { const password = process.env.ADMIN_INITIAL_PASSWORD; delete process.env.ADMIN_INITIAL_PASSWORD; return password; }
    const password = await hiddenQuestion('New administrator password (12-128 characters, hidden): ');
    const confirm = await hiddenQuestion('Confirm password (hidden): ');
    if (password !== confirm) throw new Error('Passwords did not match. No account was created.');
    return password;
  } });
  console.log(`${result.created ? 'Created' : 'Enabled'} the administrator account for ${result.email}. Sign in to Sprout with your ${result.created ? 'new' : 'existing'} password.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(issue => { console.error(issue.message); process.exitCode = 1; });
}
