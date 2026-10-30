import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Flower2, Heart, Leaf, Maximize2, Minimize2, Moon, Plus, Search, Sparkles, Sprout, Sun, Type, X } from 'lucide-react';
import Plant from '../Plant.jsx';
import { GardenBackdrop, WateringCan } from '../GardenScenery.jsx';
import { nextStage, plantName, stageFor, REASONS } from '../../lib/garden.js';

const FILTERS = [{ id: 'all', label: 'All plants' }, { id: 'growing', label: 'Growing' }, { id: 'bloom', label: 'In bloom' }];
const SCENE_PADDING = 72;
const TILE_GAP = 14;
const MIN_TILE_HEIGHT = 178;

function layoutFor(width, height, fullscreen) {
  const usableWidth = Math.max(0, width - 36);
  const columns = usableWidth < 420 ? 2 : usableWidth < 650 ? 3 : fullscreen && usableWidth >= 1150 ? 6 : 4;
  const possibleRows = Math.max(1, Math.floor((height - SCENE_PADDING + TILE_GAP) / (MIN_TILE_HEIGHT + TILE_GAP)));
  const rows = Math.min(fullscreen ? 6 : 3, possibleRows);
  return { columns, rows, capacity: columns * rows };
}

function tiltPlant(event) {
  if (event.pointerType === 'touch' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const target = event.currentTarget;
  const bounds = target.getBoundingClientRect();
  const x = ((event.clientX - bounds.left) / Math.max(1, bounds.width) - .5) * 9;
  const y = ((event.clientY - bounds.top) / Math.max(1, bounds.height) - .5) * -7;
  target.style.setProperty('--tilt-x', `${x.toFixed(1)}deg`);
  target.style.setProperty('--tilt-y', `${y.toFixed(1)}deg`);
}

function resetTilt(event) {
  event.currentTarget.style.removeProperty('--tilt-x');
  event.currentTarget.style.removeProperty('--tilt-y');
}

export default function GardenView({ students = [], classroom, ready = true, pending = false, onAward, onAdd, onThemeChange, celebration = null }) {
  const gardenRef = useRef(null);
  const sceneRef = useRef(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState('');
  const [showNames, setShowNames] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [sceneSize, setSceneSize] = useState({ width: 800, height: 560 });
  const [reasonChoice, setReasonChoice] = useState(REASONS[0].label);
  const [reason, setReason] = useState(REASONS[0].label);
  const [points, setPoints] = useState(10);
  const [watering, setWatering] = useState(false);
  const [playMode, setPlayMode] = useState(false);
  const [playing, setPlaying] = useState(null);
  const [goalParty, setGoalParty] = useState(false);
  const seenParty = useRef(null);
  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(() => setPlaying(null), 2600);
    return () => clearTimeout(timer);
  }, [playing]);
  useEffect(() => {
    if (!celebration || seenParty.current === celebration.key) return;
    seenParty.current = celebration.key;
    const previous = Object.values(celebration.previousPoints || {}).reduce((sum, value) => sum + value, 0);
    const total = students.reduce((sum, student) => sum + student.points, 0);
    if (previous < classroom.goal && total >= classroom.goal) setGoalParty(true);
  }, [celebration, students, classroom.goal]);
  useEffect(() => {
    if (!goalParty) return;
    const timer = setTimeout(() => setGoalParty(false), 6500);
    return () => clearTimeout(timer);
  }, [goalParty]);
  const wateringLock = useRef(false);
  const wateringTimer = useRef(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; clearTimeout(wateringTimer.current); }; }, []);
  async function water(ids) {
    if (!ready || pending || wateringLock.current) return;
    wateringLock.current = true; setWatering(true);
    let saved = false;
    try { saved = await onAward?.(ids, Number(points), reason); }
    finally {
      if (mounted.current) {
        const release = () => { wateringLock.current = false; setWatering(false); };
        if (saved) wateringTimer.current = setTimeout(release, 1800);
        else release();
      }
    }
  }
  const theme = classroom?.theme || 'sunshine';
  const weather = theme === 'moonlight' ? 'Dream big, little growers' : theme === 'sunset' ? 'A golden hour in our garden' : 'A beautiful day to grow';

  useEffect(() => {
    const update = () => setFullscreen(document.fullscreenElement === gardenRef.current);
    document.addEventListener('fullscreenchange', update);
    update();
    return () => document.removeEventListener('fullscreenchange', update);
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const measure = () => {
      const bounds = scene.getBoundingClientRect();
      const width = Math.round(bounds.width);
      const height = Math.round(bounds.height);
      if (!width || !height) return;
      setSceneSize(previous => previous.width === width && previous.height === height ? previous : { width, height });
    };
    measure();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(measure);
      observer.observe(scene);
      return () => observer.disconnect();
    }
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // Keep awarded plants in their current filter until their growth finishes.
  const filterPoints = useMemo(() => new Map(students.map(student => {
    const awarded = celebration && (celebration.studentIds === 'all' || celebration.studentIds?.includes(student.id));
    return [student.id, awarded ? celebration.previousPoints?.[student.id] ?? student.points : student.points];
  })), [students, celebration]);
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return students.filter(student => (
      (!query || `${student.name} ${plantName(student.plant)}`.toLocaleLowerCase().includes(query))
      && (filter === 'all' || (filter === 'bloom' ? filterPoints.get(student.id) >= 100 : filterPoints.get(student.id) < 100))
    ));
  }, [students, search, filter, filterPoints]);
  const layout = layoutFor(sceneSize.width, sceneSize.height, fullscreen);
  const pageCount = Math.max(1, Math.ceil(filtered.length / layout.capacity));
  const currentPage = Math.min(page, pageCount - 1);
  const firstIndex = currentPage * layout.capacity;
  const visibleStudents = filtered.slice(firstIndex, firstIndex + layout.capacity);
  const gridRows = Math.max(1, Math.min(layout.rows, Math.ceil(visibleStudents.length / layout.columns)));
  const counts = { all: students.length, growing: students.filter(student => filterPoints.get(student.id) < 100).length, bloom: students.filter(student => filterPoints.get(student.id) >= 100).length };

  useEffect(() => { setPage(previous => Math.min(previous, pageCount - 1)); }, [pageCount]);

  async function toggleFullscreen() {
    setFullscreenError('');
    try {
      if (document.fullscreenElement === gardenRef.current) {
        await document.exitFullscreen();
      } else if (gardenRef.current?.requestFullscreen) {
        await gardenRef.current.requestFullscreen();
      } else {
        setFullscreenError('Full screen is unavailable in this browser. Your garden still works here.');
      }
    } catch {
      setFullscreenError('Full screen could not open. You can keep tending your garden here.');
    }
  }

  function clearFilters() { setSearch(''); setFilter('all'); setPage(0); }

  return <section ref={gardenRef} className={`garden-panel garden-interactive theme-${theme}${fullscreen ? ' is-fullscreen' : ''}`} data-fullscreen={fullscreen} aria-label="Interactive classroom garden">
    <header className="garden-toolbar">
      <div className="garden-title"><span className="garden-title-icon"><Sprout size={22} /></span><div className="garden-title-copy"><h2>Our class garden</h2><p><i />Little efforts. Lovely growth.</p></div></div>
      <div className="garden-controls">
        <label className="garden-theme-control">
          <span className="sr-only">Garden theme</span>{theme === 'moonlight' ? <Moon size={17} /> : <Sun size={17} />}
          <select aria-label="Garden theme" value={theme} disabled={!ready || pending} onChange={event => onThemeChange?.(event.target.value)}>
            <option value="sunshine">Sunny day</option><option value="sunset">Golden hour</option><option value="moonlight">Moonlight</option>
          </select>
        </label>
        <button type="button" className={`name-toggle${showNames ? ' selected' : ''}`} aria-label={showNames ? 'Hide student names' : 'Show student names'} aria-pressed={showNames} title={showNames ? 'Hide names' : 'Show names'} onClick={() => setShowNames(value => !value)}><Type size={18} /><span>Names</span></button>
        <button type="button" className="fullscreen-button" aria-label={fullscreen ? 'Exit full screen garden' : 'Open full screen garden'} title={fullscreen ? 'Exit full screen' : 'Full screen garden'} onClick={toggleFullscreen}>{fullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}<span>{fullscreen ? 'Exit' : 'Full screen'}</span></button>
      </div>
    </header>
    <div className="garden-watering-tools" id="garden-watering-tools" role="group" aria-label="Watering tools">
      <button type="button" className="garden-play-toggle" aria-pressed={playMode} onClick={() => { setPlayMode(value => !value); setPlaying(null); }}><Heart size={16} />{playMode ? 'Play mode · no points' : 'Play with plants'}</button>
      <span className="watering-instruction"><WateringCan /><span><strong>{playMode ? 'Tap a plant to say hello' : 'Tap a plant to water it'}</strong><small>{playMode ? 'Wiggles and butterfly visits. No points awarded.' : 'Each tap gives the points you choose.'}</small></span></span>
      <label><span>Celebrate</span><select aria-label="Watering reason" value={reasonChoice} disabled={pending || watering} onChange={event => { const preset = REASONS.find(item => item.label === event.target.value); setReasonChoice(event.target.value); setReason(preset?.label || ''); if (preset) setPoints(preset.points); }}>{REASONS.map(item => <option key={item.label} value={item.label}>{item.label}</option>)}<option value="custom">Custom reason</option></select></label>
      {reasonChoice === 'custom' && <label className="watering-custom"><span>Reason</span><input aria-label="Custom watering reason" maxLength={120} value={reason} disabled={pending || watering} onChange={event => setReason(event.target.value)} placeholder="What are we celebrating?" /></label>}
      <label className="watering-amount"><span>Points per plant</span><input aria-label="Watering points" type="number" min={1} max={100} step={1} value={points} disabled={pending || watering} onChange={event => setPoints(event.target.value)} /></label>
    </div>
    <div className="garden-filterbar">
      <div className="garden-filter-tabs" role="group" aria-label="Filter garden plants">{FILTERS.map(item => <button type="button" key={item.id} className={filter === item.id ? 'active' : ''} aria-pressed={filter === item.id} onClick={() => { setFilter(item.id); setPage(0); }}>{item.label}<span>{counts[item.id]}</span></button>)}</div>
      <label className="garden-search"><Search size={16} /><input aria-label="Search garden" placeholder="Find a little grower…" value={search} onChange={event => { setSearch(event.target.value); setPage(0); }} />{search && <button type="button" aria-label="Clear garden search" onClick={() => { setSearch(''); setPage(0); }}><X size={14} /></button>}</label>
    </div>
    {fullscreenError && <div className="garden-fullscreen-error" role="status">{fullscreenError}<button type="button" aria-label="Dismiss full screen message" onClick={() => setFullscreenError('')}><X size={16} /></button></div>}
    <div className="garden-scene" ref={sceneRef}>
      <GardenBackdrop theme={theme} className="garden-backdrop" />
      {goalParty && <div className="class-celebration" role="status"><div className="class-rainbow" /><div className="class-fireflies" />{[0,1,2,3,4,5].map(index => <span key={index} className="plant-friend" style={{ '--friend': index }} />)}<div className="class-celebration-message"><strong>We grew together!</strong><span>Our class reached {classroom.goal.toLocaleString()} points.</span></div></div>}
      <div className="garden-scene-heading"><span><Heart size={14} />A little care goes a long way.</span><span className="garden-weather">{theme === 'moonlight' ? <Moon size={14} /> : <Sun size={14} />}{weather}</span></div>
      {visibleStudents.length ? <div className="plant-grid" style={{ '--garden-columns': layout.columns, '--garden-rows': gridRows, gridTemplateColumns: `repeat(${layout.columns}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${gridRows}, minmax(0, 1fr))` }}>
        {visibleStudents.map((student, index) => {
          const stage = stageFor(student.points);
          const next = nextStage(student.points);
          const progress = next ? Math.min(100, Math.max(0, (student.points - stage.at) / (next.at - stage.at) * 100)) : 100;
          const celebrated = Boolean(celebration && (celebration.studentIds === 'all' || celebration.studentIds?.includes(student.id)));
          const grewStage = celebrated && celebration.previousPoints?.[student.id] !== undefined && stage.at > stageFor(celebration.previousPoints[student.id]).at;
          return <button type="button" className={`plant-spot${celebrated ? ' is-celebrating' : ''}${grewStage ? ' is-growing' : ''}${playing?.id === student.id ? ' is-playing' : ''}`} key={student.id} style={{ '--plant-delay': `${index * -.43}s` }} aria-label={`${student.name}, ${plantName(student.plant)}, ${student.points} points. ${playMode ? 'Play with plant.' : 'Give points.'}`} disabled={!ready || pending || watering} onClick={() => playMode ? setPlaying({ id: student.id, key: Date.now() }) : water([student.id])} onPointerMove={tiltPlant} onPointerLeave={resetTilt} onBlur={resetTilt}>
            <span className="plant-art"><Plant seed={student.id} type={student.plant} points={student.points} happy={celebrated || playing?.id === student.id} /></span>
            {playing?.id === student.id && <span key={playing.key} className="plant-friend" aria-hidden="true" />}
            {showNames && <span className="plant-name"><span>{student.name}</span>{student.points >= 100 && <Flower2 size={12} />}</span>}
            <span className="plant-points"><Sun size={12} /><strong>{student.points}</strong><span>growth points</span></span>
            <span className="plant-growth">{next ? `${next.at - student.points} to ${next.name.toLowerCase()}` : <><Sparkles size={11} />Super bloomer!</>}</span>
            <span className="plant-mini-progress" aria-hidden="true"><span style={{ width: `${progress}%` }} /></span>
            <span className="plant-hover">{playMode ? <><Heart size={16} />Say hello</> : <><WateringCan />Water +{points || 0}</>}</span>
            {celebrated && <span className="plant-celebration" key={`celebrate-${celebration.key}`} aria-hidden="true"><WateringCan className="pouring-can" /><span className="point-pop">+{celebration.points}<Sun size={13} /></span><span className="plant-raindrops">{Array.from({ length: 5 }, (_, drop) => <i key={drop} style={{ '--drop-index': drop }} />)}</span></span>}
            {celebrated && <span className="growth-celebration" key={`growth-${celebration.key}`} aria-hidden="true"><span className="growth-halo" /><span className="growth-sparkles">{Array.from({ length: 6 }, (_, spark) => <Sparkles key={spark} size={16} style={{ '--spark-index': spark, left: `${15 + (spark % 3) * 32}%`, top: `${16 + Math.floor(spark / 3) * 40}%` }} />)}</span>{grewStage && <span className="growth-badge"><Sprout size={13} />{stage.name}!</span>}</span>}
          </button>;
        })}
      </div> : <div className="garden-empty"><Plant type="sunflower" points={25} /><h3>{students.length ? 'No plants in this patch' : 'A little seed. A big beginning.'}</h3><p>{students.length ? 'Try another name or show all your little growers.' : 'Give every student a plant to call their own.'}</p>{students.length ? <button className="button button-secondary" type="button" onClick={clearFilters}><ArrowLeft size={16} />Show all plants</button> : <button className="button button-primary" type="button" disabled={!ready || pending} onClick={onAdd}><Plus size={16} />Add your first student</button>}</div>}
    </div>
    <footer className="garden-footer">
      <span className="garden-page-info"><Leaf size={14} /><span>{filtered.length ? `${firstIndex + 1}–${Math.min(firstIndex + layout.capacity, filtered.length)} of ${filtered.length} ${filtered.length === 1 ? 'plant' : 'plants'}` : 'Room for something wonderful'}</span></span>
      <nav className="garden-pagination" aria-label="Garden pages"><button type="button" aria-label="Previous garden page" title="Previous page" disabled={currentPage === 0} onClick={() => setPage(value => Math.max(0, value - 1))}><ChevronLeft size={18} /></button><span aria-live="polite" aria-atomic="true">Page {currentPage + 1} of {pageCount}</span><button type="button" aria-label="Next garden page" title="Next page" disabled={currentPage >= pageCount - 1} onClick={() => setPage(value => Math.min(pageCount - 1, value + 1))}><ChevronRight size={18} /></button></nav>
      <button type="button" className="garden-water-all" disabled={!ready || pending || watering || !students.length} onClick={() => water('all')}><WateringCan /><span>Water everyone</span><ArrowRight size={15} /></button>
    </footer>
  </section>;
}
