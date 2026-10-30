import { test, expect } from './authenticated-fixture.js';
import { mkdir } from 'node:fs/promises';
import { PLANTS } from '../src/lib/garden.js';

async function openStudents(page) {
  const menu = page.getByRole('button', { name: 'Open navigation', exact: true });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: /^Students/ }).click();
}

test('student preview prints one card with actual progress and keeps award controls separate', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await openStudents(page);
  const trigger = page.getByRole('button', { name: "View and print Emma's plant card", exact: true });
  await trigger.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog');
  const card = dialog.locator('.plant-keepsake');
  await expect(dialog).toHaveAccessibleName('A little card. A lot of growth.');
  await expect(card).toContainText('Emma');
  await expect(card).toContainText('Sunflower');
  await expect(card).toContainText('The Sunshine Class');
  await expect(card.locator('.plant-keepsake-points strong')).toHaveText('145');
  await expect(card.locator('.plant-keepsake-stage')).toHaveText('In bloom');
  await expect(card.getByLabel('Plant achievement')).toContainText('In bloom');
  await expect(card.getByLabel('Growth milestones')).toHaveCount(0);
  await expect(card.locator('svg[data-growth-points]')).toHaveAttribute('data-growth-points', '145');
  await expect(card.locator('.plant-foliage')).toHaveCount(0);
  await mkdir('.local/screenshots', { recursive: true });
  await page.screenshot({ path: '.local/screenshots/plant-card-desktop.png', animations: 'disabled' });
  for (const [name, theme] of [['Sunset', 'sunset'], ['Moonlight', 'moonlight'], ['Meadow', 'meadow']]) {
    await dialog.getByRole('button', { name, exact: true }).click();
    await expect(card).toHaveAttribute('data-theme', theme);
    await expect(page.locator('.plant-card-print-root .plant-keepsake')).toHaveAttribute('data-theme', theme);
    await expect(dialog.getByRole('button', { name, exact: true })).toHaveAttribute('aria-pressed', 'true');
    await card.screenshot({ path: `.local/screenshots/plant-card-${theme}.png` });
  }
  await page.evaluate(() => { window.printCalls = 0; window.print = () => { window.printCalls += 1; }; });
  await dialog.getByRole('button', { name: 'Print card', exact: true }).click();
  expect(await page.evaluate(() => window.printCalls)).toBe(1);
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('#root')).toBeHidden();
  await expect(dialog).toBeHidden();
  const printed = page.locator('.plant-card-print-root .plant-keepsake');
  await expect(printed).toBeVisible();
  const size = await printed.boundingBox();
  expect(size.width).toBeCloseTo(70 * 96 / 25.4, 0);
  expect(size.height).toBeCloseTo(98 * 96 / 25.4, 0);
  const pdf = await page.pdf({ path: '.local/screenshots/plant-card.pdf', format: 'A4', printBackground: true, displayHeaderFooter: false });
  expect(pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)).toHaveLength(1);
  await page.emulateMedia({ media: 'screen' });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(page.locator('.plant-card-print-root')).toHaveCount(0);
  const student = page.locator('.student-card').filter({ has: page.getByRole('heading', { name: 'Emma', exact: true }) });
  await student.getByRole('button', { name: 'Give points', exact: true }).click();
  await expect(dialog).toHaveAccessibleName('A little love for Emma');
  await dialog.getByRole('button', { name: 'Give 10 points to Emma', exact: true }).click();
  await trigger.click();
  await expect(dialog.locator('.plant-keepsake-points strong')).toHaveText('155');
  expect(errors).toEqual([]);
});

test('all plant varieties print on mobile and maximum-length names stay within the card', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const longName = 'W'.repeat(60), className = 'W'.repeat(80);
  await page.setViewportSize({ width: 320, height: 640 });
  await page.addInitScript(({ plants, longName, className }) => {
    localStorage.setItem('sprout-classroom-v1', JSON.stringify({
      classroom: { id: 'demo', name: className, goal: 5000, theme: 'sunshine', decorations: [] },
      students: plants.map((plant, i) => ({ id: `card-${i}`, name: i === 0 ? longName : plant.name, plant: plant.id, points: i === 0 ? 2147483647 : i * 20 })), activities: [],
    }));
  }, { plants: PLANTS, longName, className });
  await page.goto('/');
  await openStudents(page);
  for (const [index, plant] of PLANTS.entries()) {
    const name = index === 0 ? longName : plant.name;
    await page.getByRole('button', { name: `View and print ${name}'s plant card`, exact: true }).click();
    const dialog = page.getByRole('dialog'), card = dialog.locator('.plant-keepsake');
    await expect(card.locator('.plant-keepsake-identity p')).toHaveText(plant.name);
    await expect(card.locator('.plant-keepsake-footer strong')).toHaveText(className);
    const measurements = await card.evaluate(element => {
      const bounds = element.getBoundingClientRect();
      return {
        insideViewport: bounds.left >= 0 && bounds.right <= innerWidth,
        noClipping: [...element.querySelectorAll('h3, strong, p')].every(text => text.scrollWidth <= text.clientWidth + 1 && text.getBoundingClientRect().bottom <= text.parentElement.getBoundingClientRect().bottom + 1),
      };
    });
    expect(measurements).toEqual({ insideViewport: true, noClipping: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (index === 0) {
      await mkdir('.local/screenshots', { recursive: true });
      await card.screenshot({ path: '.local/screenshots/plant-card-long-name.png' });
      await expect(card.locator('.plant-keepsake-points strong')).toHaveText('2,147,483,647');
    }
    if (plant.id === 'bonsai') await card.screenshot({ path: '.local/screenshots/plant-card-bonsai-mobile.png' });
    await dialog.getByRole('button', { name: 'Print card', exact: true }).scrollIntoViewIfNeeded();
    await expect(dialog.getByRole('button', { name: 'Print card', exact: true })).toBeInViewport();
    await page.keyboard.press('Escape');
  }
  expect(errors).toEqual([]);
});

test('card decorations are earned progressively without changing the final plant stage', async ({ page }) => {
  const levels = [0, 19, 20, 49, 50, 99, 100, 179, 180, 299, 300, 499, 500, 799, 800];
  await page.addInitScript(levels => {
    localStorage.setItem('sprout-classroom-v1', JSON.stringify({
      classroom: { id: 'demo', name: 'Card garden', goal: 10000, theme: 'sunshine', decorations: [] },
      students: levels.map(points => ({ id: `finish-${points}`, name: `Grower ${points}`, plant: 'sunflower', points })), activities: [],
    }));
  }, levels);
  await page.goto('/');
  await openStudents(page);
  for (const points of levels) {
    await page.getByRole('button', { name: `View and print Grower ${points}'s plant card`, exact: true }).click();
    const card = page.getByRole('dialog').locator('.plant-keepsake');
    const level = [20, 50, 100, 180, 300, 500, 800].filter(value => points >= value).length;
    await expect(card).toHaveAttribute('data-decoration', String(level));
    for (const [selector, at] of [['.plant-keepsake-halo',50], ['.plant-keepsake-orbit',100], ['.plant-keepsake-filigree',300], ['.plant-keepsake-foil',500], ['.plant-keepsake-jewels',800]]) {
      await expect(card.locator(selector)).toHaveCount(points >= at ? 1 : 0);
    }
    if (points >= 180) await expect(card).toHaveAttribute('data-rarity', 'Super bloom');
    await expect(page.locator('.plant-card-print-root .plant-keepsake')).toHaveAttribute('data-decoration', String(level));
    if ([0, 100, 800].includes(points)) await card.screenshot({ path: `.local/screenshots/card-finish-${points}.png` });
    await page.keyboard.press('Escape');
  }
});
