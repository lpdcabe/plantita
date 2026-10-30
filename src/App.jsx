import { useEffect, useRef, useState } from 'react';
import { ArrowRight, BookOpen, Check, ChevronDown, CircleHelp, Cloud, Flower2, Heart, LogOut, Menu, Plus, Settings2, ShieldCheck, Sparkles, Sprout, Sun, Trophy, Users, X } from 'lucide-react';
import { SproutLogo, WateringCan } from './components/GardenScenery.jsx';
import Plant from './components/Plant.jsx';
import Dialog from './components/Dialog.jsx';
import AuthDialog from './components/AuthDialog.jsx';
import AccountDialog from './components/AccountDialog.jsx';
import ClassroomDialog from './components/ClassroomDialog.jsx';
import ClassroomDropdown from './components/ClassroomDropdown.jsx';
import PlantCardDialog from './components/PlantCardDialog.jsx';
import LandingPage from './components/LandingPage.jsx';
import { AwardDialog, SettingsDialog, StudentDialog } from './components/dialogs.jsx';
import { Progress, Toast } from './components/ui.jsx';
import GardenView from './components/views/GardenView.jsx';
import StudentsView from './components/views/StudentsView.jsx';
import GrowthView from './components/views/GrowthView.jsx';
import AdminView from './components/views/AdminView.jsx';
import { STAGES } from './lib/garden.js';
import { useClassroom } from './lib/hooks.js';

const NAV = [{ id: 'garden', label: 'My garden', icon: Sprout }, { id: 'students', label: 'Students', icon: Users }, { id: 'growth', label: 'Growth board', icon: Trophy }];
const TITLES = { garden: ['Our little garden', 'Big things start with a little care. Let’s grow something wonderful.'], students: ['Meet our little growers', 'A plant for every student. A fresh opportunity to grow, every day.'], growth: ['Look how far we’ve grown', 'Celebrate the effort, the kindness, and all the little steps along the way.'] };

export default function App() {
  const classroom = useClassroom();
  const { data, session, account, ready, pending, cloudError, cloudLoading, authLoading, syncError, toast, setToast } = classroom;
  const [page, setPage] = useState('garden');
  const [modal, setModal] = useState(null);
  const cardStudent = modal?.type === 'plant-card' && modal.classroomId === data.classroom.id ? data.students.find(student => student.id === modal.studentId) : null;
  const [mobileNav, setMobileNav] = useState(false);
  const [celebration, setCelebration] = useState(null);
  const [classesLoading, setClassesLoading] = useState(false);
  const [classesError, setClassesError] = useState(false);
  const gardenReady = ready && data.classroom.id !== 'loading';
  const navRef = useRef(null);
  const total = data.students.reduce((sum, student) => sum + student.points, 0);
  const blooming = data.students.filter(student => student.points >= 100).length;
  const goalPercent = Math.min(100, Math.round(total / data.classroom.goal * 100));
  const isAdmin = account?.canManageAccounts === true;
  const navigation = isAdmin ? [{ id: 'admin', label: 'Administration', icon: ShieldCheck }, ...NAV] : NAV;
  const [title, subtitle] = TITLES[page] || ['', ''];
  const date = new Intl.DateTimeFormat('en', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'Asia/Manila' }).format(new Date());

  useEffect(() => { setModal(null); setCelebration(null); setMobileNav(false); setPage('garden'); window.scrollTo(0, 0); }, [session?.user.id]);
  useEffect(() => { if (account) { setPage(account.canManageAccounts ? 'admin' : 'garden'); setMobileNav(false); } }, [account?.id, account?.canManageAccounts]);
  useEffect(() => { if (!celebration) return; const timer = setTimeout(() => setCelebration(null), 6000); return () => clearTimeout(timer); }, [celebration]);
  useEffect(() => {
    if (!mobileNav) return;
    const previous = document.body.style.overflow;
    const previousFocus = document.activeElement;
    document.body.style.overflow = 'hidden';
    const controls = () => [...(navRef.current?.querySelectorAll('a[href], button:not([disabled])') || [])].filter(element => element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden');
    controls()[0]?.focus();
    const close = event => {
      if (event.key === 'Escape') setMobileNav(false);
      if (event.key !== 'Tab') return;
      const elements = controls(), first = elements[0], last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', close);
    return () => { document.body.style.overflow = previous; document.removeEventListener('keydown', close); if (previousFocus?.isConnected) previousFocus.focus(); };
  }, [mobileNav]);

  function navigate(next) { setPage(next); setMobileNav(false); }
  function openModal(next) { setMobileNav(false); setModal(next); }
  function closeModal() { if (!pending) setModal(null); }
  async function refreshClasses() {
    setClassesLoading(true); setClassesError(false);
    const success = await classroom.listClassrooms();
    setClassesError(!success); setClassesLoading(false);
  }
  function openClasses() { openModal({ type: 'classes' }); }
  async function selectClass(id) {
    if (await classroom.switchClassroom(id)) { setCelebration(null); setModal(null); navigate('garden'); return true; }
    return false;
  }
  async function createClass(name) {
    if (await classroom.createClassroom(name)) { setCelebration(null); setModal(null); navigate('garden'); }
  }
  async function award(ids, points, reason) {
    const previousPoints = Object.fromEntries(data.students.map(student => [student.id, student.points]));
    if (await classroom.award(ids, points, reason)) {
      setModal(null);
      setCelebration({ studentIds: ids, points, previousPoints, key: Date.now() });
      return true;
    }
    return false;
  }
  async function saveStudents(names, plant, student) { if (await classroom.saveStudents(names, plant, student)) setModal(null); }
  async function saveSettings(settings) { if (await classroom.saveSettings(settings)) setModal(null); }
  async function signOut() { if (await classroom.signOut()) setModal(null); }
  function exportGarden() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'sprout-garden-backup.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setToast('Your garden data has been downloaded.');
  }

  if (authLoading) return <div className="session-loading"><SproutLogo className="brand-mark" /><p role="status">Opening Sprout…</p></div>;

  if (!session) return <>
    <LandingPage onSignIn={() => openModal({ type: 'auth' })} onAdminSignIn={() => openModal({ type: 'auth', admin: true })} />
    {modal?.type === 'auth' && <AuthDialog key={modal.admin ? 'admin' : 'teacher'} admin={Boolean(modal.admin)} onClose={closeModal} onConnected={() => setModal(null)} />}
    {toast && <Toast message={toast} onDismiss={() => setToast('')} />}
  </>;

  if (!account) return <div className="account-access-page"><a className="account-access-brand" href="#welcome"><SproutLogo /><span>sprout.</span></a><section className="account-access-card"><ShieldCheck size={34} aria-hidden="true" /><h1>{cloudError ? 'A little help getting in.' : 'Opening your account.'}</h1><p role="status">{cloudError || 'Checking your access to Sprout...'}</p>{cloudError && <p className="form-note">Your school administrator manages account access. Your saved classroom stays safe.</p>}<div className="dialog-actions">{cloudError && <button className="button button-primary" onClick={classroom.retry}>Try again</button>}<button className="button button-secondary" onClick={signOut}>Sign out</button></div></section>{toast && <Toast message={toast} onDismiss={() => setToast('')} />}</div>;

  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Skip to garden</a>
    {mobileNav && <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}
    <aside ref={navRef} className={`sidebar ${mobileNav ? 'is-open' : ''}`} aria-label="Classroom navigation">
      <div className="sidebar-brand-row"><a className="brand" href="#garden" onClick={event => { event.preventDefault(); navigate('garden'); }}><SproutLogo className="brand-mark" /><span>sprout<span className="brand-dot">.</span></span></a><button className="icon-button mobile-close" aria-label="Close navigation" onClick={() => setMobileNav(false)}><X size={20} /></button></div>
      <div className="brand-tagline">A little care. A lot of growth.</div>
      <div className="workspace-label">{isAdmin ? 'YOUR WORKSPACE' : 'YOUR CLASSROOM'}</div>
      <nav aria-label="Main navigation">{navigation.map(({ id, label, icon: Icon }) => <button key={id} className={`nav-item ${page === id ? 'active' : ''}`} onClick={() => navigate(id)} aria-current={page === id ? 'page' : undefined}><Icon size={20} strokeWidth={1.8} /><span>{label}</span>{id === 'students' && <span className="nav-count">{data.students.length}</span>}{page === id && <span className="active-dot" />}</button>)}</nav>
      <div className="sidebar-note"><span><Heart size={18} /></span><p>Good habits grow<br /><strong>one little win at a time.</strong></p></div>
      <div className="sidebar-bottom"><button className="teacher-profile" aria-label="My account" onClick={() => openModal({ type: 'account' })}><span className="avatar">{session.user.email?.slice(0, 1).toUpperCase() || 'T'}<i /></span><span><strong>{isAdmin ? 'Administrator' : 'My classroom'}</strong><small>Manage your account</small></span><ChevronDown size={14} /></button></div>
    </aside>

    <div className="workspace" inert={mobileNav || undefined}>
      <header className="topbar"><div className="topbar-left"><button className="icon-button mobile-menu" aria-label="Open navigation" aria-expanded={mobileNav} onClick={() => setMobileNav(true)}><Menu size={22} /></button>{page === 'admin' ? <><span className="class-icon"><ShieldCheck size={18} /></span><strong className="admin-topbar-title">Sprout administration</strong></> : <><span className="class-icon"><BookOpen size={18} /></span><ClassroomDropdown key={session.user.id} current={data.classroom} classrooms={classroom.classrooms} ready={ready} pending={pending} loading={classesLoading} error={classesError} onRefresh={refreshClasses} onSelect={selectClass} onCreate={openClasses} /></>}<span className="grade-tag" aria-label="Current section">{navigation.find(item => item.id === page)?.label}</span></div><div className="topbar-right"><span className="date-label">{date}</span></div></header>
      <main id="main-content">
        {page !== 'admin' && (authLoading || (session && (cloudLoading || cloudError))) && <div className={`connection-notice ${cloudError ? 'notice-error' : ''}`} role="status"><Cloud size={21} /><div><strong>{authLoading || cloudLoading ? 'Opening your garden…' : 'Let’s reconnect your classroom'}</strong>{cloudError && <p>{cloudError}</p>}</div>{cloudError && <><button className="button button-secondary button-small" onClick={classroom.retry}>Retry</button><button className="text-button" disabled={pending} onClick={signOut}>Sign out</button></>}</div>}
        {page !== 'admin' && ready && data.classroom.id === 'loading' && <section className="first-class-panel" aria-label="Create your first classroom"><Plant type="sunflower" points={20} animate={false} /><div><span className="eyebrow">A FRESH BEGINNING</span><h1>Your classroom starts here.</h1><p>Create a class, add your students, and give everyone a place to grow.</p><button className="button button-primary" onClick={openClasses}><Plus size={18} />Create your first class</button></div></section>}
        {page === 'admin' && isAdmin && <AdminView session={session} onSessionExpired={classroom.onSessionExpired} onToast={setToast} />}
        {page !== 'admin' && data.classroom.id !== 'loading' && <>
        <div className="page-heading"><div><div className="eyebrow"><span /> A PLACE FOR EVERY LITTLE GROWER</div><h1>{title}<span className="heading-flower"><Flower2 size={32} strokeWidth={1.4} /></span></h1><p>{subtitle}</p></div><div className="heading-actions"><button className="button button-secondary" disabled={!gardenReady || pending} onClick={() => openModal({ type: 'add' })}><Plus size={18} />Add student</button><button className="button button-primary" disabled={!gardenReady || pending || !data.students.length} onClick={() => { if (page === 'garden') { const tools = document.getElementById('garden-watering-tools'); tools?.scrollIntoView({ block: 'center' }); tools?.querySelector('select')?.focus({ preventScroll: true }); } else openModal({ type: 'award', ids: 'all' }); }}><WateringCan className="button-watering" />Give points</button></div></div>

        <div className="stats-grid"><div className="stat-card"><span className="stat-icon sage"><Users size={23} /></span><div><span className="stat-label">Little gardeners</span><strong>{data.students.length}<small>growing together</small></strong></div></div><div className="stat-card"><span className="stat-icon peach"><Sun size={24} /></span><div><span className="stat-label">Growth points</span><strong>{total.toLocaleString()}<small>small efforts, big things</small></strong></div></div><div className="stat-card"><span className="stat-icon lavender"><Flower2 size={24} /></span><div><span className="stat-label">Plants in bloom</span><strong>{blooming}<small>{blooming ? 'a little reason to smile' : 'good things are growing'}</small></strong></div></div></div>

        {page === 'garden' && <>
          <GardenView key={data.classroom.id} students={data.students} classroom={data.classroom} ready={gardenReady} pending={pending} onAward={award} onAdd={() => gardenReady ? openModal({ type: 'add' }) : openClasses()} onThemeChange={theme => classroom.saveSettings({ theme })} celebration={celebration} />
          <div className="garden-bottom-grid"><section className="class-goal-panel"><span className="goal-icon"><Trophy size={26} /></span><div className="goal-copy"><span className="eyebrow">OUR SHARED MILESTONE</span><h2>{total >= data.classroom.goal ? 'Look what we grew together!' : 'A little from all of us.'}</h2><p>{total >= data.classroom.goal ? 'Your class reached its goal. Time for a new beginning.' : `${Math.max(0, data.classroom.goal - total).toLocaleString()} more points to our class goal.`}</p></div><div className="goal-progress"><div className="goal-numbers"><strong>{total.toLocaleString()}<span> / {data.classroom.goal.toLocaleString()} pts</span></strong><span>{goalPercent}%</span></div><Progress label="Class goal" value={total} max={data.classroom.goal} /></div><button className="icon-button" aria-label="Edit class goal" onClick={() => openModal({ type: 'settings' })}><Settings2 size={18} /></button></section><section className="garden-tip-panel"><Sparkles size={24} /><div><h3>Celebrate the little things.</h3><p>Homework, helping hands, or giving it another try. Every effort counts.</p></div></section></div>
          <section className="growth-guide" aria-label="Plant growth stages"><span className="guide-intro"><Sprout size={21} /><strong>From little seeds<br />to big possibilities.</strong></span><div className="guide-stages">{STAGES.map((stage, index) => <div className="guide-stage" key={stage.at}><span className={`stage-dot stage-${index}`}>{index === 0 ? <span className="seed-icon" /> : index < 3 ? <Sprout size={18} /> : <Flower2 size={18} />}</span><span>{stage.name}<small>{stage.at === 0 ? 'A fresh start' : `${stage.at}+ points`}</small></span>{index < STAGES.length - 1 && <span className="stage-line" />}</div>)}</div><button className="icon-button" aria-label="Learn about growth stages" onClick={() => openModal({ type: 'help' })}><CircleHelp size={19} /></button></section>
        </>}
        {page === 'students' && <StudentsView key={data.classroom.id} students={data.students} ready={gardenReady} pending={pending} onEdit={student => openModal({ type: 'edit', student })} onAward={ids => openModal({ type: 'award', ids })} onAdd={() => openModal({ type: 'add' })} onPreview={studentId => openModal({ type: 'plant-card', studentId, classroomId: data.classroom.id })} />}
        {page === 'growth' && <GrowthView key={data.classroom.id} students={data.students} ready={gardenReady} pending={pending} onAward={ids => openModal({ type: 'award', ids })} />}
        </>}
        <footer className="page-footer"><span><Sprout size={15} />Made for growing minds.</span><span>{page === 'admin' ? 'Only you can create teacher accounts.' : pending ? 'Saving your changes…' : !ready ? 'Connecting to your classroom…' : syncError ? 'Connection interrupted · retrying automatically' : 'Your classroom · saved to your account'}</span></footer>
      </main>
    </div>

    {modal?.type === 'classes' && <ClassroomDialog classrooms={classroom.classrooms} activeId={data.classroom.id} pending={pending} ready={ready} session={session} loading={classesLoading} error={classesError} onRetry={refreshClasses} onClose={closeModal} onSelect={selectClass} onCreate={createClass} />}
    {cardStudent && <PlantCardDialog key={cardStudent.id} student={cardStudent} classroomName={data.classroom.name} onClose={closeModal} />}
    {modal?.type === 'auth' && <AuthDialog onClose={closeModal} onConnected={() => setModal(null)} onToast={setToast} />}
    {modal?.type === 'award' && <AwardDialog data={data} ids={modal.ids} pending={pending} ready={gardenReady} onClose={closeModal} onAward={award} />}
    {(modal?.type === 'add' || modal?.type === 'edit') && <StudentDialog student={modal.student} pending={pending} ready={gardenReady} onClose={closeModal} onSave={saveStudents} onRemove={student => setModal({ type: 'remove', student })} />}
    {modal?.type === 'settings' && <SettingsDialog classroom={data.classroom} pending={pending} ready={gardenReady} onClose={closeModal} onSave={saveSettings} onExport={exportGarden} />}
    {modal?.type === 'help' && <Dialog title="Good habits take root" subtitle="A little effort. A little water. A lot of growth." onClose={closeModal}><div className="help-intro"><Plant type="sunflower" points={145} /><p>Every student gets a plant of their own. Celebrate homework, kindness, and extra effort with growth points. As those points add up, their plant grows!</p></div><ol className="help-steps"><li><span>1</span><div><strong>Plant a little possibility</strong><p>Add your students and let each one choose a plant.</p></div></li><li><span>2</span><div><strong>Celebrate the little things</strong><p>Tap a plant to award points. Choose Water everyone to celebrate the whole class.</p></div></li><li><span>3</span><div><strong>Watch good habits blossom</strong><p>Growth stages run from Little seed to Super bloom at 180 points. Earn special pots, ribbons, and garden friends. Try Play with plants for a friendly visit without awarding points. Use garden pages and full screen to give every plant room to shine.</p></div></li></ol><div className="gentle-note"><Heart size={20} /><p>Every child grows at their own pace. Plants never wilt or lose points for missed homework.</p></div><button className="button button-primary button-full" onClick={closeModal}>Let’s get growing<ArrowRight size={17} /></button></Dialog>}
    {modal?.type === 'account' && <AccountDialog session={session} pending={pending} onClose={closeModal} onToast={setToast} onRefresh={() => { classroom.retry(); setModal(null); }} onSignOut={signOut} />}
    {modal?.type === 'remove' && <Dialog title={`Remove ${modal.student.name}?`} subtitle="This removes their plant and points from this classroom. This cannot be undone." onClose={closeModal}><div className="dialog-actions"><button className="button button-secondary" onClick={closeModal} disabled={pending}>Keep growing</button><button className="button button-danger" disabled={pending} onClick={async () => { if (await classroom.removeStudent(modal.student)) setModal(null); }}>{pending ? 'Removing…' : 'Remove student'}</button></div></Dialog>}
    {toast && <Toast message={toast} onDismiss={() => setToast('')} />}
  </div>;
}

