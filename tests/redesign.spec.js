import { test as base, expect } from './authenticated-fixture.js';

const test = base.extend({
  runtimeErrors: [async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await use(errors);
    expect(errors, 'No uncaught browser exceptions').toEqual([]);
  }, { auto: true }],
});

const STORE = 'sprout-classroom-v1';
const plantedRoster = {
  classroom: { id: 'demo', name: 'Our growing classroom', goal: 5000, theme: 'sunshine', decorations: [] },
  students: Array.from({ length: 40 }, (_, index) => ({
    id: `grower-${index + 1}`,
    name: `Grower ${String(index + 1).padStart(2, '0')}`,
    plant: 'sunflower',
    points: index % 3 === 0 ? 120 : 35,
  })),
  activities: [],
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(({ key, data }) => {
    // Seed once; a reload must verify the app's saved changes, not reset them.
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(data));
  }, { key: STORE, data: plantedRoster });
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Interactive classroom garden' })).toBeVisible();
  await expect(page.locator('.plant-spot').first()).toBeEnabled();
});

test('large classrooms paginate without losing students and search finds plants on later pages', async ({ page }) => {
  const spots = page.locator('.plant-spot');
  const next = page.getByRole('button', { name: 'Next garden page', exact: true });
  const previous = page.getByRole('button', { name: 'Previous garden page', exact: true });
  await expect(previous).toBeDisabled();
  await expect(next).toBeEnabled();
  expect(await spots.count()).toBeLessThan(40);

  const seen = [];
  for (let step = 0; step < 40; step++) {
    seen.push(...await spots.evaluateAll(elements => elements.map(element => element.getAttribute('aria-label'))));
    if (await next.isDisabled()) break;
    const first = await spots.first().getAttribute('aria-label');
    await next.click();
    await expect(spots.first()).not.toHaveAttribute('aria-label', first);
  }
  expect(seen).toHaveLength(40);
  expect(new Set(seen).size).toBe(40);
  await expect(next).toBeDisabled();

  await page.getByLabel('Search garden', { exact: true }).fill('Grower 40');
  await expect(spots).toHaveCount(1);
  await expect(spots).toHaveAccessibleName('Grower 40, Sunflower, 120 points. Give points.');
  await expect(page.getByRole('navigation', { name: 'Garden pages', exact: true })).toContainText('Page 1 of 1');
  await page.getByRole('button', { name: /^Growing/ }).click();
  await expect(page.getByRole('heading', { name: 'No plants in this patch', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Show all plants', exact: true }).click();
  await expect(page.getByLabel('Search garden', { exact: true })).toHaveValue('');
  await expect(previous).toBeDisabled();
  await expect(next).toBeEnabled();
});

test('growth effects celebrate only the awarded plant and distinguish a new stage', async ({ page }) => {
  const plant = page.getByRole('button', { name: /^Grower 02, Sunflower,/ });
  await expect(plant.locator('[data-growth-stage]')).toHaveCount(1);
  await expect(plant.locator('[data-growth-stage]')).toHaveAttribute('data-growth-stage', '1');
  await expect(plant.locator('[data-growth-stage]')).toHaveCSS('opacity', '1');
  await plant.locator('.plant-art > svg').evaluate(element => { window.originalGrowingPlant = element; });
  await page.getByLabel('Watering points', { exact: true }).fill('15');
  await plant.click();
  await expect(plant).toHaveClass(/is-growing/);
  await expect(page.locator('.is-growing')).toHaveCount(1);
  await expect(plant.locator('.growth-badge')).toHaveText('Growing strong!');
  await expect(plant.locator('.growth-motion')).toHaveCSS('animation-name', 'growing-light');
  await expect(plant.locator('.growth-halo')).toHaveCSS('animation-name', 'growth-ripple');
  await expect(plant.locator('.plant-art > svg')).toHaveAttribute('data-growth-points', '50');
  await expect(plant.locator('[data-growth-stage]')).toHaveCount(1);
  await expect(plant.locator('[data-growth-stage]')).toHaveAttribute('data-growth-stage', '2');
  expect(await plant.locator('.plant-art > svg').evaluate(element => element === window.originalGrowingPlant)).toBe(true);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(plant.locator('.plant-foliage')).toHaveCSS('animation-name', 'none');
  await expect(plant.locator('.growth-motion')).toHaveCSS('animation-name', 'none');
  await expect(plant).not.toHaveClass(/is-celebrating/);
  await expect(plant.locator('.plant-art > svg')).toHaveAttribute('data-growth-points', '50');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.getByLabel('Watering points', { exact: true }).fill('10');
  await plant.click();
  await expect(plant).toHaveClass(/is-celebrating/);
  await expect(plant).not.toHaveClass(/is-growing/);
  const samples = await plant.locator('.plant-art > svg').evaluate(element => new Promise(resolve => {
    const values = [];
    const start = performance.now();
    const sample = () => {
      values.push(Number(element.dataset.growthPoints));
      if (performance.now() - start < 5500) requestAnimationFrame(sample);
      else resolve(values);
    };
    sample();
  }));
  expect(samples.every((value, index) => value >= 50 && value <= 60 && (index === 0 || value >= samples[index - 1]))).toBe(true);
  expect(samples.at(-1)).toBe(60);
  expect(await plant.locator('.plant-art > svg').evaluate(element => element === window.originalGrowingPlant)).toBe(true);
  await page.reload();
  await expect(plant.locator('.plant-art > svg')).toHaveAttribute('data-growth-points', '60');
});

test('native theme selection persists and names toggle keeps plant controls accessible', async ({ page }) => {
  const garden = page.getByRole('region', { name: 'Interactive classroom garden' });
  const theme = page.getByLabel('Garden theme', { exact: true });
  await theme.selectOption('sunset');
  await expect(garden).toHaveClass(/theme-sunset/);
  await theme.selectOption('moonlight');
  await expect(garden).toHaveClass(/theme-moonlight/);
  await page.getByRole('button', { name: 'Hide student names', exact: true }).click();
  await expect(page.locator('.plant-name')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Grower 01, Sunflower, 120 points. Give points.', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Show student names', exact: true }).click();
  await expect(page.locator('.plant-name').first()).toBeVisible();
  await page.reload();
  await expect(theme).toHaveValue('moonlight');
  await expect(garden).toHaveClass(/theme-moonlight/);
});

test('a whitespace-only award reason is rejected without losing the garden or changing points', async ({ page }) => {
  const before = await page.evaluate(key => localStorage.getItem(key), STORE);
  await page.getByLabel('Watering reason').selectOption('custom');
  await page.getByLabel('Custom watering reason').fill('   ');
  await page.getByRole('button', { name: 'Grower 01, Sunflower, 120 points. Give points.', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText(/Choose 1.100 points and tell us what/)).toBeVisible();
  await expect(page.locator('.pouring-can')).toHaveCount(0);
  expect(await page.evaluate(key => localStorage.getItem(key), STORE)).toBe(before);

});

test('garden tiles and controls remain contained across desktop, tablet and narrow mobile widths', async ({ page }) => {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 768, height: 1024 }, { width: 390, height: 844 }, { width: 320, height: 640 }]) {
    await page.setViewportSize(viewport);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await expect.poll(() => page.evaluate(() => {
      const scene = document.querySelector('.garden-scene').getBoundingClientRect();
      const tiles = [...document.querySelectorAll('.plant-spot')];
      return tiles.length > 0 && tiles.every(tile => {
        const bounds = tile.getBoundingClientRect();
        return bounds.width > 0 && bounds.height > 0 && bounds.left >= scene.left - 1 && bounds.right <= scene.right + 1 && bounds.top >= scene.top - 1 && bounds.bottom <= scene.bottom + 1;
      });
    })).toBe(true);
    await expect(page.getByLabel('Search garden', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Water everyone', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Next garden page', exact: true })).toBeEnabled();
  }
  await page.getByLabel('Search garden', { exact: true }).fill('Grower 40');
  await page.getByRole('button', { name: 'Grower 40, Sunflower, 120 points. Give points.', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});

test('native fullscreen keeps a large class paginated and waters without a dialog', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.getByRole('button', { name: 'Open full screen garden', exact: true }).click();
  await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(true);
  await expect(page.getByRole('button', { name: 'Exit full screen garden', exact: true })).toBeVisible();
  expect(await page.locator('.plant-spot').count()).toBeLessThan(40);
  await expect(page.getByRole('button', { name: 'Next garden page', exact: true })).toBeEnabled();
  await page.getByLabel('Search garden', { exact: true }).fill('Grower 40');
  await page.getByRole('button', { name: 'Grower 40, Sunflower, 120 points. Give points.', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.pouring-can')).toBeVisible();
  expect(await page.evaluate(() => document.fullscreenElement.contains(document.querySelector('.pouring-can')))).toBe(true);
  await expect(page.getByRole('button', { name: 'Grower 40, Sunflower, 130 points. Give points.', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Exit full screen garden', exact: true }).click();
  await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(false);
});

test('fullscreen validation stays visible without a modal or an incorrect watering animation', async ({ page }) => {
  await page.getByRole('button', { name: 'Open full screen garden', exact: true }).click();
  await page.getByLabel('Watering points').fill('0');
  await page.getByRole('button', { name: 'Grower 01, Sunflower, 120 points. Give points.', exact: true }).click();
  await expect(page.locator('.toast')).toBeVisible();
  expect(await page.evaluate(() => document.fullscreenElement.contains(document.querySelector('.toast')))).toBe(true);
  await expect(page.locator('.pouring-can')).toHaveCount(0);
  await page.evaluate(() => document.exitFullscreen());
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Grower 01, Sunflower, 120 points. Give points.', exact: true })).toBeEnabled();
});

test('short landscape fullscreen keeps all visible plants and controls clear of the footer', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.getByRole('button', { name: 'Open full screen garden', exact: true }).click();
  await expect.poll(() => page.evaluate(() => {
    const scene = document.querySelector('.garden-scene').getBoundingClientRect();
    const footer = document.querySelector('.garden-footer').getBoundingClientRect();
    return [...document.querySelectorAll('.plant-art svg, .plant-name, .plant-points')].every(element => {
      const rect = element.getBoundingClientRect();
      return rect.top >= scene.top && rect.bottom <= footer.top && rect.width > 0 && rect.height > 0;
    });
  })).toBe(true);
  await expect(page.getByRole('button', { name: 'Next garden page', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Exit full screen garden', exact: true })).toBeVisible();
});
