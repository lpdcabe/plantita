import { test, expect } from './authenticated-fixture.js';
import { mkdir } from 'node:fs/promises';
import { PLANTS } from '../src/lib/garden.js';

async function seed(page, points, goal = 100000) {
  await page.addInitScript(({ plants, points, goal }) => {
    if (localStorage.getItem('sprout-classroom-v1')) return;
    localStorage.setItem('sprout-classroom-v1', JSON.stringify({
      classroom: { id: 'demo', name: 'Growing together', goal, theme: 'sunshine', decorations: [] },
      students: plants.map((plant, i) => ({ id: `reward-${i}`, name: plant.name, plant: plant.id, points })), activities: [],
    }));
  }, { plants: PLANTS, points, goal });
  await page.goto('/');
}

test('growth stops at Super bloom while rewards persist and play never awards points', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await seed(page, 290);
  const plant = page.locator('.plant-art > svg').first();
  await expect(plant.locator('[data-extra-growth]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Water everyone', exact: true }).click();
  await expect(plant).toHaveAttribute('data-growth-points', '300');
  await expect(plant.locator('[data-extra-growth]')).toHaveCount(0);
  await expect(plant.locator('[data-reward="ladybug"]')).toHaveCount(0);
  await page.reload();
  await expect(plant).toHaveAttribute('data-growth-points', '300');
  await expect(plant.locator('[data-extra-growth]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Play with plants', exact: true }).click();
  const before = await page.evaluate(() => localStorage.getItem('sprout-classroom-v1'));
  await page.getByRole('button', { name: 'Sunflower, Sunflower, 300 points. Play with plant.', exact: true }).click();
  await expect(page.locator('.plant-spot.is-playing .plant-friend')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('sprout-classroom-v1'))).toBe(before);
  await page.setViewportSize({ width: 320, height: 640 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('all enchanted plants and collectible cards fit and respect reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seed(page, 800);
  for (const plant of PLANTS) {
    await page.getByLabel('Search garden', { exact: true }).fill(plant.name);
    const art = page.locator('.plant-art > svg');
    await expect(art.locator('[data-extra-growth]')).toHaveCount(0);
    await expect(art.locator('[data-reward="ladybug"]')).toHaveCount(1);
    await expect(art.locator('[data-reward="fireflies"]')).toHaveCSS('animation-name', 'none');
    expect(await art.evaluate(svg => {
      const box = svg.querySelector('.plant-shape').getBBox();
      return box.x >= 0 && box.y >= 0 && box.x + box.width <= 160 && box.y + box.height <= 190;
    })).toBe(true);
  }
  await page.getByLabel('Search garden', { exact: true }).fill('');
  await mkdir('.local/screenshots', { recursive: true });
  await page.screenshot({ path: '.local/screenshots/enchanted-garden.png', fullPage: true });
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: /^Students/ }).click();
  await page.getByRole('button', { name: "View and print Bonsai tree's plant card", exact: true }).click();
  const card = page.getByRole('dialog').locator('.plant-keepsake');
  await expect(card).toHaveAttribute('data-rarity', 'Super bloom');
  await expect(card.getByLabel('Plant achievement')).toContainText('Super bloom');
  await expect(card.getByLabel('Growth milestones')).toHaveCount(0);
  await expect(page.getByLabel('Earned plant rewards')).toContainText('Enchanted pot');
  await card.screenshot({ path: '.local/screenshots/enchanted-card.png' });
});

test('shared goal celebrates a successful crossing once, not on initial load', async ({ page }) => {
  await seed(page, 90, 1000);
  await expect(page.locator('.class-celebration')).toHaveCount(0);
  await page.getByRole('button', { name: 'Water everyone', exact: true }).click();
  await expect(page.locator('.class-celebration')).toContainText('We grew together!');
  await expect(page.locator('.class-rainbow')).toBeVisible();
  await page.reload();
  await expect(page.locator('.class-celebration')).toHaveCount(0);
});
