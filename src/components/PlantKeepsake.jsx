import { Award, Leaf, Sparkles, Sprout, Sun } from 'lucide-react';
import Plant from './Plant.jsx';
import { plantName, stageFor } from '../lib/garden.js';
import './plant-keepsake.css';

export default function PlantKeepsake({ student, classroomName, theme = 'meadow', encouragement = 'Keep up the good work!' }) {
  const stage = stageFor(student.points);
  const decoration = [20, 50, 100, 180, 300, 500, 800].filter(points => student.points >= points).length;
  const nameSize = student.name.length > 38 ? 'long' : student.name.length > 23 ? 'medium' : 'short';
  const pointsLabel = student.points.toLocaleString('en-US');
  return <article className="plant-keepsake" data-theme={theme} data-decoration={decoration} data-rarity={stage.name} data-pot={student.points >= 800 ? 'enchanted' : student.points >= 500 ? 'golden' : student.points >= 300 ? 'sky' : 'classic'} aria-label={`${student.name}'s plant card`}>
    <div className="plant-keepsake-frame">
      {decoration >= 5 && <svg className="plant-keepsake-filigree" viewBox="0 0 300 420" preserveAspectRatio="none" aria-hidden="true"><g fill="none" stroke="currentColor" strokeWidth="1.2">{[false,true].map(flip => <g key={String(flip)} transform={flip ? 'translate(300 0) scale(-1 1)' : undefined}><path d="M7 100V32Q7 27 14 27H45M9 72Q28 56 13 41Q8 57 9 72M9 59Q30 50 29 35Q12 38 9 59M7 320V387Q7 393 15 393H43M9 350Q26 369 13 380Q7 366 9 350" /></g>)}</g></svg>}
      {decoration >= 6 && <div className="plant-keepsake-foil" aria-hidden="true" />}
      {decoration >= 7 && <div className="plant-keepsake-jewels" aria-hidden="true"><span>&#9670;</span><span>&#9670;</span></div>}
      <header className="plant-keepsake-brand"><span><Sprout aria-hidden="true" />SPROUT</span><span>GARDEN KEEPSAKE</span></header>
      <div className="plant-keepsake-identity">
        <h3 data-length={nameSize}>{student.name}</h3>
        <p>{plantName(student.plant)}</p>
      </div>
      <div className="plant-keepsake-scene">
        {decoration >= 2 && <div className="plant-keepsake-halo" aria-hidden="true" />}
        {decoration >= 3 && <div className="plant-keepsake-orbit" aria-hidden="true" />}
        {decoration >= 4 && <span className="plant-keepsake-spark plant-keepsake-spark-one" aria-hidden="true">✦</span>}
        {decoration >= 4 && <span className="plant-keepsake-spark plant-keepsake-spark-two" aria-hidden="true">✧</span>}
        {decoration >= 4 && <span className="plant-keepsake-spark plant-keepsake-spark-three" aria-hidden="true">✦</span>}
        {decoration >= 3 && <Leaf className="plant-keepsake-leaf plant-keepsake-leaf-left" aria-hidden="true" />}
        {decoration >= 3 && <Leaf className="plant-keepsake-leaf plant-keepsake-leaf-right" aria-hidden="true" />}
        <Plant seed={student.id} type={student.plant} points={student.points} animate={false} className="plant-keepsake-plant" />
        <span className="plant-keepsake-stage"><Sparkles aria-hidden="true" />{stage.name}</span>
      </div>
      <div className="plant-keepsake-growth">
        <div className="plant-keepsake-points"><Sun aria-hidden="true" /><div><strong data-length={pointsLabel.length > 7 ? 'long' : 'short'}>{pointsLabel}</strong><span>GROWTH POINTS</span></div><p>Little efforts.<br />Wonderful growth.</p></div>
        <div className="plant-keepsake-achievement" aria-label="Plant achievement">
          <Award aria-hidden="true" />
          <div><span>GROWING WITH PRIDE</span><strong>{stage.name}</strong></div>
          <p>{encouragement}</p>
        </div>
      </div>
      <footer className="plant-keepsake-footer"><span>PROUDLY GROWING WITH</span><strong data-length={classroomName.length > 50 ? 'long' : 'short'}>{classroomName}</strong></footer>
    </div>
  </article>;
}
