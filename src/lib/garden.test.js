import test from 'node:test';
import assert from 'node:assert/strict';
import { awardLocal, createDemo, stageFor, nextStage, undoLocal, validateGarden } from './garden.js';
test('growth changes at every milestone', () => {
  assert.equal(stageFor(19).name, 'Little seed'); assert.equal(stageFor(20).name, 'New sprout');
  assert.equal(stageFor(99).name, 'Growing strong'); assert.equal(stageFor(100).name, 'In bloom');
  assert.equal(stageFor(180).name, 'Super bloom'); assert.equal(nextStage(180), undefined);
  assert.equal(stageFor(300).name, 'Super bloom');
  assert.equal(stageFor(500).name, 'Super bloom'); assert.equal(stageFor(800).name, 'Super bloom');
  assert.equal(nextStage(800), undefined);
});
test('class awards reach every student once and leave original data untouched', () => {
  const state = createDemo(); const next = awardLocal(state, 'all', 10, 'Homework complete');
  next.students.forEach((student, i) => assert.equal(student.points, state.students[i].points + 10));
  assert.equal(next.activities.length, state.activities.length + state.students.length);
  assert.equal(state.students[0].points, 145);
});
test('undo reverses exactly its award and rejects illustrative demo activity', () => {
  const state = createDemo(); const next = awardLocal(state, [state.students[0].id], 15, 'Extra effort');
  const restored = undoLocal(next, next.activities[0].id);
  assert.equal(restored.students[0].points, state.students[0].points);
  assert.throws(() => undoLocal(state, state.activities[0].id));
});
test('invalid or stale awards cannot partially change progress', () => {
  const state = createDemo();
  for (const points of [-1, 0, 101, 1.5, NaN]) assert.throws(() => awardLocal(state, 'all', points, 'Homework'));
  assert.throws(() => awardLocal(state, [state.students[0].id, 'missing'], 10, 'Homework'));
  assert.throws(() => awardLocal(state, 'all', 10, '   '));
  assert.equal(validateGarden({}), false); assert.equal(validateGarden(state), true);
});
