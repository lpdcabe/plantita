import test from 'node:test';
import assert from 'node:assert/strict';
import { branchLayout } from './plantBranches.js';

test('branch randomness is stable per student and milestone, with bounded positions', () => {
  const shapes = new Set();
  for (let student = 0; student < 100; student++) {
    for (let stage = 0; stage < 3; stage++) {
      const branch = branchLayout(`student-${student}`, 'rose', stage);
      assert.deepEqual(branch, branchLayout(`student-${student}`, 'rose', stage));
      assert.ok(branch.x >= 38 && branch.x <= 122);
      assert.ok(branch.y >= 43 && branch.y <= 111);
      assert.ok(branch.baseY > branch.y);
      shapes.add(JSON.stringify(branch));
    }
  }
  assert.equal(shapes.size, 300);
});
