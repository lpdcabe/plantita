import { useState } from 'react';
import Dialog from './Dialog.jsx';

export default function ClassroomDialog({ pending, ready, onCreate, onClose }) {
  const [name, setName] = useState('');
  const [validation, setValidation] = useState('');
  return <Dialog title="Create a class" subtitle="A separate garden for your new class." onClose={onClose}>
    <form className="stack" onSubmit={async event => { event.preventDefault(); if (!name.trim()) { setValidation('Enter a class name.'); return; } setValidation(''); await onCreate(name.trim()); }}>
      <label className="field"><span>New class name</span><input className="input" maxLength={80} required placeholder="e.g. Grade 3 - Maple" value={name} onChange={event => setName(event.target.value)} disabled={pending} /></label>
      {validation && <p className="form-error" role="alert">{validation}</p>}
      <p className="form-note">Your new class starts with an empty garden. Your other classes stay saved.</p>
      <div className="dialog-actions"><button className="button button-secondary" type="button" disabled={pending} onClick={onClose}>Cancel</button><button className="button button-primary" type="submit" disabled={pending || !ready}>{pending ? 'Creating...' : 'Create class'}</button></div>
    </form>
  </Dialog>;
}