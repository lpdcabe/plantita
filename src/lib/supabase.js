import { createClient } from '@supabase/supabase-js';
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase = url && key ? createClient(url, key) : null;
// Verify the hidden admin form before publishing a session to the shared app.
// This client never writes to browser storage or starts a refresh timer.
export function createIsolatedSignInClient() {
  return url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: `sprout-admin-sign-in-${crypto.randomUUID()}` } }) : null;
}
export async function requestApi(path, { token, method = 'GET', body, classroomId } = {}) {
  const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api${path}`, {
    method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(classroomId && classroomId !== 'loading' ? { 'X-Classroom-Id': classroomId } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(20000),
  });
  if (response.status === 204) return null;
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) {
    const error = new Error(data?.error || 'We couldn’t reach your classroom. Check that the Express server is running, then try again.');
    error.status = response.status;
    throw error;
  }
  return data;
}
