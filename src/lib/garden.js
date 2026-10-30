export const PLANTS = [
  { id: 'sunflower', name: 'Sunflower', color: '#f2ce69' },
  { id: 'daisy', name: 'Daisy', color: '#ead7b2' },
  { id: 'tulip', name: 'Tulip', color: '#e7a5a4' },
  { id: 'monstera', name: 'Monstera', color: '#8da981' },
  { id: 'cactus', name: 'Cactus', color: '#9bb8a0' },
  { id: 'lavender', name: 'Lavender', color: '#b6a2c9' },
  { id: 'strawberry', name: 'Strawberry', color: '#d68c83' },
  { id: 'hibiscus', name: 'Hibiscus', color: '#e48f9d' },
  { id: 'rose', name: 'Rose', color: '#cb7184' },
  { id: 'marigold', name: 'Marigold', color: '#e9ab43' },
  { id: 'bonsai', name: 'Bonsai tree', color: '#71966c' },
];
export const STAGES = [{ name: 'Little seed', at: 0 }, { name: 'New sprout', at: 20 }, { name: 'Growing strong', at: 50 }, { name: 'In bloom', at: 100 }, { name: 'Super bloom', at: 180 }];
export const PLANT_REWARDS = [
  { at: 100, name: 'Little garden sign' }, { at: 180, name: 'Achievement ribbon' },
  { at: 300, name: 'Sky-blue pot' }, { at: 500, name: 'Golden pot & ladybug' },
  { at: 800, name: 'Enchanted pot & fireflies' },
];
export function earnedRewards(points) { return PLANT_REWARDS.filter(reward => points >= reward.at); }
export const REASONS = [{ label: 'Homework complete', points: 10, icon: 'book' }, { label: 'Extra effort', points: 15, icon: 'star' }, { label: 'Helping a friend', points: 5, icon: 'heart' }, { label: 'Wonderful teamwork', points: 10, icon: 'users' }];
export const STORAGE_KEY = 'sprout-classroom-v1';
export function stageFor(points) { return [...STAGES].reverse().find(s => points >= s.at) || STAGES[0]; }
export function nextStage(points) { return STAGES.find(s => s.at > points); }
export function plantName(type) { return PLANTS.find(p => p.id === type)?.name || 'Plant'; }
export function uid() { return globalThis.crypto?.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(36).slice(2)}`; }
export function createDemo() {
  const students = [
    ['Emma', 'sunflower', 145], ['Oliver', 'monstera', 75], ['Amelia', 'tulip', 120], ['Noah', 'cactus', 40],
    ['Sophia', 'daisy', 105], ['Liam', 'lavender', 65], ['Isabella', 'strawberry', 90], ['Elijah', 'sunflower', 55],
    ['Mia', 'monstera', 30], ['Lucas', 'tulip', 85], ['Ava', 'daisy', 110], ['Ethan', 'cactus', 25],
  ].map(([name, plant, points], i) => ({ id: `demo-${i + 1}`, name, plant, points }));
  return { classroom: { id: 'demo', name: 'The Sunshine Class', goal: 1200, theme: 'sunshine', decorations: ['butterflies'] }, students,
    activities: [0, 2, 4, 1].map((index, i) => ({ id: uid(), studentId: students[index].id, studentName: students[index].name, reason: REASONS[i].label, points: REASONS[i].points, createdAt: new Date(Date.now() - (i + 1) * 3600000).toISOString(), sample: true })) };
}
export function validateGarden(data) {
  return Boolean(data?.classroom && typeof data.classroom.name === 'string' && Number.isFinite(data.classroom.goal) && data.classroom.goal > 0 && Array.isArray(data.students) && data.students.every(s => typeof s.id === 'string' && typeof s.name === 'string' && PLANTS.some(p => p.id === s.plant) && Number.isFinite(s.points) && s.points >= 0) && Array.isArray(data.activities));
}
export function loadDemo() {
  try { const data = JSON.parse(localStorage.getItem(STORAGE_KEY)); if (validateGarden(data)) return data; } catch { /* Start with a usable demo if local data is unavailable. */ }
  return createDemo();
}
export function awardLocal(state, ids, points, reason) {
  if (!Number.isInteger(points) || points < 1 || points > 100 || !reason.trim()) throw new Error('Choose 1–100 points and a reason.');
  const recipients = ids === 'all' ? state.students : state.students.filter(s => ids.includes(s.id));
  if (!recipients.length) throw new Error('Add or select a student first.');
  if (ids !== 'all' && new Set(ids).size !== recipients.length) throw new Error('One of those students is no longer in this garden.');
  const selected = new Set(recipients.map(s => s.id));
  return { ...state, students: state.students.map(s => selected.has(s.id) ? { ...s, points: s.points + points } : s), activities: [...recipients.map(s => ({ id: uid(), studentId: s.id, studentName: s.name, points, reason: reason.trim(), createdAt: new Date().toISOString() })), ...state.activities] };
}
export function undoLocal(state, id) {
  const activity = state.activities.find(a => a.id === id);
  if (!activity || activity.sample) throw new Error('This sample activity cannot be undone.');
  return { ...state, students: state.students.map(s => s.id === activity.studentId ? { ...s, points: Math.max(0, s.points - activity.points) } : s), activities: state.activities.filter(a => a.id !== id) };
}
export function relativeTime(date) {
  const delta = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 60000));
  if (delta < 1) return 'Just now'; if (delta < 60) return `${delta}m ago`; if (delta < 1440) return `${Math.floor(delta / 60)}h ago`; return `${Math.floor(delta / 1440)}d ago`;
}
