// Browser checks for the interface layer in dist/app.js: keyboard play, pausing,
// dialogs, mode switching and accessibility. Run with `npm run test:browser`.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createReadStream, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

const root = new URL('../../dist/', import.meta.url).pathname;
const axeSource = createRequire(import.meta.url)('axe-core').source;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
let server;
let browser;
let baseUrl;

before(async () => {
  server = createServer((request, response) => {
    const path = normalize(decodeURIComponent(new URL(request.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
    const file = join(root, path.endsWith('/') ? `${path}index.html` : path);
    if (!file.startsWith(root) || !existsSync(file)) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(response);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}/`;
  // CHROMIUM_PATH lets a machine with a preinstalled browser skip `playwright install`.
  browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
});

after(async () => {
  await browser?.close();
  await new Promise(resolve => server?.close(resolve) ?? resolve());
});

async function openGame(options = {}) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', entry => { if (entry.type() === 'error') errors.push(entry.text()); });
  // Fonts come from Google; keep the tests offline and deterministic.
  await page.route(/fonts\.(googleapis|gstatic)\.com/, route => route.abort());
  await page.goto(baseUrl);
  return { page, errors, close: () => context.close() };
}

const status = page => page.evaluate(() => document.body.dataset.status);

test('the page boots without script errors and shows the three-character preview', async () => {
  const { page, errors, close } = await openGame();
  assert.equal(await status(page), 'ready');
  assert.equal(await page.locator('.hole').count(), 9);
  assert.equal(await page.locator('.hole.up.demo').count(), 3);
  assert.deepEqual(errors.filter(text => !/ERR_FAILED|net::/.test(text)), []);
  await close();
});

test('keyboard play: start, whack an empty key, pause with P and resume', async () => {
  const { page, close } = await openGame();
  await page.focus('#start');
  await page.keyboard.press('Enter');
  assert.equal(await status(page), 'playing');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'game-board');

  const emptyKey = await page.evaluate(() => {
    const keys = ['q', 'w', 'e', 'a', 's', 'd', 'z', 'x', 'c'];
    const index = [...document.querySelectorAll('.hole')].findIndex(hole => !hole.classList.contains('up'));
    return keys[index];
  });
  await page.keyboard.press(emptyKey);
  await page.waitForFunction(() => /Nothing there/.test(document.querySelector('#message').textContent));

  await page.keyboard.press('p');
  assert.equal(await status(page), 'paused');
  assert.equal(await page.locator('#board-overlay').isVisible(), true);
  assert.equal(await page.evaluate(() => document.querySelector('#game-board').inert), true);

  await page.keyboard.press('p');
  assert.equal(await status(page), 'playing');
  assert.equal(await page.evaluate(() => document.querySelector('#game-board').inert), false);
  await close();
});

test('pausing from a focused key moves focus to the overlay button', async () => {
  const { page, close } = await openGame();
  await page.click('#start');
  await page.focus('.hole[data-slot="4"]');
  await page.keyboard.press('p');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'resume');
  await page.keyboard.press('Enter');
  assert.equal(await status(page), 'playing');
  await close();
});

test('the help dialog pauses a running game and resumes it on close', async () => {
  const { page, close } = await openGame();
  await page.click('#start');
  await page.click('#help');
  assert.equal(await page.locator('#help-dialog').isVisible(), true);
  assert.equal(await status(page), 'paused');
  await page.keyboard.press('Escape');
  assert.equal(await status(page), 'playing');
  await close();
});

test('choosing Chill mode updates the advertised round length', async () => {
  const { page, close } = await openGame();
  await page.click('[data-mode="chill"]');
  assert.equal(await page.getAttribute('[data-mode="chill"]', 'aria-pressed'), 'true');
  assert.equal(await page.textContent('#intro-seconds'), '60');
  assert.match(await page.textContent('#timer'), /^60/);
  await page.click('#start');
  assert.equal(await page.isDisabled('[data-mode="normal"]'), true);
  await close();
});

test('a finished round shows the result dialog and stores the best score per mode', async () => {
  const { page, close } = await openGame();
  await page.clock.install();
  await page.goto(baseUrl);
  await page.click('#start');
  // Bonk visible bugs for a while so the score is positive, then let time run out.
  for (let step = 0; step < 40; step += 1) {
    await page.evaluate(() => {
      document.querySelectorAll('.hole.up.bug:not(.hit), .hole.up.bonus:not(.hit)').forEach(hole => hole.click());
    });
    await page.clock.runFor(300);
  }
  await page.clock.runFor(60_000);
  await page.waitForFunction(() => document.querySelector('#result-dialog').open);
  const score = Number(await page.textContent('#final-score'));
  assert.ok(score > 0, `expected a positive score, got ${score}`);
  assert.equal(await page.evaluate(() => Number(localStorage.getItem('whack-a-bug:best:normal'))), score);
  assert.match(await page.textContent('#result-badge'), /NEW PERSONAL BEST/);
  await close();
});

test('reduced motion disables particles and the custom cursor', async () => {
  const { page, close } = await openGame({ reducedMotion: 'reduce' });
  await page.click('#start');
  await page.evaluate(() => document.querySelector('.hole.up')?.click());
  assert.equal(await page.locator('#particles .particle').count(), 0);
  assert.equal(await page.locator('#cursor-mallet').isVisible(), false);
  await close();
});

test('phone-width layout does not scroll horizontally', async () => {
  const { page, close } = await openGame({ viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await close();
});

test('axe finds no serious accessibility violations outside the decorative headline', async () => {
  const { page, close } = await openGame();
  await page.addScriptTag({ content: axeSource });
  const violations = await page.evaluate(async () => {
    const result = await window.axe.run({ exclude: [['.bug-word']] }, {
      resultTypes: ['violations'],
      // The preview keys show a "+25" badge that is intentionally hidden from assistive tech.
      rules: { 'label-content-name-mismatch': { enabled: false } },
    });
    return result.violations
      .filter(violation => ['serious', 'critical'].includes(violation.impact))
      .map(violation => `${violation.id}: ${violation.nodes.map(node => node.target.join(' ')).join(', ')}`);
  });
  assert.deepEqual(violations, []);
  await close();
});

test('help and result dialogs meet colour-contrast requirements', async () => {
  const { page, close } = await openGame();
  await page.addScriptTag({ content: axeSource });
  for (const id of ['help-dialog', 'result-dialog']) {
    const violations = await page.evaluate(async dialogId => {
      document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
      document.getElementById(dialogId).showModal();
      const result = await window.axe.run(`#${dialogId}`, { runOnly: ['color-contrast'] });
      return result.violations.flatMap(violation => violation.nodes.map(node => node.target.join(' ')));
    }, id);
    assert.deepEqual(violations, [], id);
  }
  await close();
});
