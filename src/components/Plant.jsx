import { useEffect, useId, useRef, useState } from 'react';
import Foliage from './PlantFoliage.jsx';
import { STAGES } from '../lib/garden.js';
import './plant-rewards.css';

function maturityFor(points) {
  return Math.max(0, STAGES.findLastIndex(stage => points >= stage.at));
}

function useGrowingPlant(points, animate) {
  const [displayed, setDisplayed] = useState(() => ({ points, maturity: maturityFor(points) }));
  const current = useRef(displayed);
  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const target = { points, maturity: maturityFor(points) };
    let frame;
    const finish = () => { cancelAnimationFrame(frame); current.current = target; setDisplayed(target); };
    if (!animate || motion.matches || (current.current.points === points && current.current.maturity === target.maturity)) { finish(); return; }
    const from = current.current;
    const start = performance.now();
    const step = now => {
      const progress = Math.min(1, (now - start) / 5000);
      const eased = progress * progress * (3 - 2 * progress);
      current.current = progress === 1 ? target : {
        points: from.points + (points - from.points) * eased,
        maturity: from.maturity + (target.maturity - from.maturity) * eased,
      };
      setDisplayed(current.current);
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    const preferenceChanged = () => { if (motion.matches) finish(); };
    motion.addEventListener('change', preferenceChanged);
    return () => { cancelAnimationFrame(frame); motion.removeEventListener('change', preferenceChanged); };
  }, [points, animate]);
  return displayed;
}

const palette = {
  sunflower: ['#d5916e', '#e7ab87'], daisy: ['#aebc94', '#c3cfa9'],
  tulip: ['#d29c92', '#e9b9ab'], cactus: ['#c9986b', '#e1b78a'],
  monstera: ['#a6b8a4', '#bfceba'], lavender: ['#c1adc9', '#d5c1dc'],
  strawberry: ['#d9a17c', '#ebbd98'],
  hibiscus: ['#ce9992', '#edbeb0'], rose: ['#b38c9f', '#d7b1c1'],
  marigold: ['#ccaa70', '#e9cd98'], bonsai: ['#7fa4a0', '#adc8bc'],
};

export default function Plant({ type = 'sunflower', points = 0, className = '', animate = true, happy = false, seed = 'preview' }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const grown = useGrowingPlant(points, animate);
  const grownPoints = Math.max(0, grown.points);
  const stage = maturityFor(grownPoints);
  const growing = animate && (grownPoints < points || grown.maturity < maturityFor(points));
  const height = 24 + 106 * (1 - Math.exp(-grownPoints / 100));
  const widthScale = .8 + .2 * (1 - Math.exp(-grownPoints / 150));
  const colors = grownPoints >= 800 ? ['#8b78b4', '#c4b0e3'] : grownPoints >= 500 ? ['#c39343', '#f0d58e'] : grownPoints >= 300 ? ['#659cad', '#aed5dc'] : palette[type] || palette.sunflower;
  return <svg viewBox="0 0 160 190" className={`${className}${growing ? ' plant-is-growing' : ''}`} data-growth-points={grownPoints} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs><linearGradient id={`pot-${id}`} x1="0" x2="1"><stop stopColor={colors[1]} /><stop offset="1" stopColor={colors[0]} /></linearGradient></defs>
    <ellipse cx="80" cy="178" rx="39" ry="6" fill="#496844" opacity=".1" />
    <g className={animate ? 'plant-foliage' : ''} style={{ transformOrigin: '80px 145px' }}>
      <g className="growth-motion">
      <g data-growth-stage={stage} transform={`translate(80 145) scale(${widthScale} 1) translate(-80 -145)`}>
        <g className="plant-shape"><Foliage type={type} maturity={grown.maturity} height={height} seed={seed} /></g>
      </g>
      </g>
    </g>
    <path d="M48 140L54 173Q55 179 63 180H97Q105 179 106 173L112 140Z" fill={`url(#pot-${id})`} />
    <path d="M53 143L58 170Q59 175 64 175" stroke="#fff6df" opacity=".28" strokeWidth="3" fill="none" strokeLinecap="round" />
    <rect x="44" y="136" width="72" height="13" rx="5" fill={colors[1]} />
    <path d="M49 148H111" stroke={colors[0]} strokeWidth="2" opacity=".4" />
    <g className={animate ? 'plant-eyes' : ''} fill="#604d40" style={{ transformOrigin: '80px 160px' }}><ellipse cx="70" cy="160" rx="2.2" ry="2.8" /><ellipse cx="90" cy="160" rx="2.2" ry="2.8" /></g>
    <path d={happy ? 'M74 165Q80 178 86 165Z' : 'M76 166Q80 170 84 166'} fill={happy ? '#a96e65' : 'none'} stroke="#725440" strokeWidth="1.7" strokeLinecap="round" />
    <g fill="#ca796d" opacity=".38"><ellipse cx="64" cy="165" rx="4" ry="2.3" /><ellipse cx="96" cy="165" rx="4" ry="2.3" /></g>
    {stage >= 4 && <g fill="#d6b559"><path d="M129 44l2.1 6.9L138 53l-6.9 2.1L129 62l-2.1-6.9L120 53l6.9-2.1Z" /><path d="M31 71l1.4 4.6L37 77l-4.6 1.4L31 83l-1.4-4.6L25 77l4.6-1.4Z" opacity=".75" /></g>}
    {grownPoints >= 100 && <g data-reward="sign"><path d="M28 178V153" stroke="#a48861" strokeWidth="3" /><rect x="16" y="144" width="24" height="15" rx="3" fill="#f3dfb0" stroke="#b59a69" /><path d="M28 155v-7m0 4q-7 0-6-5q6 0 6 5m0-1q6 0 6-5q-6 0-6 5" fill="#789758" /></g>}
    {grownPoints >= 180 && <g data-reward="ribbon"><path d="M102 153l-3 15 6-4 5 5 1-16" fill="#dfaa66" /><circle cx="107" cy="152" r="7" fill="#f4d78b" /><path d="m104 152 2 2 4-4" stroke="#a87936" strokeWidth="1.5" fill="none" /></g>}
    {grownPoints >= 500 && <g data-reward="ladybug" transform="translate(126 167)"><ellipse rx="7" ry="8" fill="#d87870" /><circle cy="-7" r="3" fill="#475946" /><path d="M0-4V7" stroke="#475946" /><g fill="#475946"><circle cx="-3" cy="-1" r="1.3" /><circle cx="3" cy="3" r="1.3" /></g></g>}
    {grownPoints >= 800 && <g data-reward="fireflies" className={animate ? 'earned-fireflies' : ''} fill="#ead27b"><circle cx="24" cy="110" r="2.5" /><circle cx="137" cy="89" r="2" /><circle cx="48" cy="28" r="2" /></g>}
  </svg>;
}
