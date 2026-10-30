import { useCallback, useEffect, useRef, useState } from 'react';
import { requestApi, supabase } from './supabase.js';

const emptyGarden = () => ({ classroom: { id: 'loading', name: 'My classroom', goal: 1200, theme: 'sunshine', decorations: [] }, students: [], activities: [] });

export function useClassroom() {
  const [data, setData] = useState(emptyGarden);
  const [classrooms, setClassrooms] = useState([]);
  const dataRef = useRef(data);
  const [session, setSession] = useState(null);
  const [account, setAccount] = useState(null);
  const sessionRef = useRef(null);
  const [authLoading, setAuthLoading] = useState(Boolean(supabase));
  const [cloudLoading, setCloudLoading] = useState(false);
  const [cloudError, setCloudError] = useState('');
  const [syncError, setSyncError] = useState(false);
  const [pending, setPending] = useState(false);
  const [toast, setToast] = useState('');
  const [reload, setReload] = useState(0);
  const operationRef = useRef(false);
  const revision = useRef(0);
  const epoch = useRef(0);
  const ownerRef = useRef(null);
  const token = session?.access_token;
  const ready = Boolean(session?.access_token && account?.status === 'active' && !authLoading && !cloudLoading && !cloudError && ownerRef.current === session.user.id);

  const clearClassroom = useCallback(() => {
    const empty = emptyGarden();
    dataRef.current = empty;
    setData(empty);
    setClassrooms([]);
    setCloudError('');
    setSyncError(false);
  }, []);

  const rejectExpiredSession = useCallback((error, attemptedToken) => {
    if (error.status !== 401 && error.status !== 403) return false;
    // A response using an older token must not invalidate a refreshed session.
    if (sessionRef.current?.access_token !== attemptedToken) return true;
    epoch.current++; revision.current++; ownerRef.current = null; operationRef.current = false;
    setAccount(null);
    setPending(false);
    setCloudLoading(false);
    clearClassroom();
    if (error.status === 403) {
      setCloudError(error.message || 'Your account needs administrator approval.');
      return true;
    }
    sessionRef.current = null;
    setSession(null);
    setPending(false);
    setCloudLoading(false);
    clearClassroom();
    setToast('Your session has expired. Please sign in again.');
    // The rejected session is no longer usable; clear its persisted credentials.
    void supabase?.auth.signOut({ scope: 'local' }).catch(() => {});
    return true;
  }, [clearClassroom]);

  const publish = useCallback(next => {
    if (!sessionRef.current?.access_token) return false;
    dataRef.current = next;
    setData(next);
    if (next.classroom.id !== 'loading') {
      setClassrooms(previous => previous.some(c => c.id === next.classroom.id) ? previous.map(c => c.id === next.classroom.id ? next.classroom : c) : [...previous, next.classroom]);
      try { localStorage.setItem(`sprout-active-class-${sessionRef.current.user.id}`, next.classroom.id); } catch { /* Selection can still be used for this session. */ }
    }
    return true;
  }, []);

  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    let authEventSeen = false;
    function accept(next) {
      if (!alive) return;
      if (sessionRef.current?.user.id !== next?.user.id) {
        epoch.current++; revision.current++; ownerRef.current = null; operationRef.current = false;
        setAccount(null);
        setPending(false);
        clearClassroom();
        setCloudLoading(Boolean(next?.access_token));
      }
      sessionRef.current = next;
      setSession(next);
      setAuthLoading(false);
    }
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => { authEventSeen = true; accept(next); });
    supabase.auth.getSession().then(({ data: auth, error }) => {
      if (error) throw error;
      if (!authEventSeen) accept(auth.session);
    }).catch(() => { if (alive && !authEventSeen) { accept(null); setToast('Your saved sign-in could not be restored. Please sign in again.'); } });
    return () => { alive = false; listener.subscription.unsubscribe(); };
  }, [clearClassroom]);

  useEffect(() => {
    if (authLoading) return;
    if (!token) { ownerRef.current = null; setAccount(null); clearClassroom(); setCloudLoading(false); return; }
    let active = true;
    const activeEpoch = epoch.current;
    const atRevision = revision.current;
    let classroomId = ownerRef.current === session.user.id ? dataRef.current.classroom.id : undefined;
    if (!classroomId) { try { classroomId = localStorage.getItem(`sprout-active-class-${session.user.id}`) || undefined; } catch { /* Use the first owned classroom. */ } }
    if (ownerRef.current !== session.user.id) { publish(emptyGarden()); setClassrooms([]); }
    setCloudLoading(true);
    setCloudError('');
    (async () => {
      try {
        const verifiedAccount = await requestApi('/account', { token });
        if (!active || epoch.current !== activeEpoch) return;
        if (verifiedAccount.id !== session.user.id || verifiedAccount.status !== 'active') throw new Error('Your account could not be verified. Please sign in again.');
        setAccount(verifiedAccount);
        let next;
        try { next = await requestApi('/classroom', { token, classroomId }); }
        catch (error) {
          if (!classroomId || error.status !== 404) throw error;
          next = await requestApi('/classroom', { token });
        }
        if (!active || epoch.current !== activeEpoch) return;
        if (!next.classroom) next = emptyGarden();
        if (active && epoch.current === activeEpoch && atRevision === revision.current && !operationRef.current) { ownerRef.current = session.user.id; publish(next); setSyncError(false); }
      } catch (error) { if (active && epoch.current === activeEpoch && !rejectExpiredSession(error, token)) setCloudError(error.message); }
      finally { if (active && epoch.current === activeEpoch) setCloudLoading(false); }
    })();
    return () => { active = false; };
  }, [token, session?.user.id, authLoading, reload, publish, clearClassroom, rejectExpiredSession]);

  useEffect(() => {
    if (!token || !ready || pending) return;
    let active = true;
    let refreshing = false;
    const activeEpoch = epoch.current;
    async function refresh() {
      if (document.hidden || refreshing || operationRef.current) return;
      refreshing = true;
      const atRevision = revision.current;
      try {
        const next = await requestApi('/classroom', { token, classroomId: dataRef.current.classroom.id });
        if (active && activeEpoch === epoch.current && atRevision === revision.current && !operationRef.current && next.classroom) { publish(next); setSyncError(false); }
      } catch (error) { if (active && activeEpoch === epoch.current && !rejectExpiredSession(error, token)) setSyncError(true); }
      finally { refreshing = false; }
    }
    const timer = setInterval(refresh, 15000);
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    return () => { active = false; clearInterval(timer); window.removeEventListener('focus', refresh); window.removeEventListener('online', refresh); };
  }, [token, ready, pending, publish, rejectExpiredSession]);

  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 6000); return () => clearTimeout(timer); }, [toast]);

  async function mutate({ path, method = 'POST', body, merge, message }) {
    const currentSession = sessionRef.current;
    if (!currentSession?.access_token || ownerRef.current !== currentSession.user.id || operationRef.current || !ready) return false;
    operationRef.current = true;
    revision.current++;
    setPending(true);
    const activeEpoch = epoch.current;
    try {
      const result = await requestApi(path, { token: currentSession.access_token, method, body, classroomId: dataRef.current.classroom.id });
      if (activeEpoch !== epoch.current) return false;
      const next = result?.classroom && Array.isArray(result.students) ? result : merge?.(dataRef.current, result);
      if (!next?.classroom || !Array.isArray(next.students)) throw new Error('The saved classroom could not be loaded. Please refresh and try again.');
      const saved = publish(next);
      setSyncError(false);
      if (message && saved) setToast(message);
      return true;
    } catch (error) { if (activeEpoch === epoch.current && !rejectExpiredSession(error, currentSession.access_token)) setToast(error.message || 'That change could not be saved. Please try again.'); return false; }
    finally { if (activeEpoch === epoch.current) { operationRef.current = false; setPending(false); } }
  }

  function award(ids, points, reason) {
    if (!Number.isInteger(points) || points < 1 || points > 100 || !reason.trim()) { setToast('Choose 1–100 points and tell us what you’re celebrating.'); return Promise.resolve(false); }
    return mutate({ path: '/awards', body: { studentIds: ids, points, reason: reason.trim() }, message: ids === 'all' ? `A little sunshine for everyone. +${points} points each!` : `A little effort, a little growth. +${points} points!` });
  }
  function saveStudents(names, plant, student) {
    if (student) return mutate({ path: `/students/${student.id}`, method: 'PATCH', body: { name: names[0], plant }, merge: (current, result) => ({ ...current, students: current.students.map(s => s.id === student.id ? result : s) }), message: 'Student updated. Their growth is saved.' });
    return mutate({ path: '/students/batch', body: { students: names.map(name => ({ name, plant })) }, merge: (current, result) => ({ ...current, students: [...current.students, ...result] }), message: names.length === 1 ? `${names[0]}’s plant is ready to grow!` : `${names.length} new plants are ready to grow!` });
  }
  function saveSettings(settings) {
    if (settings.name !== undefined && (!settings.name.trim() || settings.name.trim().length > 80)) { setToast('Give your classroom a name of 1–80 characters.'); return Promise.resolve(false); }
    if (settings.goal !== undefined && (!Number.isInteger(settings.goal) || settings.goal < 1 || settings.goal > 1000000)) { setToast('Choose a whole-number class goal between 1 and 1,000,000.'); return Promise.resolve(false); }
    return mutate({ path: '/classroom', method: 'PATCH', body: settings, merge: (current, result) => ({ ...current, classroom: result }), message: 'Garden settings saved.' });
  }
  function removeStudent(student) {
    return mutate({ path: `/students/${student.id}`, method: 'DELETE', merge: current => ({ ...current, students: current.students.filter(s => s.id !== student.id), activities: current.activities.filter(a => a.studentId !== student.id) }), message: `${student.name} was removed from this garden.` });
  }
  async function signOut() {
    if (!supabase || !sessionRef.current) return false;
    if (operationRef.current) { setToast('Please let your current change finish saving.'); return false; }
    try { const { error } = await supabase.auth.signOut(); if (error) throw error; setToast('Signed out. Your classroom is safely saved.'); return true; }
    catch (error) { setToast(error.message); return false; }
  }
  async function listClassrooms() {
    const activeEpoch = epoch.current;
    const atRevision = revision.current;
    const currentSession = sessionRef.current;
    if (!currentSession?.access_token) return false;
    try {
      const list = await requestApi('/classrooms', { token: currentSession.access_token });
      if (activeEpoch === epoch.current && atRevision === revision.current) setClassrooms(list);
      return activeEpoch === epoch.current;
    } catch (error) { if (activeEpoch === epoch.current && !rejectExpiredSession(error, currentSession.access_token)) setToast(error.message); return false; }
  }
  async function switchClassroom(classroomId) {
    const currentSession = sessionRef.current;
    if (!currentSession?.access_token || ownerRef.current !== currentSession.user.id || !ready || operationRef.current) return false;
    operationRef.current = true; revision.current++; setPending(true);
    const activeEpoch = epoch.current;
    try {
      const next = await requestApi('/classroom', { token: currentSession.access_token, classroomId });
      if (activeEpoch !== epoch.current) return false;
      if (!next?.classroom) throw new Error('This classroom is no longer available.');
      publish(next); setSyncError(false); return true;
    } catch (error) { if (activeEpoch === epoch.current && !rejectExpiredSession(error, currentSession.access_token)) setToast(error.message); return false; }
    finally { if (activeEpoch === epoch.current) { operationRef.current = false; setPending(false); } }
  }
  function createClassroom(name) {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 80) { setToast('Enter a class name of 1–80 characters.'); return Promise.resolve(false); }
    const fields = { name: trimmed, goal: 1200, theme: 'sunshine', decorations: [] };
    return mutate({ path: '/classrooms', body: fields,
      merge: (_current, result) => ({ classroom: result, students: [], activities: [] }),
      message: `${trimmed} is ready. Add students to start growing!` });
  }
  return { data, classrooms, listClassrooms, switchClassroom, createClassroom, session, account, authLoading, cloudLoading, cloudError, syncError, ready, pending, toast, setToast, award, saveStudents, saveSettings, removeStudent, signOut, onSessionExpired: () => rejectExpiredSession({ status: 401 }, sessionRef.current?.access_token), retry: () => setReload(value => value + 1) };
}
