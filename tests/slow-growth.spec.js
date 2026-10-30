import { test, expect } from './authenticated-fixture.js';
import { mkdir } from 'node:fs/promises';

const types = ['sunflower', 'daisy', 'tulip', 'cactus', 'monstera', 'lavender', 'strawberry'];
const garden = {
  classroom: { id: 'demo', name: 'Slow growth class', goal: 5000, theme: 'sunshine', decorations: [] },
  students: types.map((plant, i) => ({ id: `plant-${i}`, name: plant, plant, points: 45 })),
  activities: [],
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(data => {
    if (!localStorage.getItem('sprout-classroom-v1')) localStorage.setItem('sprout-classroom-v1', JSON.stringify(data));
  }, garden);
  await page.goto('/');
  await expect(page.locator('.plant-spot')).toHaveCount(7);
});

test('all varieties grow slowly through earned stages without height resets or ghost foliage', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  // Remove decorative sway so the measurement isolates real growth.
  await page.addStyleTag({ content: '.plant-foliage { animation: none !important; }' });
  const measure = () => [...document.querySelectorAll('.plant-art > svg')].map(svg => {
    const shape = svg.querySelector('.plant-shape');
    const bounds = shape.getBoundingClientRect();
    const pot = svg.querySelector('rect');
    return { points: Number(svg.dataset.growthPoints), height: pot.getBoundingClientRect().top - bounds.top };
  });
  const before = await page.evaluate(measure);
  await mkdir('.local/screenshots', { recursive: true });
  await page.locator('.garden-panel').screenshot({ path: '.local/screenshots/slow-growth-before.png' });
  await page.getByLabel('Watering points').fill('60');
  await page.getByRole('button', { name: 'Water everyone', exact: true }).click();
  const frames = await page.evaluate(async () => {
    const frames = [];
    const start = performance.now();
    await new Promise(resolve => {
      function sample() {
        frames.push([...document.querySelectorAll('.plant-art > svg')].map(svg => {
          const shape = svg.querySelector('.plant-shape');
          return { points: Number(svg.dataset.growthPoints), height: svg.querySelector('rect').getBoundingClientRect().top - shape.getBoundingClientRect().top };
        }));
        if (performance.now() - start < 5400) requestAnimationFrame(sample);
        else resolve();
      }
      sample();
    });
    return frames;
  });
  for (let index = 0; index < types.length; index++) {
    const samples = frames.map(frame => frame[index]);
    expect(samples.some(value => value.points > 50 && value.points < 100)).toBe(true);
    expect(samples.at(-1).points).toBe(105);
    expect(samples.at(-1).height).toBeGreaterThan(before[index].height + 6);
    expect(samples.every((value, i) => i === 0 || value.height >= samples[i - 1].height - .1), `${types[index]} should not shrink during growth`).toBe(true);
  }
  await expect(page.locator('.plant-shape')).toHaveCount(7);
  await expect(page.locator('.plant-art > svg.plant-is-growing')).toHaveCount(0);
  const after = await page.evaluate(measure);
  await page.locator('.garden-panel').screenshot({ path: '.local/screenshots/slow-growth-after.png' });
  await page.reload();
  await page.addStyleTag({ content: '.plant-foliage { animation: none !important; }' });
  await expect(page.locator('.plant-spot')).toHaveCount(7);
  const reloaded = await page.evaluate(measure);
  for (let i = 0; i < types.length; i++) expect(reloaded[i].height).toBeCloseTo(after[i].height, 1);
  expect(errors).toEqual([]);
});

test('another watering continues from the current visible growth instead of restarting it', async ({ page }) => {
  await page.getByLabel('Search garden').fill('sunflower');
  const plant = page.locator('.plant-spot');
  const art = plant.locator('.plant-art > svg');
  await page.getByLabel('Watering points').fill('50');
  await plant.click();
  await expect(plant).toBeEnabled();
  const halfway = Number(await art.getAttribute('data-growth-points'));
  expect(halfway).toBeGreaterThan(45);
  expect(halfway).toBeLessThan(95);
  await plant.click();
  const continued = Number(await art.getAttribute('data-growth-points'));
  expect(continued).toBeGreaterThanOrEqual(halfway);
  expect(continued).toBeLessThan(95);
  await expect(art).toHaveAttribute('data-growth-points', '145');
  await expect(art).not.toHaveClass(/plant-is-growing/);
});

test('the Growing filter retains a plant until its bloom animation finishes', async ({ page }) => {
  await page.getByLabel('Search garden').fill('lavender');
  await page.getByRole('button', { name: /^Growing/ }).click();
  await page.getByLabel('Watering points').fill('55');
  await page.locator('.plant-spot').click();
  await expect(page.locator('.plant-spot')).toHaveCount(1);
  await expect(page.locator('.plant-art > svg')).toHaveAttribute('data-growth-points', '100');
  await expect(page.locator('.plant-spot')).toHaveCount(0);
  await page.getByRole('button', { name: /^In bloom/ }).click();
  await expect(page.locator('.plant-spot')).toHaveCount(1);
  await expect(page.locator('.plant-art > svg')).toHaveAttribute('data-growth-points', '100');
});
