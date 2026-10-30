import { loadDemo, STORAGE_KEY, validateGarden } from './garden.js';

const KEY = 'sprout-classrooms-v1';
export function loadClassrooms() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (Array.isArray(saved?.gardens) && saved.gardens.length && saved.gardens.every(validateGarden)) {
      return { gardens: saved.gardens, activeId: saved.gardens.some(g => g.classroom.id === saved.activeId) ? saved.activeId : saved.gardens[0].classroom.id };
    }
  } catch { /* Existing single-class gardens remain supported. */ }
  const garden = loadDemo();
  return { gardens: [garden], activeId: garden.classroom.id };
}
export function saveClassrooms(bundle) {
  localStorage.setItem(KEY, JSON.stringify(bundle));
  const demo = bundle.gardens.find(g => g.classroom.id === 'demo');
  if (demo) localStorage.setItem(STORAGE_KEY, JSON.stringify(demo));
}
