# Whack-a-Bug

Squash the bugs. Spare the bots. Keep the combo alive.

A quick browser arcade game by [Ádám Porkoláb](https://github.com/aporkolab), built with AI assistance. Nine holes, two modes, and a Bot Buddy that helps clear the board. Designed for <https://aporkolab.github.io/>.

## Play

Choose **Normal** for a 45-second round or **Chill** for a slower 60-second round. Click or tap a hole, or use the keyboard:

| Row | Left | Centre | Right |
| --- | --- | --- | --- |
| Top | Q | W | E |
| Middle | A | S | D |
| Bottom | Z | X | C |

| Target | Base score |
| --- | ---: |
| Bug | +10 |
| Bonus bug | +25 |
| Friendly bot | −20 |
| Empty hole | −5 |

Every five consecutive bug hits raises the multiplier, up to **5×**. An escaped bug, a friendly-bot hit, or an empty-hole hit breaks the combo. Your score never falls below zero.

Six manual bug hits charge **Bot Buddy**. Activate it to clear the visible bugs and bonus bugs while leaving friendly bots alone. Assisted hits score points but do not recharge the ability.

Everything runs locally in the browser. Bot Buddy is a game mechanic; it does not call an LLM or require an API key. The illustrations are local SVG artwork defined in source code.

## Run locally

Serve the static files with Python 3:

```bash
python3 -m http.server 8000 --directory dist
```

Open <http://localhost:8000>. Use an HTTP server because the game loads native JavaScript modules.

The application is buildless. The files in `dist/` are the maintained application source and the deployable site. No bundler is involved, and playing or serving the game needs no dependency installation; `npm ci` only installs the development tools below.

## Test

With Node.js 22 or later (CI uses 22 and 26):

```bash
npm ci                 # dev tools only: ESLint, Playwright, axe-core
npm run lint           # ESLint over the site and the tests
npm test               # engine and artwork unit tests, no browser needed
npm run test:browser   # Playwright + axe checks against dist/
```

`npm test` uses Node's built-in test runner. The engine tests cover deterministic spawning, round timing, scoring, combos, pauses, Bot Buddy, and invalid inputs; the artwork tests check that every character renders decorative, ID-free SVG.

`npm run test:browser` serves `dist/` on a random local port and drives Chromium. It covers keyboard play, pausing and focus handling, the help and result dialogs, mode switching, the stored personal best, reduced motion, phone-width layout, and axe colour-contrast and accessibility checks. Install the browser once with `npx playwright install chromium`, or point `CHROMIUM_PATH` at an existing Chromium binary.

The `CI` workflow runs lint and all tests on every branch push and pull request. The Pages workflow runs lint and the unit tests before uploading the site.

## Deploy to GitHub Pages

The account-root URL requires the specially named repository `aporkolab/aporkolab.github.io`. It is a user site, not an automatically created repository.

For a first deployment:

1. Create a **public** repository named **`aporkolab.github.io`** under **`aporkolab`**, if it does not already exist.
2. Put this project's files in that repository, keeping the `.github/workflows/pages.yml` workflow and the `dist/` directory, and push them to **`main`**.
3. Open **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.
4. In **Actions**, run **Test and deploy Whack-a-Bug** if the initial push occurred before Pages was enabled.
5. After the deploy job succeeds, open <https://aporkolab.github.io/>.

Later pushes to `main` automatically lint, test, and publish `dist/`. The workflow uses the official GitHub Pages artifact deployment actions and the `github-pages` environment. It needs no personal access token or custom deployment secret.

GitHub's [custom Pages workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) explains the publishing source, artifact, permissions, and deployment environment.

## Source map

| File | Responsibility |
| --- | --- |
| `dist/index.html` | Application shell and semantic interface |
| `dist/styles.css` | Visual design and responsive layout |
| `dist/art.js` | Local SVG characters and artwork |
| `dist/app.js` | Browser interactions and rendering |
| `dist/engine.js` | Game state, spawning, timing, and scoring |
| `dist/favicon.svg` | Site icon |
| `tests/*.test.mjs` | Game engine and artwork unit tests |
| `tests/browser/*.test.mjs` | Browser, keyboard, and accessibility tests |
| `eslint.config.js` | Lint rules |
| `.github/workflows/ci.yml` | Lint and tests on branches and pull requests |
| `.github/workflows/pages.yml` | Lint, test, package, and Pages deployment |
| `.github/dependabot.yml` | Monthly npm and GitHub Actions updates |
