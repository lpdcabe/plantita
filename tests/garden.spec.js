import { test as base, expect } from './authenticated-fixture.js';
import { mkdir } from 'node:fs/promises';

const test = base.extend({
  runtimeErrors: [async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await use(errors);
    expect(errors, 'No uncaught browser exceptions').toEqual([]);
  }, { auto: true }],
});

const storedGarden = page => page.evaluate(() => JSON.parse(localStorage.getItem('sprout-classroom-v1')));
const plantButton = (page, name, points) => page.getByRole('button', { name: new RegExp(`^${name}, .*, ${points} points\\. Give points\\.$`) });
async function navigate(page, label) {
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: new RegExp(`^${label}`) }).click();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Our little garden');
  await expect(plantButton(page, 'Emma', 145)).toBeEnabled();
  expect((await storedGarden(page)).students).toHaveLength(12);
});

test('desktop garden gives twelve living plants room across pages without runtime errors', async ({ page }) => {
  await expect(plantButton(page, 'Emma', 145)).toBeVisible();
  await expect(page.locator('.plant-spot')).toHaveCount(8);
  await expect(page.getByRole('navigation', { name: 'Garden pages', exact: true })).toContainText('Page 1 of 2');
  await page.getByRole('button', { name: 'Next garden page', exact: true }).click();
  await expect(page.locator('.plant-spot')).toHaveCount(4);
  await expect(plantButton(page, 'Ethan', 25)).toBeVisible();
  await page.getByRole('button', { name: 'Previous garden page', exact: true }).click();
  await expect(page.getByText('Your classroom · saved to your account')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Interactive classroom garden' })).toBeVisible();
  await expect(page.getByRole('navigation').getByRole('button', { name: 'Activity', exact: true })).toHaveCount(0);
  await expect(page.locator('.activity-card')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await mkdir('.local/screenshots', { recursive: true });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: '.local/screenshots/garden-desktop.png', fullPage: true, animations: 'disabled' });
});

test('individual points persist after reload', async ({ page }) => {
  await plantButton(page, 'Emma', 145).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(plantButton(page, 'Emma', 155)).toBeVisible();
  await page.reload();
  await expect(plantButton(page, 'Emma', 155)).toBeVisible();
});

test('direct watering uses the selected preset and ignores rapid repeated taps', async ({ page }) => {
  await page.getByLabel('Watering reason').selectOption('Extra effort');
  const plant = page.locator('.plant-spot').filter({ has: page.locator('.plant-name', { hasText: 'Emma' }) });
  await plant.evaluate(element => { element.click(); element.click(); element.click(); });
  await expect(plantButton(page, 'Emma', 160)).toBeVisible();
  await expect(page.locator('.pouring-can')).toHaveCount(1);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(plant).toBeDisabled();
  await expect(page.locator('.pouring-can')).toHaveCSS('opacity', '1');
  await mkdir('.local/screenshots', { recursive: true });
  await page.locator('.garden-panel').screenshot({ path: '.local/screenshots/watering-garden.png' });
  const state = await storedGarden(page);
  expect(state.activities[0]).toMatchObject({ studentName: 'Emma', points: 15, reason: 'Extra effort' });
  expect(state.activities.filter(activity => !activity.sample)).toHaveLength(1);
});

test('watering everyone awards each student once and records each achievement', async ({ page }) => {
  const before = await storedGarden(page);
  await page.getByRole('button', { name: 'Water everyone', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const after = await storedGarden(page);
  expect(after.students.map(student => [student.id, student.points])).toEqual(before.students.map(student => [student.id, student.points + 10]));
  expect(after.activities.length).toBe(before.activities.length + before.students.length);
  expect(after.activities.slice(0, before.students.length).map(activity => activity.studentId).sort()).toEqual(before.students.map(student => student.id).sort());
  await page.reload();
  for (const student of before.students) {
    await page.getByLabel('Search garden', { exact: true }).fill(student.name);
    await expect(plantButton(page, student.name, student.points + 10)).toBeVisible();
  }
  expect((await storedGarden(page)).students).toEqual(after.students);
});

test('full-screen classroom waters plants directly with a visible watering can', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('sprout-classroom-v1'));
    for (let i = data.students.length; i < 30; i++) data.students.push({ id: `extra-${i}`, name: `Student ${i + 1}`, plant: 'sunflower', points: 100 });
    localStorage.setItem('sprout-classroom-v1', JSON.stringify(data));
    const classes = JSON.parse(localStorage.getItem('sprout-classrooms-v1'));
    classes.gardens = classes.gardens.map(g => g.classroom.id === data.classroom.id ? data : g);
    localStorage.setItem('sprout-classrooms-v1', JSON.stringify(classes));
  });
  await page.reload();
  expect((await storedGarden(page)).students).toHaveLength(30);
  await expect(plantButton(page, 'Emma', 145)).toBeEnabled();
  expect(await page.locator('.plant-spot').count()).toBeLessThan(30);
  await page.getByRole('button', { name: 'Open full screen garden', exact: true }).click();
  await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(true);
  for (const size of [{ width: 1920, height: 1080 }, { width: 1366, height: 768 }]) {
    await page.setViewportSize(size);
    await expect.poll(() => page.evaluate(() => {
      const scene = document.querySelector('.garden-scene').getBoundingClientRect();
      const grid = document.querySelector('.plant-grid');
      return grid.scrollHeight <= grid.clientHeight + 1 && [...document.querySelectorAll('.plant-spot')].every(element => {
        const rect = element.getBoundingClientRect();
        return rect.top >= scene.top && rect.bottom <= scene.bottom + 1 && rect.left >= scene.left && rect.right <= scene.right + 1;
      });
    })).toBe(true);
    await expect(page.getByRole('navigation', { name: 'Garden pages', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Next garden page', exact: true })).toBeEnabled();
  }
  await mkdir('.local/screenshots', { recursive: true });
  await page.screenshot({ path: '.local/screenshots/fullscreen-class.png', animations: 'disabled' });
  await page.getByLabel('Search garden', { exact: true }).fill('Emma');
  await plantButton(page, 'Emma', 145).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.pouring-can')).toBeVisible();
  expect(await page.evaluate(() => document.fullscreenElement.contains(document.querySelector('.pouring-can')))).toBe(true);
  await expect(plantButton(page, 'Emma', 155)).toBeVisible();
  await page.getByRole('button', { name: 'Exit full screen garden', exact: true }).click();
  await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(false);
});

test('teachers can add multiple students, edit a plant and name, then remove a student', async ({ page }) => {
  await page.getByRole('button', { name: 'Add student', exact: true }).click();
  await page.getByLabel(/Student names/).fill('Zoe\nKai');
  await page.getByRole('dialog').getByRole('button', { name: 'Lavender', exact: true }).click();
  await page.getByRole('button', { name: 'Plant a new beginning', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect((await storedGarden(page)).students).toHaveLength(14);
  await navigate(page, 'Students');
  await page.getByLabel('Search students', { exact: true }).fill('Zoe');
  await expect(page.locator('.student-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Edit Zoe', exact: true }).click();
  await page.getByRole('dialog').getByRole('textbox').fill('Zoey');
  await page.getByRole('dialog').getByRole('button', { name: 'Strawberry', exact: true }).click();
  await page.getByRole('button', { name: 'Save student', exact: true }).click();
  const student = page.locator('.student-card').filter({ has: page.getByRole('heading', { name: 'Zoey', exact: true }) });
  await expect(student).toContainText('Strawberry');
  await page.getByLabel('Search students', { exact: true }).fill('Kai');
  await page.getByRole('button', { name: 'Edit Kai', exact: true }).click();
  await page.getByRole('button', { name: 'Remove student', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveAccessibleName('Remove Kai?');
  await page.getByRole('button', { name: 'Remove student', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload();
  expect((await storedGarden(page)).students).toHaveLength(13);
  expect((await storedGarden(page)).students.some(student => student.name === 'Kai')).toBe(false);
  await page.getByLabel('Search garden', { exact: true }).fill('Zoey');
  await expect(page.getByRole('button', { name: 'Zoey, Strawberry, 0 points. Give points.', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Kai,/ })).toHaveCount(0);
});

test('theme and classroom goal changes persist and plant names can be toggled', async ({ page }) => {
  await page.getByLabel('Garden theme', { exact: true }).selectOption('sunset');
  await expect(page.locator('.garden-panel')).toHaveClass(/theme-sunset/);
  const visiblePlants = await page.locator('.plant-spot').count();
  await page.getByRole('button', { name: 'Hide student names', exact: true }).click();
  await expect(page.locator('.plant-name')).toHaveCount(0);
  await page.getByRole('button', { name: 'Show student names', exact: true }).click();
  await expect(page.locator('.plant-name')).toHaveCount(visiblePlants);
  await page.getByRole('button', { name: 'Edit class goal', exact: true }).click();
  await page.getByLabel('Classroom name').fill('Grade 2 Garden Club');
  await page.getByLabel(/Shared class goal/).fill('1600');
  await page.getByRole('dialog').getByRole('button', { name: 'Moonlight', exact: true }).click();
  await page.getByRole('button', { name: 'Save garden settings', exact: true }).click();
  await expect(page.locator('.garden-panel')).toHaveClass(/theme-moonlight/);
  await expect(page.locator('.class-switch')).toContainText('Grade 2 Garden Club');
  await expect(page.locator('.goal-numbers')).toContainText('1,600');
  await page.reload();
  await expect(page.locator('.garden-panel')).toHaveClass(/theme-moonlight/);
  await expect(page.locator('.class-switch')).toContainText('Grade 2 Garden Club');
});

test('roster search and growth-stage filters show matching students', async ({ page }) => {
  await navigate(page, 'Students');
  await page.getByRole('button', { name: 'In bloom', exact: true }).click();
  await expect(page.locator('.student-card')).toHaveCount(4);
  await page.getByLabel('Search students').fill('Emma');
  await expect(page.locator('.student-card')).toHaveCount(1);
  await expect(page.locator('.student-card')).toContainText('Emma');
  await page.getByRole('button', { name: 'Growing', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'No little growers found', exact: true })).toBeVisible();
  await page.getByLabel('Search students').fill('');
  await expect(page.locator('.student-card')).toHaveCount(8);
});

test('teacher sign-in dialog is keyboard accessible without submitting credentials', async ({ page }) => {
  await page.getByRole('button', { name: 'My account', exact: true }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  const trigger = page.getByRole('button', { name: 'Sign in', exact: true }).first();
  await trigger.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toHaveAccessibleName('A home for your classroom');
  await expect(page.getByLabel('Teacher email')).toBeFocused();
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create account', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Open my classroom', exact: true })).toBeVisible();
  await expect(dialog).toContainText('Contact your school administrator');
  await page.getByRole('button', { name: 'Close dialog', exact: true }).focus();
  await page.keyboard.press('Shift+Tab');
  expect(await page.evaluate(() => document.querySelector('[role="dialog"]').contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test.describe('mobile garden', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test('fits the screen and supports navigation and point dialogs', async ({ page }) => {
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await mkdir('.local/screenshots', { recursive: true });
    await page.screenshot({ path: '.local/screenshots/garden-mobile.png', fullPage: true, animations: 'disabled' });
    await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
    await navigate(page, 'Students');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Meet our little growers');
    await expect(page.locator('.sidebar')).not.toHaveClass(/is-open/);
    await page.getByRole('button', { name: 'Edit Emma', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
    await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
    await navigate(page, 'My garden');
    await plantButton(page, 'Emma', 145).click();
    await expect(plantButton(page, 'Emma', 155)).toBeVisible();
  });
});
