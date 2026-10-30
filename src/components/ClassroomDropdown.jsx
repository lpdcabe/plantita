import { useEffect, useId, useRef, useState } from 'react';
import { BookOpen, Check, ChevronDown, Plus } from 'lucide-react';

export default function ClassroomDropdown({ current, classrooms, ready, pending, loading, error, onRefresh, onSelect, onCreate }) {
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const trigger = useRef(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const outside = event => { if (!root.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  function keyboard(event) {
    if (event.key === 'Escape' && open) { event.preventDefault(); setOpen(false); trigger.current?.focus(); }
    if (!open || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const items = [...root.current.querySelectorAll('.class-dropdown-panel button:not(:disabled)')];
    const index = items.indexOf(document.activeElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : event.key === 'ArrowDown' ? (index + 1) % items.length : (index <= 0 ? items.length : index) - 1;
    items[next]?.focus();
  }
  return <div className="class-dropdown" ref={root} onKeyDown={keyboard} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <button ref={trigger} className="class-switch" aria-label="Switch or create classroom" aria-expanded={open} aria-controls={id} disabled={!ready || pending} onClick={() => { if (!open) onRefresh(); setOpen(value => !value); }}>{current.id === 'loading' ? 'Create your first class' : current.name}<ChevronDown size={15} /></button>
    {open && <div id={id} className="class-dropdown-panel" role="group" aria-label="Your classrooms">
      <p className="class-dropdown-title">YOUR CLASSROOMS</p>
      {loading && <p role="status" className="form-note">Loading classes…</p>}
      {error && <div role="alert"><p className="form-note">Couldn’t load your classes.</p><button className="text-button" onClick={onRefresh}>Try again</button></div>}
      <div className="class-dropdown-list">{classrooms.map(item => <button key={item.id} className={`classroom-option${item.id === current.id ? ' selected' : ''}`} disabled={!ready || pending || loading} aria-label={`Open ${item.name}`} aria-current={item.id === current.id ? 'true' : undefined} onClick={async () => { if (await onSelect(item.id)) { setOpen(false); trigger.current?.focus(); } }}><BookOpen size={17} /><span>{item.name}</span>{item.id === current.id && <Check size={16} />}</button>)}</div>
      <button className="class-dropdown-create" disabled={!ready || pending || loading} onClick={() => { setOpen(false); trigger.current?.focus(); onCreate(); }}><Plus size={17} />Create class</button>
    </div>}
  </div>;
}
