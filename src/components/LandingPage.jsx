import { useRef, useState } from 'react';
import { ArrowDown, ArrowRight, BookOpen, Check, ChevronDown, Flower2, Heart, Leaf, Printer, ShieldCheck, Sparkles, Sprout, Sun, Users } from 'lucide-react';
import { GardenBackdrop, SproutLogo } from './GardenScenery.jsx';
import Plant from './Plant.jsx';
import { plantName, stageFor } from '../lib/garden.js';
import './landing-page.css';

const PICKS = [
  { id: 'sunflower', label: 'Sunflower', color: '#edc765' },
  { id: 'rose', label: 'Rose', color: '#d18f9d' },
  { id: 'bonsai', label: 'Bonsai', color: '#8aa47d' },
];

const STEPS = [
  { icon: Sprout, title: 'Make room to grow', text: 'Create your class and give every student a plant of their own. Choose from 11 little personalities.' },
  { icon: Heart, title: 'Notice the little wins', text: 'Celebrate homework, kindness, and extra effort with growth points. A little encouragement goes a long way.' },
  { icon: Flower2, title: 'Watch their effort bloom', text: 'See plants grow, earn cheerful decorations, and celebrate the milestones your class reaches together.' },
];

const QUESTIONS = [
  ['How do I get a teacher account?', 'Your school administrator creates your account and shares your sign-in details with you. Public registration is not available.'],
  ['Do my students need an account?', 'No. You manage your classroom from your teacher account. Add student names or nicknames, choose their plants, and celebrate their effort together.'],
  ['What can I give growth points for?', 'Homework, helping a friend, teamwork, extra effort, or a reason of your own. Choose between 1 and 100 points for one student or the whole class.'],
  ['Will a plant wilt if a student misses homework?', 'No. Plants keep their earned growth. Sprout is a place to celebrate progress, with room for every child to grow at their own pace.'],
  ['Can I use Sprout with more than one class?', 'Yes. Create and switch between classes from your account. Each class has its own students, garden, and shared goal.'],
  ['Can I open my classroom on another device?', 'Yes. Sign in to the same teacher account to open your saved classrooms. The garden also has a full-screen view for sharing with your class.'],
];

export default function LandingPage({ onSignIn, onAdminSignIn, authLoading = false }) {
  const [plant, setPlant] = useState('sunflower');
  const [growth, setGrowth] = useState(145);
  const [theme, setTheme] = useState('sunshine');
  const [heartFilled, setHeartFilled] = useState(false);
  const stage = stageFor(growth);
  const lastHeartTap = useRef(null);

  function activateHeart(event) {
    setHeartFilled(true);
    // Keyboard and assistive-technology activation already represents an
    // intentional button press. Pointer users must tap twice in the same place.
    if (event.detail === 0) {
      lastHeartTap.current = null;
      onAdminSignIn?.();
      return;
    }
    const tap = { time: performance.now(), x: event.clientX, y: event.clientY };
    const previous = lastHeartTap.current;
    if (previous && tap.time - previous.time <= 450 && Math.hypot(tap.x - previous.x, tap.y - previous.y) <= 24) {
      lastHeartTap.current = null;
      onAdminSignIn?.();
    } else lastHeartTap.current = tap;
  }

  return <div className="lp-page" id="welcome">
    <a className="lp-skip" href="#landing-content">Skip to content</a>
    <header className="lp-header">
      <a className="lp-brand" href="#welcome" aria-label="Sprout home"><SproutLogo /><span>sprout<span>.</span></span></a>
      <nav className="lp-nav" aria-label="Website navigation"><a href="#how-it-works">How it works</a><a href="#made-for-your-class">Why Sprout</a><a href="#questions">Questions</a></nav>
      <button type="button" className="lp-signin" onClick={onSignIn} disabled={authLoading}>Sign in<ArrowRight size={16} aria-hidden="true" /></button>
    </header>

    <main className="lp-main" id="landing-content">
      <section className="lp-hero" aria-labelledby="lp-hero-title">
        <div className="lp-hero-copy">
          <span className="lp-eyebrow"><span /> A LITTLE CARE. A LOT OF GROWTH.</span>
          <h1 id="lp-hero-title">Little habits.<br /><span>Lovely growth.</span><Flower2 aria-hidden="true" /></h1>
          <p>A classroom garden where every student belongs. Turn homework, kindness, and everyday effort into something they can see growing.</p>
          <div className="lp-hero-actions"><button type="button" className="lp-button lp-button-primary" onClick={onSignIn} disabled={authLoading}>Open your class garden<ArrowRight size={18} aria-hidden="true" /></button><a className="lp-text-link" href="#how-it-works">See how it works<ArrowDown size={16} aria-hidden="true" /></a></div>
          <div className="lp-reassurance"><ShieldCheck size={16} aria-hidden="true" /><span>Teacher accounts are created by your administrator.</span></div>
          {authLoading && <p className="lp-auth-status" role="status">Checking your sign-in…</p>}
        </div>

        <div className="lp-showcase">
          <div className="lp-showcase-top"><span><Sprout size={15} aria-hidden="true" />A little effort, brought to life</span><button type="button" className="lp-scene-switch" aria-label="Show moonlight illustration" aria-pressed={theme === 'moonlight'} onClick={() => setTheme(value => value === 'sunshine' ? 'moonlight' : 'sunshine')}><Sun size={16} aria-hidden="true" /></button></div>
          <div className={`lp-garden-scene lp-scene-${theme}`}>
            <GardenBackdrop className="lp-backdrop" theme={theme} />
            <div className="lp-scene-caption"><Leaf size={12} aria-hidden="true" />Classroom illustration</div>
            <div className="lp-garden-plants" aria-hidden="true"><Plant className="lp-side-plant lp-plant-left" type="tulip" points={75} /><Plant key={plant} className="lp-featured-plant" type={plant} points={growth} /><Plant className="lp-side-plant lp-plant-right" type="monstera" points={120} /></div>
            <div className="lp-plant-label"><span>{plantName(plant)}</span><small>{stage.name}</small></div>
            <span className="lp-floating-note"><Heart size={15} aria-hidden="true" />Every little win counts.</span>
          </div>
          <div className="lp-showcase-controls">
            <div className="lp-plant-options" role="group" aria-label="Choose an illustration plant">{PICKS.map(pick => <button type="button" key={pick.id} onClick={() => setPlant(pick.id)} aria-pressed={plant === pick.id}><span style={{ background: pick.color }} aria-hidden="true">{plant === pick.id && <Check size={10} />}</span>{pick.label}</button>)}</div>
            <label className="lp-growth-control"><span>See a little growth</span><input type="range" aria-label="Plant growth illustration" min="0" max="180" step="5" value={growth} onChange={event => setGrowth(Number(event.target.value))} /><Flower2 size={17} aria-hidden="true" /></label>
          </div>
          <p className="lp-showcase-hint"><Sparkles size={13} aria-hidden="true" />Pick a plant and move the slider to watch it grow.</p>
        </div>
      </section>

      <div className="lp-values" aria-label="Made for classroom life"><span><BookOpen />Celebrate good habits</span><span><Users />Grow together</span><span><Heart />Encourage every student</span><span><Printer />Keep a little memory</span></div>

      <section className="lp-section lp-how" id="how-it-works" aria-labelledby="lp-how-title">
        <div className="lp-section-heading"><span className="lp-eyebrow">FROM LITTLE SEEDS TO BIG POSSIBILITIES</span><h2 id="lp-how-title">A few small steps.<br />So much room to bloom.</h2><p>Simple for you. Something special for them.</p></div>
        <div className="lp-steps">{STEPS.map(({ icon: Icon, title, text }, index) => <article className="lp-step" key={title}><div className={`lp-step-icon lp-step-color-${index}`}><Icon size={29} strokeWidth={1.5} aria-hidden="true" /><span>0{index + 1}</span></div><h3>{title}</h3><p>{text}</p></article>)}</div>
      </section>

      <section className="lp-section lp-features" id="made-for-your-class" aria-labelledby="lp-features-title">
        <div className="lp-feature-art" aria-hidden="true"><span className="lp-art-orbit" /><div className="lp-keepsake"><span className="lp-keepsake-top"><Sprout size={12} />A LITTLE KEEPSAKE</span><Plant type="rose" points={180} animate={false} /><strong>Growing with pride</strong><span>Keep up the good work!</span><div><Sun size={13} />Little efforts. Wonderful growth.</div></div><span className="lp-art-note"><Printer size={18} />A little pride to take home</span><Flower2 className="lp-art-flower" size={55} strokeWidth={1} /></div>
        <div className="lp-feature-copy"><span className="lp-eyebrow">MADE FOR YOUR CLASSROOM</span><h2 id="lp-features-title">More than a point.<br />A reason to feel proud.</h2><p>Give everyday effort a little place to shine, in the classroom and beyond.</p><ul><li><span><Leaf size={18} /></span><div><h3>A plant with personality</h3><p>Choose from 11 varieties, with gentle growth, cheerful pots, and playful garden friends.</p></div></li><li><span><Printer size={18} /></span><div><h3>A keepsake of their progress</h3><p>Print a personal plant card. Designs become more decorated as their points grow.</p></div></li><li><span><Users size={18} /></span><div><h3>Little wins, shared celebrations</h3><p>Set a class goal, celebrate together, and put the whole garden on the big screen.</p></div></li></ul></div>
      </section>

      <section className="lp-kindness"><button type="button" className={`lp-kindness-heart${heartFilled ? ' is-filled' : ''}`} aria-label="Administrator sign-in" aria-haspopup="dialog" disabled={authLoading} onClick={activateHeart} onBlur={() => { lastHeartTap.current = null; }}><Heart size={28} strokeWidth={1.5} aria-hidden="true" /></button><h2>Every child grows at their own pace.</h2><p>Plants never wilt for missed homework. There is always another little win to celebrate.</p></section>

      <section className="lp-section lp-faq" id="questions" aria-labelledby="lp-faq-title"><div className="lp-section-heading"><span className="lp-eyebrow">A FEW THINGS YOU MIGHT BE WONDERING</span><h2 id="lp-faq-title">Before we get growing.</h2></div><div className="lp-faq-list">{QUESTIONS.map(([question, answer]) => <details key={question}><summary>{question}<ChevronDown size={18} aria-hidden="true" /></summary><p>{answer}</p></details>)}</div></section>

      <section className="lp-final-cta"><span className="lp-cta-sprout"><Sprout size={30} strokeWidth={1.6} aria-hidden="true" /></span><h2>A fresh beginning<br />for your little growers.</h2><p>Your class. Their plants. So many possibilities.</p><button type="button" className="lp-button lp-button-primary" onClick={onSignIn} disabled={authLoading}>Sign in to your classroom<ArrowRight size={18} aria-hidden="true" /></button><span className="lp-cta-note">Need an account? Ask your school administrator.</span></section>
    </main>

    <footer className="lp-footer"><a className="lp-brand" href="#welcome" aria-label="Back to Sprout home"><SproutLogo /><span>sprout<span>.</span></span></a><p>A little care. A lot of growth.</p><span><Sprout size={14} aria-hidden="true" />Made for growing minds.</span></footer>
  </div>;
}
