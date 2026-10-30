import { test, expect } from './authenticated-fixture.js';
import { mkdir } from 'node:fs/promises';

const varieties = [
  ['hibiscus', 'Hibiscus'], ['rose', 'Rose'], ['marigold', 'Marigold'], ['bonsai', 'Bonsai tree'],
];

test('new varieties can be chosen on mobile, watered, edited and restored after reload', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  for (const [plant, label] of varieties) {
    await page.getByRole('button', { name: 'Add student', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.locator('.plant-picker button')).toHaveCount(11);
    await page.getByLabel(/Student names/).fill(`${label} Grower`);
    await dialog.getByRole('button', { name: label, exact: true }).click();
    await expect(dialog.getByRole('button', { name: label, exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Plant a new beginning' }).click();
    await page.getByLabel('Search garden').fill(`${label} Grower`);
    const tile = page.getByRole('button', { name: `${label} Grower, ${label}, 0 points. Give points.`, exact: true });
    await tile.click();
    await expect(page.getByRole('button', { name: `${label} Grower, ${label}, 10 points. Give points.`, exact: true })).toBeVisible();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('sprout-classroom-v1')));
    expect(saved.students.find(student => student.name === `${label} Grower`)).toMatchObject({ plant, points: 10 });
  }
  await page.reload();
  for (const [, label] of varieties) {
    await page.getByLabel('Search garden').fill(`${label} Grower`);
    await expect(page.getByRole('button', { name: `${label} Grower, ${label}, 10 points. Give points.`, exact: true })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: /^Students/ }).click();
  await page.getByRole('button', { name: 'Edit Emma', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Bonsai tree', exact: true }).click();
  await page.getByRole('button', { name: 'Save student', exact: true }).click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('sprout-classroom-v1')));
  expect(saved.students.find(student => student.name === 'Emma')).toMatchObject({ plant: 'bonsai', points: 145 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('new plant artwork grows continuously, stays distinct and fits at full maturity', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(types => {
    if (!localStorage.getItem('sprout-classroom-v1')) localStorage.setItem('sprout-classroom-v1', JSON.stringify({
      classroom: { id: 'demo', name: 'New blooms', goal: 5000, theme: 'sunshine', decorations: [] },
      students: types.map(([plant, name], i) => ({ id: `new-${i}`, name, plant, points: 45 })), activities: [],
    }));
  }, varieties);
  await page.goto('/');
  await expect(page.locator('.plant-spot')).toHaveCount(4);
  await page.addStyleTag({ content: '.plant-foliage { animation: none !important; }' });
  await page.getByLabel('Watering points').fill('60');
  await page.getByRole('button', { name: 'Water everyone', exact: true }).click();
  const frames = await page.evaluate(async () => {
    const frames = [];
    const start = performance.now();
    await new Promise(resolve => {
      const sample = () => {
        frames.push([...document.querySelectorAll('.plant-art > svg')].map(svg => ({
          points: Number(svg.dataset.growthPoints),
          height: svg.querySelector('rect').getBoundingClientRect().top - svg.querySelector('.plant-shape').getBoundingClientRect().top,
        })));
        if (performance.now() - start < 5400) requestAnimationFrame(sample);
        else resolve();
      };
      sample();
    });
    return frames;
  });
  for (let i = 0; i < 4; i++) {
    expect(frames.at(-1)[i].points).toBe(105);
    expect(frames.every((frame, index) => index === 0 || frame[i].height >= frames[index - 1][i].height - .1), `${varieties[i][1]} should not shrink`).toBe(true);
  }
  const markup = await page.locator('.plant-shape').evaluateAll(shapes => shapes.map(shape => shape.innerHTML));
  expect(new Set(markup).size).toBe(4);
  await page.getByLabel('Watering points').fill('100');
  await page.getByRole('button', { name: 'Water everyone', exact: true }).click();
  await expect(page.locator('.plant-art > svg').last()).toHaveAttribute('data-growth-points', '205');
  await mkdir('.local/screenshots', { recursive: true });
  await page.locator('.garden-panel').screenshot({ path: '.local/screenshots/new-plant-varieties.png' });
  await page.setViewportSize({ width: 320, height: 640 });
  await expect.poll(() => page.locator('.plant-spot').evaluateAll(tiles => tiles.every(tile => {
    const bounds = tile.getBoundingClientRect();
    const plant = tile.querySelector('.plant-shape').getBoundingClientRect();
    return plant.left >= bounds.left - 1 && plant.right <= bounds.right + 1 && plant.top >= bounds.top - 1 && plant.bottom <= bounds.bottom + 1;
  }))).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
