import { useEffect, useRef, useState } from 'react';
import { ArrowRight, LoaderCircle, ShieldCheck, Sprout } from 'lucide-react';
import Dialog from './Dialog.jsx';
import { createIsolatedSignInClient, requestApi, supabase } from '../lib/supabase.js';

export default function AuthDialog({ onClose, onConnected, admin = false }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const mountedRef = useRef(true);
  const submittingRef = useRef(false);
  function closeDialog() {
    if (admin && submittingRef.current) return;
    onClose?.();
  }

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  async function submit(event) {
    event.preventDefault();
    if (!supabase || submittingRef.current) return;
    submittingRef.current = true;
    setPending(true);
    setError('');
    let candidateClient;
    let candidateSession;
    let adoptedSession = false;
    try {
      const credentials = { email: email.trim(), password };
      if (admin) {
        candidateClient = createIsolatedSignInClient();
      }
      let result = await (candidateClient || supabase).auth.signInWithPassword(credentials);
      if (result.error) throw result.error;
      candidateSession = result.data.session;
      if (!mountedRef.current) return;
      if (admin && candidateSession) {
        const account = await requestApi('/account', { token: candidateSession.access_token });
        if (account.id !== candidateSession.user.id || account.canManageAccounts !== true || account.role !== 'admin' || account.status !== 'active') {
          throw new Error('This account does not have administrator access. Use teacher sign-in for your classroom.');
        }
        if (!mountedRef.current) return;
        result = await supabase.auth.setSession({ access_token: candidateSession.access_token, refresh_token: candidateSession.refresh_token });
        if (result.error) throw result.error;
        adoptedSession = true;
      }
      if (!mountedRef.current) return;
      if (result.data.session) {
        await onConnected?.(result.data.session);
        if (mountedRef.current) onClose?.();
      } else {
        throw new Error('Your session could not be started. Please try signing in again.');
      }
    } catch (issue) {
      if (mountedRef.current) setError(issue.message || 'We couldn’t sign you in. Please try again.');
    } finally {
      if (candidateClient && candidateSession && !adoptedSession) {
        await candidateClient.auth.signOut({ scope: 'local' }).catch(() => {});
      }
      if (candidateClient) await candidateClient.auth.dispose().catch(() => {});
      submittingRef.current = false;
      if (mountedRef.current) setPending(false);
    }
  }

  return (
    <Dialog title={admin ? 'Welcome back, administrator' : 'A home for your classroom'} subtitle={admin ? 'A little care for your teaching community.' : 'Your students. Your garden. One teacher account.'} onClose={closeDialog}>
      {!supabase ? (
        <div className="stack">
          <Sprout size={40} aria-hidden="true" />
          <p className="form-note" role="status">Sign-in is not available yet. Please ask the person setting up Sprout to finish connecting accounts.</p>
          <button className="button button-primary button-full" type="button" onClick={onClose}>Back to home</button>
        </div>
      ) : (
        <form className="auth-form stack" onSubmit={submit} aria-busy={pending}>
          <div className="auth-access-note"><ShieldCheck size={20} aria-hidden="true" /><p>{admin ? 'Sign in with your administrator account to manage teachers and their access.' : 'Welcome back. Sign in with the account your administrator created for you.'}</p></div>
          <label className="field">
            <span className="label">{admin ? 'Administrator email' : 'Teacher email'}</span>
            <input className="input" type="email" name="email" placeholder="you@school.edu" value={email} onChange={event => setEmail(event.target.value)} required maxLength={254} autoComplete="email" disabled={pending} spellCheck={false} />
          </label>
          <label className="field">
            <span className="label">Password</span>
            <input className="input" type="password" name="password" aria-label="Password" placeholder="Your password" value={password} onChange={event => setPassword(event.target.value)} required autoComplete="current-password" disabled={pending} />
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button button-primary button-full" type="submit" disabled={pending}>
            {pending ? <><LoaderCircle size={18} className="animate-spin" aria-hidden="true" /> Signing in…</> : <>{admin ? 'Open administration' : 'Open my classroom'}<ArrowRight size={18} aria-hidden="true" /></>}
          </button>
          <p className="form-note">{admin ? 'Only the system administrator can manage teacher accounts.' : 'Need access? Contact your school administrator. Students do not need their own logins.'}</p>
        </form>
      )}
    </Dialog>
  );
}
