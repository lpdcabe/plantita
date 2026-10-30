import { test, expect } from './authenticated-fixture.js';
test('high-point plants retain Super bloom without extra branches', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('sprout-classroom-v1', JSON.stringify({
      classroom: { id: 'demo', name: 'Our garden', goal: 5000, theme: 'sunshine', decorations: [] },
      students: [{ id: 'emma', name: 'Emma', plant: 'sunflower', points: 880 }], activities: [],
    }));
  });
  await page.goto('/');
  await expect(page.locator('.plant-art [data-growth-stage]')).toHaveAttribute('data-growth-stage', '4');
  await expect(page.locator('.plant-art [data-extra-growth]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Emma, Sunflower, 880 points. Give points.', exact: true })).toBeVisible();
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: /^Students/ }).click();
  await page.getByRole('button', { name: "View and print Emma's plant card", exact: true }).click();
  await expect(page.getByRole('dialog').locator('[data-extra-growth]')).toHaveCount(0);
  await expect(page.getByRole('dialog').locator('[data-growth-stage]')).toHaveAttribute('data-growth-stage', '4');
});
