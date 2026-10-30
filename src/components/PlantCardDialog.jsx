import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Printer } from 'lucide-react';
import Dialog from './Dialog.jsx';
import PlantKeepsake from './PlantKeepsake.jsx';
import './plant-card-dialog.css';
import { earnedRewards } from '../lib/garden.js';

const THEMES = [
  { id: 'meadow', name: 'Meadow' },
  { id: 'sunset', name: 'Sunset' },
  { id: 'moonlight', name: 'Moonlight' },
];

const ENCOURAGEMENTS = [
  'Very good!', 'Excellent!', 'Keep up the good work!', 'Wonderful effort!',
  'You are doing great!', 'Keep growing!', 'Fantastic work!', 'Way to go!',
  'Your effort shines!', 'You can be proud!', 'Keep trying new things!',
  'Look how far you have grown!', 'You did it!', 'Great job!',
  'Small steps, big progress!', 'Keep believing in yourself!',
];

export default function PlantCardDialog({ student, classroomName, onClose }) {
  const [theme, setTheme] = useState('meadow');
  const [encouragement] = useState(() => ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)]);
  const card = <PlantKeepsake student={student} classroomName={classroomName} theme={theme} encouragement={encouragement} />;

  return <>
    <Dialog title="A little card. A lot of growth." subtitle="A keepsake of their effort, ready to take home." onClose={onClose}>
      <div className="plant-card-controls" role="group" aria-label="Card design">
        {THEMES.map(option => <button
          type="button"
          key={option.id}
          className="plant-card-theme"
          data-theme={option.id}
          aria-pressed={theme === option.id}
          onClick={() => setTheme(option.id)}
        ><span className="plant-card-swatch" aria-hidden="true">{theme === option.id && <Check size={12} />}</span>{option.name}</button>)}
      </div>
      <div className="plant-card-preview-stage">{card}</div>
      <div className="plant-reward-summary" aria-label="Earned plant rewards">{earnedRewards(student.points).map(reward => <span key={reward.at}>{reward.name}</span>)}</div>
      <div className="plant-card-print-actions">
        <p>70 × 98 mm keepsake · Print at 100% scale.<br />Choose Save as PDF in the print window to keep a copy.</p>
        <button type="button" className="button button-primary button-full" onClick={() => window.print()}><Printer size={17} />Print card</button>
      </div>
    </Dialog>
    {/* A separate print surface keeps the dialog scroll position and app layout
        out of the printed page. It exists only while this preview is open. */}
    {createPortal(<div className="plant-card-print-root" aria-hidden="true">{card}</div>, document.body)}
  </>;
}
