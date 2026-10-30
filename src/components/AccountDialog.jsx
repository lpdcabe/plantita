import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Cloud, KeyRound, LoaderCircle, LogOut } from 'lucide-react';
import Dialog from './Dialog.jsx';
import PasswordField from './PasswordField.jsx';
import { createIsolatedSignInClient, supabase } from '../lib/supabase.js';

export default function AccountDialog({ session, pending, onClose, onRefresh, onSignOut, onToast }) {
  const [changing, setChanging] = useState(false);
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  function cancel() { if (busy.current) return; setCurrent(''); setPassword(''); setConfirmation(''); setError(''); setChanging(false); }
  async function save(event) {
    event.preventDefault();
    if (busy.current || pending) return;
    if (password.length < 12 || password.length > 128 || !password.trim()) { setError('Choose a password of 12 to 128 characters.'); return; }
    if (password !== confirmation) { setError('The new passwords do not match.'); return; }
    if (current === password) { setError('Choose a different password from your current one.'); return; }
    busy.current = true; setSaving(true); setError('');
    let verification;
    try {
      verification = createIsolatedSignInClient();
      const checked = await verification.auth.signInWithPassword({ email: session.user.email, password: current });
      if (checked.error) throw checked.error.code === 'invalid_credentials' ? new Error('Current password is incorrect.') : checked.error;
      if (checked.data.user?.id !== session.user.id) throw new Error('Your account could not be verified. Please sign in again.');
      if (!alive.current) return;
      const { error: issue } = await supabase.auth.updateUser({ password, current_password: current });
      if (issue) throw issue;
      if (!alive.current) return;
      setCurrent(''); setPassword(''); setConfirmation(''); setChanging(false);
      onToast?.('Your password has been changed. Use the new password next time you sign in.');
    } catch (issue) {
      if (alive.current) setError(issue.code === 'reauthentication_needed' ? 'Please sign out and sign in again, then retry changing your password.' : issue.message || 'Your password could not be changed. Please try again.');
    } finally {
      if (verification) {
        await verification.auth.signOut({ scope: 'local' }).catch(() => {});
        await verification.auth.dispose().catch(() => {});
      }
      busy.current = false; if (alive.current) setSaving(false);
    }
  }
  const disabled = pending || saving;
  return <Dialog title={changing ? 'Change your password' : 'Your classroom account'} subtitle={changing ? 'A little care for your account.' : 'A home for all your little growers.'} onClose={() => { if (!busy.current) onClose(); }}>
    {changing ? <form className="stack account-password-form" onSubmit={save} aria-busy={saving}><button type="button" className="text-button account-back" onClick={cancel} disabled={disabled}><ArrowLeft size={16} />Back to account</button><PasswordField label="Current password" value={current} onChange={setCurrent} current disabled={disabled} /><PasswordField label="New password" value={password} onChange={setPassword} disabled={disabled} /><PasswordField label="Confirm new password" value={confirmation} onChange={setConfirmation} disabled={disabled} /><p className="form-note">Use 12–128 characters. Your classrooms and students stay saved.</p>{error && <p className="form-error" role="alert">{error}</p>}<div className="dialog-actions"><button type="button" className="button button-secondary" onClick={cancel} disabled={disabled}>Cancel</button><button type="submit" className="button button-primary" disabled={disabled}>{saving ? <LoaderCircle size={17} className="animate-spin" /> : <KeyRound size={17} />}{saving ? 'Changing password…' : 'Save new password'}</button></div></form> : <><div className="account-detail"><Cloud size={34} /><strong>{session?.user.email}</strong><p>Sign in on another device to open the same classroom. Changes refresh automatically while your garden is open.</p></div><div className="stack"><button className="button button-secondary button-full" disabled={disabled} onClick={() => setChanging(true)}><KeyRound size={17} />Change password</button><button className="button button-secondary button-full" disabled={disabled} onClick={onRefresh}>Refresh classroom</button></div><button className="text-button danger-text account-signout" disabled={disabled} onClick={onSignOut}><LogOut size={17} />Sign out</button></>}
  </Dialog>;
}
