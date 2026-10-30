import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ChevronDown, Eye, EyeOff, KeyRound, LoaderCircle, Pencil, Plus, RefreshCw, Search, ShieldCheck, Sprout, UserCheck, UserRound, Users, X } from 'lucide-react';
import Dialog from '../Dialog.jsx';
import PasswordField from '../PasswordField.jsx';
import { requestApi } from '../../lib/supabase.js';
import './admin-view.css';

const STATUS_NAMES = { active: 'Active', inactive: 'Paused', pending: 'Needs approval' };
const emptyForm = () => ({ name: '', email: '', password: '', confirmation: '' });

function dateLabel(value) {
  if (!value) return 'Not signed in yet';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not available' : new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function randomPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*';
  const randomIndex = max => {
    const bytes = new Uint32Array(1);
    const limit = Math.floor(0x100000000 / max) * max;
    do { crypto.getRandomValues(bytes); } while (bytes[0] >= limit);
    return bytes[0] % max;
  };
  const characters = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789', '!@#$%&*'].map(group => group[randomIndex(group.length)]);
  while (characters.length < 20) characters.push(alphabet[randomIndex(alphabet.length)]);
  for (let i = characters.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [characters[i], characters[j]] = [characters[j], characters[i]];
  }
  return characters.join('');
}

export default function AdminView({ session, onSessionExpired, onToast }) {
  const token = session?.access_token;
  const [users, setUsers] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [resetPassword, setResetPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState('');
  const [pending, setPending] = useState(false);
  const alive = useRef(false);
  const activeToken = useRef(token);
  const listRequest = useRef(0);
  const operation = useRef(false);
  const callbacks = useRef({ onSessionExpired, onToast });
  activeToken.current = token;
  callbacks.current = { onSessionExpired, onToast };

  const loadAccounts = useCallback(async (requestedPage = 1) => {
    const request = ++listRequest.current;
    setLoading(true);
    setError('');
    try {
      const result = await requestApi(`/admin/users?page=${requestedPage}&perPage=20`, { token });
      if (!alive.current || activeToken.current !== token || request !== listRequest.current) return;
      if (!Array.isArray(result.users)) throw new Error('The accounts could not be loaded. Please try again.');
      setUsers(result.users);
      setPage(result.page || requestedPage);
      setHasMore(Boolean(result.hasMore));
    } catch (issue) {
      if (!alive.current || activeToken.current !== token || request !== listRequest.current) return;
      setError(issue.status === 403 ? 'Only the administrator can manage teacher accounts.' : issue.message || 'The accounts could not be loaded. Please try again.');
      if (issue.status === 401) callbacks.current.onSessionExpired?.(issue);
    } finally {
      if (alive.current && activeToken.current === token && request === listRequest.current) setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    alive.current = true;
    operation.current = false;
    setUsers([]);
    setPage(1);
    setHasMore(false);
    setModal(null);
    setForm(emptyForm());
    setPending(false);
    setSearch('');
    setFilter('all');
    void loadAccounts(1);
    return () => { alive.current = false; listRequest.current++; };
  }, [loadAccounts]);

  function closeModal() {
    if (operation.current) return;
    setModal(null);
    setForm(emptyForm());
    setFormError('');
    setShowPassword(false);
  }

  function openCreate() {
    setForm(emptyForm());
    setFormError('');
    setShowPassword(false);
    setModal({ type: 'create' });
  }

  function openEdit(user) {
    setForm({ name: user.name || '', email: user.email, password: '' });
    setFormError('');
    setResetPassword(false);
    setModal({ type: 'edit', user });
  }

  async function saveAccount(event) {
    event?.preventDefault();
    if (operation.current || !modal) return;
    const selected = modal;
    const name = form.name.trim();
    if (selected.type !== 'status' && (!name || name.length > 80)) { setFormError('Enter a name of 1 to 80 characters.'); return; }
    if (selected.type === 'create' && (form.password.length < 12 || form.password.length > 128)) { setFormError('Choose a password of 12 to 128 characters.'); return; }
    if (selected.type === 'edit' && resetPassword) {
      if (form.password.length < 12 || form.password.length > 128 || !form.password.trim()) { setFormError('Choose a password of 12 to 128 characters.'); return; }
      if (form.password !== form.confirmation) { setFormError('The new passwords do not match.'); return; }
    }
    operation.current = true;
    setPending(true);
    setFormError('');
    try {
      const create = selected.type === 'create';
      const body = create ? { name, email: form.email.trim(), password: form.password } : selected.type === 'edit' ? { name, ...(resetPassword ? { password: form.password } : {}) } : { status: selected.status };
      await requestApi(create ? '/admin/users' : `/admin/users/${selected.user.id}`, { token, method: create ? 'POST' : 'PATCH', body });
      if (!alive.current || activeToken.current !== token) return;
      setForm(emptyForm());
      setModal(null);
      setShowPassword(false);
      callbacks.current.onToast?.(create ? `${name}'s teacher account is ready.` : selected.type === 'edit' ? 'Teacher details updated.' : selected.status === 'active' ? 'Teacher access is now active.' : 'Teacher access is paused. Their classrooms are saved.');
      await loadAccounts(page);
    } catch (issue) {
      if (!alive.current || activeToken.current !== token) return;
      setFormError(issue.status === 403 ? 'Only the administrator can make this change.' : issue.message || 'This change could not be saved. Please try again.');
      if (issue.status === 401) callbacks.current.onSessionExpired?.(issue);
    } finally {
      if (alive.current && activeToken.current === token) { operation.current = false; setPending(false); }
    }
  }

  const query = search.trim().toLowerCase();
  const filtered = users.filter(user => (!query || `${user.name || ''} ${user.email}`.toLowerCase().includes(query)) && (filter === 'all' || user.status === filter));
  const activeTeachers = users.filter(user => user.role !== 'admin' && user.status === 'active').length;
  const pendingTeachers = users.filter(user => user.role !== 'admin' && user.status === 'pending').length;
  const disabled = pending || loading || Boolean(error);

  return <section className="admin-view" aria-label="Account management">
    <header className="admin-heading"><div><span className="eyebrow"><span />A LITTLE ROOM TO GROW</span><h1>Account management<ShieldCheck size={29} strokeWidth={1.5} aria-hidden="true" /></h1><p>Welcome teachers into Sprout. Only you can create and approve their accounts.</p></div><button className="button button-primary" disabled={disabled} onClick={openCreate}><Plus size={18} aria-hidden="true" />Create teacher</button></header>

    <div className="admin-overview" aria-label="Access overview">
      <div className="admin-owner-note"><span className="admin-overview-icon"><KeyRound size={22} strokeWidth={1.6} aria-hidden="true" /></span><div><strong>Account creation stays with you</strong><p>Teachers sign in with the account you provide.</p></div><span className="admin-owner-pill"><ShieldCheck size={13} aria-hidden="true" />Admin only</span></div>
      <div className="admin-counts"><div><span><UserCheck size={16} aria-hidden="true" />Active teachers</span><strong>{loading ? '—' : activeTeachers}</strong><small>on this page</small></div><div><span><UserRound size={16} aria-hidden="true" />Awaiting approval</span><strong>{loading ? '—' : pendingTeachers}</strong><small>on this page</small></div></div>
    </div>

    <section className="admin-accounts" aria-labelledby="admin-accounts-title" aria-busy={loading}>
      <div className="admin-panel-heading"><div><span className="admin-panel-icon"><Users size={21} strokeWidth={1.6} aria-hidden="true" /></span><div><h2 id="admin-accounts-title">Your teaching community</h2><p>A clear view of who can open a classroom.</p></div></div><button type="button" className="icon-button" disabled={pending || loading} aria-label="Refresh accounts" onClick={() => loadAccounts(page)}><RefreshCw size={17} className={loading ? 'admin-spin' : ''} aria-hidden="true" /></button></div>
      <div className="admin-toolbar"><label className="admin-search"><Search size={17} aria-hidden="true" /><input type="search" aria-label="Search accounts on this page" placeholder="Find a name or email on this page" value={search} onChange={event => setSearch(event.target.value)} />{search && <button type="button" aria-label="Clear account search" onClick={() => setSearch('')}><X size={15} aria-hidden="true" /></button>}</label><label className="admin-status-filter"><span>Status</span><select aria-label="Filter account status on this page" value={filter} onChange={event => setFilter(event.target.value)}><option value="all">All accounts</option><option value="active">Active</option><option value="pending">Needs approval</option><option value="inactive">Paused</option></select><ChevronDown size={14} aria-hidden="true" /></label></div>
      {error ? <div className="admin-empty admin-error" role="alert"><ShieldCheck size={30} strokeWidth={1.5} aria-hidden="true" /><h3>Let’s reconnect your accounts</h3><p>{error}</p><button className="button button-secondary button-small" onClick={() => loadAccounts(page)}>Try again</button></div> : loading ? <div className="admin-empty" role="status"><LoaderCircle className="admin-spin" size={28} aria-hidden="true" /><p>Opening your teaching community…</p></div> : filtered.length ? <div className="admin-table-wrap"><table className="admin-table"><caption className="sr-only">Teacher accounts on page {page}</caption><thead><tr><th scope="col">Teacher</th><th scope="col">Access</th><th scope="col">Last sign-in</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead><tbody>{filtered.map(user => {
        const isOwner = user.role === 'admin' || user.id === session?.user.id;
        const label = user.name || user.email;
        return <tr key={user.id}><td><div className="admin-person"><span className={`admin-person-avatar ${isOwner ? 'admin-person-owner' : ''}`} aria-hidden="true">{isOwner ? <ShieldCheck size={18} /> : (user.name || user.email || 'T').slice(0, 1).toUpperCase()}</span><div><strong>{user.name || 'Teacher'}{isOwner && <span className="admin-you">You</span>}</strong><span>{user.email}</span></div></div></td><td data-label="Access"><span className={`admin-status admin-status-${isOwner ? 'owner' : user.status}`}><i />{isOwner ? 'Administrator' : STATUS_NAMES[user.status] || 'Needs approval'}</span></td><td data-label="Last sign-in"><time dateTime={user.lastSignInAt || undefined}>{dateLabel(user.lastSignInAt)}</time></td><td><div className="admin-row-actions">{isOwner ? <span className="admin-owner-label"><ShieldCheck size={13} aria-hidden="true" />Owner account</span> : <><button type="button" className="admin-edit" disabled={pending} aria-label={`Edit ${label}`} onClick={() => openEdit(user)}><Pencil size={14} aria-hidden="true" />Edit</button><button type="button" className={`admin-access-action ${user.status === 'active' ? 'admin-pause-action' : ''}`} disabled={pending} aria-label={`${user.status === 'active' ? 'Pause' : user.status === 'pending' ? 'Approve' : 'Restore'} access for ${label}`} onClick={() => { setFormError(''); setModal({ type: 'status', user, status: user.status === 'active' ? 'inactive' : 'active' }); }}>{user.status === 'active' ? 'Pause access' : user.status === 'pending' ? 'Approve access' : 'Restore access'}</button></>}</div></td></tr>;
      })}</tbody></table></div> : <div className="admin-empty"><Sprout size={32} strokeWidth={1.5} aria-hidden="true" /><h3>{users.length ? 'No accounts match this view' : 'A place for your first teacher'}</h3><p>{users.length ? 'Try another name, email, or status on this page.' : 'Create a teacher account to welcome someone into Sprout.'}</p>{users.length ? <button className="text-button" onClick={() => { setSearch(''); setFilter('all'); }}>Clear filters</button> : <button className="button button-secondary button-small" onClick={openCreate}><Plus size={16} aria-hidden="true" />Create teacher</button>}</div>}
      <footer className="admin-pagination"><span>{loading ? 'Loading accounts' : error ? 'Accounts unavailable' : `${filtered.length} ${filtered.length === 1 ? 'account' : 'accounts'} shown on this page`}</span><div><button type="button" className="icon-button" aria-label="Previous accounts page" disabled={disabled || page === 1} onClick={() => { setSearch(''); setFilter('all'); loadAccounts(page - 1); }}><ArrowLeft size={16} aria-hidden="true" /></button><span>Page {page}</span><button type="button" className="icon-button" aria-label="Next accounts page" disabled={disabled || !hasMore} onClick={() => { setSearch(''); setFilter('all'); loadAccounts(page + 1); }}><ArrowRight size={16} aria-hidden="true" /></button></div></footer>
    </section>
    <p className="admin-footnote"><ShieldCheck size={15} aria-hidden="true" />Pausing access keeps a teacher’s classrooms and students saved.</p>

    {(modal?.type === 'create' || modal?.type === 'edit') && <Dialog title={modal.type === 'create' ? 'Welcome a teacher' : 'Teacher details'} subtitle={modal.type === 'create' ? 'A fresh beginning for another classroom.' : 'Keep your teaching community up to date.'} onClose={closeModal}><form className="admin-account-form stack" onSubmit={saveAccount} aria-busy={pending}>
      <label className="field"><span className="label">Teacher name</span><input className="input" name="name" autoComplete="off" value={form.name} required maxLength={80} disabled={pending} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} placeholder="e.g. Alex Rivera" /></label>
      <label className="field"><span className="label">Teacher email</span><input className="input" name="email" type="email" autoComplete="off" value={form.email} required maxLength={254} disabled={pending || modal.type === 'edit'} spellCheck={false} onChange={event => setForm(current => ({ ...current, email: event.target.value }))} placeholder="teacher@school.edu" /></label>
      {modal.type === 'create' && <><div className="field"><div className="admin-password-label"><label htmlFor="admin-teacher-password" className="label">Password</label><button type="button" className="text-button" disabled={pending} onClick={() => { setForm(current => ({ ...current, password: randomPassword() })); setShowPassword(true); }}><KeyRound size={13} aria-hidden="true" />Generate password</button></div><div className="admin-password-input"><input id="admin-teacher-password" className="input" name="password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" aria-describedby="admin-password-hint" value={form.password} required minLength={12} maxLength={128} disabled={pending} onChange={event => setForm(current => ({ ...current, password: event.target.value }))} placeholder="At least 12 characters" /><button type="button" className="icon-button" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} disabled={pending} onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}</button></div><small id="admin-password-hint" className="form-note">Use 12–128 characters. Save this password before creating the account.</small></div><div className="admin-credentials-note"><KeyRound size={19} aria-hidden="true" /><p>Share the email and password privately with this teacher. Sprout won’t email their credentials or show the password again.</p></div></>}
      {modal.type === 'edit' && <div className="teacher-password-section stack">{resetPassword ? <><div className="admin-password-label"><strong className="label">Change teacher password</strong><button type="button" className="text-button" disabled={pending} onClick={() => { setResetPassword(false); setForm(current => ({ ...current, password: '', confirmation: '' })); setFormError(''); }}>Keep current password</button></div><PasswordField label="New password" value={form.password} onChange={password => setForm(current => ({ ...current, password }))} disabled={pending} /><PasswordField label="Confirm new password" value={form.confirmation} onChange={confirmation => setForm(current => ({ ...current, confirmation }))} disabled={pending} /><p className="form-note">Use 12-128 characters. Share the new password privately with this teacher after saving.</p></> : <button type="button" className="button button-secondary button-full" disabled={pending} onClick={() => setResetPassword(true)}><KeyRound size={17} />Change password</button>}</div>}
      {formError && <p className="form-error" role="alert">{formError}</p>}
      <div className="dialog-actions"><button className="button button-secondary" type="button" disabled={pending} onClick={closeModal}>Cancel</button><button className="button button-primary" type="submit" disabled={pending}>{pending ? <><LoaderCircle size={16} className="admin-spin" aria-hidden="true" />Saving…</> : modal.type === 'create' ? <><Plus size={16} aria-hidden="true" />Create teacher account</> : <><Check size={16} aria-hidden="true" />Save details</>}</button></div>
    </form></Dialog>}

    {modal?.type === 'status' && <Dialog title={modal.status === 'inactive' ? 'Pause teacher access?' : modal.user.status === 'pending' ? 'Approve this teacher?' : 'Welcome them back'} subtitle={modal.user.name || modal.user.email} onClose={closeModal}><div className="admin-status-confirm"><span className="admin-confirm-icon"><ShieldCheck size={27} strokeWidth={1.5} aria-hidden="true" /></span><p>{modal.status === 'inactive' ? 'This teacher will no longer be able to open or change their classrooms. Their students, plants, and points stay saved, and you can restore access later.' : 'This teacher will be able to sign in and manage their own classrooms.'}</p><strong>{modal.user.email}</strong></div>{formError && <p className="form-error" role="alert">{formError}</p>}<div className="dialog-actions"><button type="button" className="button button-secondary" disabled={pending} onClick={closeModal}>Cancel</button><button type="button" className={`button ${modal.status === 'inactive' ? 'button-danger' : 'button-primary'}`} disabled={pending} onClick={saveAccount}>{pending ? <><LoaderCircle size={16} className="admin-spin" aria-hidden="true" />Saving…</> : modal.status === 'inactive' ? 'Pause access' : modal.user.status === 'pending' ? 'Approve access' : 'Restore access'}</button></div></Dialog>}
  </section>;
}
