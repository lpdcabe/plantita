import { useMemo, useState } from 'react';
import { ArrowUpDown, Flower2, MoreHorizontal, Plus, Printer, Search, Sun, X } from 'lucide-react';
import Plant from '../Plant.jsx';
import { Empty, Progress } from '../ui.jsx';
import { nextStage, plantName, stageFor } from '../../lib/garden.js';

export default function StudentsView({ students, ready, pending, onEdit, onAward, onAdd, onPreview }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('name');
  const filtered = useMemo(() => students.filter(student => student.name.toLowerCase().includes(search.trim().toLowerCase()) && (filter === 'all' || (filter === 'bloom' ? student.points >= 100 : student.points < 100))).sort((a, b) => sort === 'points' ? b.points - a.points || a.name.localeCompare(b.name) : a.name.localeCompare(b.name)), [students, search, filter, sort]);
  return <section className="content-panel students-panel" aria-label="Students">
    <div className="list-toolbar"><div className="filter-tabs" aria-label="Filter students">{[['all', `All plants · ${students.length}`], ['growing', 'Growing'], ['bloom', 'In bloom']].map(([id, label]) => <button key={id} className={filter === id ? 'active' : ''} aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>)}</div><div className="list-tools"><label className="search-field"><Search size={17} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Find a student" aria-label="Search students" />{search && <button aria-label="Clear student search" onClick={() => setSearch('')}><X size={14} /></button>}</label><label className="sort-field"><ArrowUpDown size={15} /><select aria-label="Sort students" value={sort} onChange={event => setSort(event.target.value)}><option value="name">Name A–Z</option><option value="points">Most growth</option></select></label></div></div>
    {filtered.length ? <div className="student-grid">{filtered.map(student => {
      const stage = stageFor(student.points), next = nextStage(student.points);
      return <article className="student-card" key={student.id}>
        <div className="student-card-top"><span className={`stage-badge ${student.points >= 100 ? 'bloom' : ''}`}><Flower2 size={13} />{stage.name}</span><button className="student-edit icon-button" disabled={pending || !ready} aria-label={`Edit ${student.name}`} onClick={() => onEdit(student)}><MoreHorizontal size={20} /></button></div>
        <button className="student-plant-button student-card-preview" disabled={!ready} onClick={() => onPreview(student.id)} aria-label={`View and print ${student.name}'s plant card`} aria-haspopup="dialog"><Plant seed={student.id} type={student.plant} points={student.points} className="student-card-plant" /><span className="student-card-print-hint"><Printer size={13} />View &amp; print card</span></button>
        <h3 title={student.name}>{student.name}</h3><p>{plantName(student.plant)}</p>
        <div className="student-progress-label"><span><Sun size={14} />{student.points} points</span><span>{next ? `${next.at - student.points} to grow` : 'Fully bloomed'}</span></div>
        <Progress label={`${student.name}'s growth`} value={next ? student.points - stage.at : 1} max={next ? next.at - stage.at : 1} />
        <button className="button button-secondary button-full" disabled={pending || !ready} onClick={() => onAward([student.id])}><Plus size={16} />Give points</button>
      </article>;
    })}</div> : <Empty title={students.length ? 'No little growers found' : 'Room for a new beginning'} text={students.length ? 'Try another name or choose a different growth stage.' : 'Add your students and give everyone a place to grow.'}>{!students.length && <button className="button button-primary" disabled={!ready} onClick={onAdd}><Plus size={16} />Add student</button>}</Empty>}
  </section>;
}
