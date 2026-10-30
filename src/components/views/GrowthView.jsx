import { useMemo, useState } from 'react';
import { ArrowRight, Flower2, Leaf, Search, Sun, Trophy } from 'lucide-react';
import Plant from '../Plant.jsx';
import { Empty, Progress } from '../ui.jsx';
import { plantName, stageFor } from '../../lib/garden.js';

export default function GrowthView({ students, ready, pending, onAward }) {
  const [search, setSearch] = useState('');
  const ranked = useMemo(() => [...students].sort((a, b) => b.points - a.points || a.name.localeCompare(b.name)), [students]);
  const filtered = ranked.filter(student => student.name.toLowerCase().includes(search.trim().toLowerCase()));
  return <section className="content-panel growth-panel">
    <div className="section-heading"><div><span className="eyebrow">EVERY LITTLE EFFORT COUNTS</span><h2>Growing, together.</h2><p>Every child grows at their own pace. Every step is worth celebrating.</p></div><label className="search-field"><Search size={17} /><input aria-label="Search growth board" placeholder="Find a student" value={search} onChange={event => setSearch(event.target.value)} /></label></div>
    {filtered.length ? <div className="growth-list">{filtered.map(student => {
      const rank = ranked.indexOf(student) + 1;
      return <button className="growth-row" key={student.id} onClick={() => onAward([student.id])} disabled={!ready || pending}>
        <span className={`growth-rank ${rank < 4 ? 'rank-top' : ''}`}>{rank === 1 ? <Trophy size={19} /> : String(rank).padStart(2, '0')}</span>
        <Plant seed={student.id} type={student.plant} points={student.points} className="growth-plant" animate={false} />
        <div className="growth-student"><strong>{student.name}</strong><span>{plantName(student.plant)}</span></div>
        <span className={`stage-badge ${student.points >= 100 ? 'bloom' : ''}`}>{student.points >= 100 ? <Flower2 size={14} /> : <Leaf size={14} />}{stageFor(student.points).name}</span>
        <div className="growth-bar"><Progress label={`${student.name}'s total growth`} value={student.points} max={Math.max(180, ranked[0].points)} /></div>
        <strong className="growth-score"><Sun size={16} />{student.points}<small>pts</small></strong><ArrowRight className="growth-arrow" size={18} />
      </button>;
    })}</div> : <Empty title={students.length ? 'No growers found' : 'Your story starts here'} text={students.length ? 'Try searching for another name.' : 'Add a student and celebrate their first little win.'} />}
  </section>;
}
