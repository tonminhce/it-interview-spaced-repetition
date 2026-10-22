/**
 * Minimal Chrome DevTools Protocol driver.
 *
 * Uses Node's built-in fetch + WebSocket (Node 22+) so the repo needs no
 * dependencies. Drives a headless Chrome instance to exercise the app the way
 * a person would — clicking, typing, and capturing screenshots — and reports
 * any console errors along the way.
 *
 * Usage: node tools/browser-drive.js <scenario>
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ROOT = path.resolve(__dirname, '..');

/**
 * Resolve the URL of the app's index page.
 * APP_BASE may be a site root (http://127.0.0.1:8000) or a full document URL
 * (http://127.0.0.1:8000/index.html); both are accepted.
 */
function resolveBase(raw) {
  if (!raw) return 'file:///' + ROOT.replace(/\\/g, '/') + '/index.html';
  const trimmed = raw.replace(/\/+$/, '');
  return /\.html?$/i.test(trimmed) ? trimmed : trimmed + '/index.html';
}

const BASE = resolveBase(process.env.APP_BASE);
const PORT = 9333;
const OUT = path.join(os.tmpdir(), 'it-interview-shots');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function launchChrome() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'cdp-profile-'));
  const proc = spawn(CHROME, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--remote-debugging-port=' + PORT,
    '--user-data-dir=' + profile,
    '--window-size=1440,1000',
    'about:blank'
  ], { stdio: 'ignore' });

  proc.profileDir = profile;
  return proc;
}

async function getTarget() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const targets = await res.json();
      const page = targets.find((t) => t.type === 'page');
      if (page && page.webSocketDebuggerUrl) return page;
    } catch (e) { /* not up yet */ }
    await sleep(250);
  }
  throw new Error('Chrome DevTools endpoint did not come up');
}

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let id = 0;
    const pending = new Map();
    const listeners = [];

    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        const { resolve: res, reject: rej } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) rej(new Error(msg.error.message));
        else res(msg.result);
      } else if (msg.method) {
        listeners.forEach((fn) => fn(msg));
      }
    });

    ws.addEventListener('error', reject);
    ws.addEventListener('open', () => resolve({
      send(method, params) {
        return new Promise((res, rej) => {
          const msgId = ++id;
          pending.set(msgId, { resolve: res, reject: rej });
          ws.send(JSON.stringify({ id: msgId, method, params: params || {} }));
        });
      },
      on(fn) { listeners.push(fn); },
      close() { ws.close(); }
    }));
  });
}

async function main() {
  const scenario = process.argv[2] || 'tour';
  fs.mkdirSync(OUT, { recursive: true });

  const chrome = launchChrome();
  const errors = [];
  let cdp;

  try {
    const target = await getTarget();
    cdp = await connect(target.webSocketDebuggerUrl);

    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Log.enable');

    cdp.on((msg) => {
      if (msg.method === 'Runtime.exceptionThrown') {
        errors.push('EXCEPTION: ' + (msg.params.exceptionDetails.exception?.description ||
          msg.params.exceptionDetails.text));
      }
      if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
        errors.push('CONSOLE ERROR: ' + msg.params.entry.text);
      }
      if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
        errors.push('CONSOLE ERROR: ' + msg.params.args.map((a) => a.value ?? a.description).join(' '));
      }
    });

    const evaluate = async (expression) => {
      const res = await cdp.send('Runtime.evaluate', {
        expression, returnByValue: true, awaitPromise: true
      });
      if (res.exceptionDetails) {
        throw new Error(res.exceptionDetails.exception?.description || 'eval failed');
      }
      return res.result.value;
    };

    const shot = async (name) => {
      const res = await cdp.send('Page.captureScreenshot', { format: 'png' });
      const file = path.join(OUT, name + '.png');
      fs.writeFileSync(file, Buffer.from(res.data, 'base64'));
      console.log('  shot → ' + file);
    };

    const goto = async (hash) => {
      await cdp.send('Page.navigate', { url: BASE + hash });
      await sleep(1400);
    };

    /** Press a key for real, through the browser's input pipeline. */
    const pressKey = async (key, code, keyCode) => {
      await cdp.send('Input.dispatchKeyEvent', {
        type: 'keyDown', key, code,
        windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode
      });
      await cdp.send('Input.dispatchKeyEvent', {
        type: 'keyUp', key, code,
        windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode
      });
    };

    const scenarios = {
      async globals() {
        await goto('#/study/java');
        const g = await evaluate(
          "({ Icons: typeof Icons, U: typeof U, Synonyms: typeof Synonyms, Store: typeof Store," +
          " Markdown: typeof Markdown, Search: typeof Search, Palette: typeof Palette," +
          " HomeView: typeof HomeView, StudyView: typeof StudyView, BrowseView: typeof BrowseView," +
          " App: typeof App, showHint: typeof (window.StudyView ? StudyView.showHint : 'no-view')," +
          " hintSlot: !!document.getElementById('hint-slot') })"
        );
        console.log('  globals: ' + JSON.stringify(g));
      },

      async hintFlow() {
        await goto('#/study/java');
        await evaluate("document.getElementById('reveal-trigger').click()");
        await sleep(300);

        // Press H for the hint.
        await pressKey('h', 'KeyH', 72);
        await sleep(500);

        const hint = await evaluate(`({
          hasPanel: !!document.querySelector('.hint'),
          text: document.querySelector('.hint__text') ? document.querySelector('.hint__text').textContent.slice(0, 90) : null,
          hintButtonSpent: !!document.querySelector('[data-action="hint"][disabled]')
        })`);
        console.log('  hint: ' + JSON.stringify(hint));

        // Rate "Nhớ được" (3). Because a hint was shown it must be recorded
        // as "Nhớ một phần" (2): ease 2.35 rather than 2.5.
        await evaluate("document.querySelector('[data-rating=\"3\"]').click()");
        await sleep(700);

        const rec = await evaluate(`(() => {
          const srs = JSON.parse(localStorage.getItem('srs_progress_v1') || '{}');
          const key = Object.keys(srs.cards || {})[0];
          return { key, ease: srs.cards[key].ease, reps: srs.cards[key].reps };
        })()`);
        console.log('  recorded: ' + JSON.stringify(rec));
        console.log('  EXPECTED ease 2.35 (downgraded from 2.5)');
        await shot('40-hint');
      },

      async synonymFlow() {
        await goto('#/home');

        const paletteSearch = async (q) => {
          await evaluate("if (window.Palette && Palette.isOpen()) Palette.close()");
          await evaluate("document.getElementById('search-trigger').click()");
          await sleep(300);
          await evaluate(`(() => {
            const i = document.getElementById('palette-input');
            i.value = ${JSON.stringify(q)};
            i.dispatchEvent(new Event('input', { bubbles: true }));
          })()`);
          await sleep(600);
          return evaluate(`({
            count: document.querySelectorAll('.palette__item').length,
            topics: Array.from(document.querySelectorAll('.palette__item .chip')).map(c => c.textContent).slice(0, 5),
            first: document.querySelector('.palette__item-title') ? document.querySelector('.palette__item-title').textContent.slice(0, 70) : null
          })`);
        };

        console.log('  "bo nho dem" → ' + JSON.stringify(await paletteSearch('bo nho dem')));
        console.log('  "bộ nhớ đệm"  → ' + JSON.stringify(await paletteSearch('bộ nhớ đệm')));
        console.log('  "orchestration" → ' + JSON.stringify(await paletteSearch('orchestration')));
        console.log('  "khoa phan tan" → ' + JSON.stringify(await paletteSearch('khoa phan tan')));
        await shot('41-synonyms');
      },

      async timerFlow() {
        await goto('#/study/redis');
        await sleep(400);

        const before = await evaluate("document.getElementById('timer-clock').textContent");
        console.log('  clock at start: ' + before);

        // Change the round length through the select.
        await evaluate(`(() => {
          const s = document.getElementById('timer-length');
          s.value = '10';
          s.dispatchEvent(new Event('change', { bubbles: true }));
        })()`);
        await sleep(400);
        console.log('  clock after selecting 10 min: ' +
          await evaluate("document.getElementById('timer-clock').textContent"));

        // Fast-forward to the end of the round.
        await evaluate("Store.state.timer.remaining = 2");
        await sleep(3200);

        const breakState = await evaluate(`({
          modal: !!document.getElementById('break-modal'),
          clock: document.getElementById('break-clock') ? document.getElementById('break-clock').textContent : null,
          mode: Store.state.timer.mode
        })`);
        console.log('  break state: ' + JSON.stringify(breakState));
        await shot('42-break');

        // Resume.
        await evaluate("document.querySelector('[data-break=\"resume\"]').click()");
        await sleep(400);
        console.log('  after resume: ' + JSON.stringify(await evaluate(`({
          modal: !!document.getElementById('break-modal'),
          mode: Store.state.timer.mode,
          clock: document.getElementById('timer-clock').textContent
        })`)));
      },

      async browseFlow() {
        const state = async (label) => {
          const s = await evaluate(`({
            hash: location.hash,
            view: Store.state.view,
            topicId: Store.state.topicId === undefined ? 'undefined' : Store.state.topicId,
            queueLen: Store.state.queue.length,
            // How many delegated click listeners have accumulated on #app?
            appListeners: (window.__listenerProbe = window.__listenerProbe || 0)
          })`);
          console.log('  ' + label + ': ' + JSON.stringify(s));
          return s;
        };

        await goto('#/browse/java');
        await state('browse/java loaded');

        // Click the first question row, then come back.
        await evaluate("document.querySelector('.q-row').click()");
        await sleep(600);
        await state('after clicking a question row');

        // Now click "Ôn chuyên đề này" from the browse view.
        await evaluate("document.querySelector('[data-action=\"browse\"]').click()");
        await sleep(500);
        await state('back in browse');

        await evaluate("document.querySelector('[data-action=\"study\"]').click()");
        await sleep(700);
        const s = await state('after "Ôn chuyên đề này"');
        console.log('  EXPECTED topicId=java, GOT: ' + s.topicId + '  hash=' + s.hash);

        const title = await evaluate(
          "document.querySelector('.study-bar__title') ? document.querySelector('.study-bar__title').textContent.trim() : '(none)'"
        );
        console.log('  study bar title: ' + title);
      },

      async doubleRate() {
        // Navigate home -> study -> home -> study, then rate once and see how
        // many reviews were recorded.
        await goto('#/home');
        await goto('#/study/redis');
        await goto('#/home');
        await goto('#/study/redis');
        await sleep(400);

        const before = await evaluate(
          "Object.keys(JSON.parse(localStorage.getItem('srs_progress_v1')||'{}').cards||{}).length"
        );
        await evaluate("document.getElementById('reveal-trigger').click()");
        await sleep(400);
        await evaluate("document.querySelector('[data-rating=\"3\"]').click()");
        await sleep(700);

        const after = await evaluate(`({
          cards: Object.keys(JSON.parse(localStorage.getItem('srs_progress_v1')||'{}').cards||{}).length,
          reviews: (JSON.parse(localStorage.getItem('srs_progress_v1')||'{}').stats||{}).reviewsToday,
          counter: document.getElementById('study-counter') ? document.getElementById('study-counter').textContent : '(none)'
        })`);
        console.log('  cards before: ' + before + ' | after: ' + JSON.stringify(after));
        console.log('  EXPECTED exactly 1 review, 1 card');
      },

      async diag() {
        const probe = async (label) => {
          const s = await evaluate(`({
            url: location.href,
            hash: location.hash,
            view: window.Store && Store.state.view,
            topic: window.Store && Store.state.topicId,
            hasTrigger: !!document.getElementById('reveal-trigger'),
            appHtmlLen: (document.getElementById('app')||{innerHTML:''}).innerHTML.length,
            readyState: document.readyState
          })`);
          console.log('  ' + label + ': ' + JSON.stringify(s));
        };

        await probe('initial');
        await goto('#/home');
        await probe('after goto #/home');
        await goto('#/study/java');
        await probe('after goto #/study/java');
        await sleep(500);
        await probe('after 500ms settle');
      },

      async tour() {
        await goto('#/home');
        await shot('01-home');

        await goto('#/study/java');
        await shot('02-study-closed');

        // Reveal the answer and capture the expanded state.
        await evaluate("document.getElementById('reveal-trigger').click()");
        await sleep(700);
        await shot('03-study-revealed');

        // Confirm the disclosure actually expanded rather than just repainted.
        const height = await evaluate(
          "document.querySelector('.reveal__inner').getBoundingClientRect().height"
        );
        console.log('  revealed answer height: ' + Math.round(height) + 'px');

        // Scroll down so the sticky question bar is exercised.
        await evaluate('window.scrollTo(0, 500)');
        await sleep(500);
        await shot('04-study-scrolled-sticky');

        await goto('#/browse/all');
        await shot('05-browse');

        // Open the command palette.
        await evaluate("document.getElementById('search-trigger').click()");
        await sleep(500);
        await shot('06-palette-empty');

        // Type a diacritic-free query and check that it matches accented text.
        await evaluate(`(() => {
          const i = document.getElementById('palette-input');
          i.value = 'cong nghe';
          i.dispatchEvent(new Event('input', { bubbles: true }));
        })()`);
        await sleep(700);
        await shot('07-palette-search');

        const results = await evaluate(
          "Array.from(document.querySelectorAll('.palette__item-title')).slice(0,5).map(n => n.textContent)"
        );
        console.log('  palette results: ' + JSON.stringify(results));
      },

      async light() {
        await goto('#/home');
        await evaluate("window.Store.applyTheme('light')");
        await sleep(500);
        await shot('10-home-light');

        await goto('#/study/java');
        await evaluate("document.getElementById('reveal-trigger').click()");
        await sleep(700);
        await shot('11-study-light');

        await goto('#/browse/all');
        await shot('12-browse-light');
      },

      async paletteFlow() {
        // Open the palette, search, and pick a result: the answer should
        // already be expanded when the card opens.
        await goto('#/home');
        await evaluate("document.getElementById('search-trigger').click()");
        await sleep(400);
        await evaluate(`(() => {
          const i = document.getElementById('palette-input');
          i.value = 'kafka partition';
          i.dispatchEvent(new Event('input', { bubbles: true }));
        })()`);
        await sleep(600);
        await evaluate("document.querySelector('.palette__item').click()");
        await sleep(900);
        await shot('20-palette-to-study');

        const state = await evaluate(`({
          revealed: document.getElementById('answer-region').classList.contains('is-open'),
          height: Math.round(document.querySelector('.reveal__inner').getBoundingClientRect().height),
          hash: location.hash
        })`);
        console.log('  after palette pick: ' + JSON.stringify(state));
      },

      async mobile() {
        // Emulate a phone viewport.
        await cdp.send('Emulation.setDeviceMetricsOverride', {
          width: 390, height: 844, deviceScaleFactor: 2, mobile: true
        });
        await goto('#/home');
        await shot('30-mobile-home');
        await goto('#/study/java');
        await shot('31-mobile-study');
        await evaluate("document.getElementById('reveal-trigger').click()");
        await sleep(700);
        await shot('32-mobile-revealed');
        await evaluate("document.getElementById('search-trigger').click()");
        await sleep(500);
        await shot('33-mobile-palette');
      },

      async rateFlow() {
        // Rate a card, verify the schedule advanced and undo restores it.
        await goto('#/study/redis');
        await evaluate("document.getElementById('reveal-trigger').click()");
        await sleep(600);
        await evaluate("document.querySelector('[data-rating=\"3\"]').click()");
        await sleep(700);
        await shot('21-after-rating');

        const after = await evaluate(`({
          counter: document.getElementById('study-counter').textContent,
          stored: JSON.parse(localStorage.getItem('srs_progress_v1') || '{}')
        })`);
        console.log('  after rating: ' + after.counter);
        const cards = (after.stored && after.stored.cards) || {};
        const keys = Object.keys(cards);
        console.log('  scheduled cards: ' + keys.length + ' | first: ' +
          (keys[0] ? JSON.stringify(cards[keys[0]]) : 'none'));

        const undoVisible = await evaluate(
          "!!document.querySelector('.toast__action')"
        );
        console.log('  undo offered: ' + undoVisible);
        await shot('22-undo-toast');
      }
    };

    if (!scenarios[scenario]) {
      console.error('Unknown scenario: ' + scenario + '. Available: ' + Object.keys(scenarios).join(', '));
      process.exitCode = 2;
    } else {
      try {
        await scenarios[scenario]();
      } catch (err) {
        console.log('\nSCENARIO FAILED: ' + err.message);
        process.exitCode = 1;
      }
    }

    if (errors.length) {
      console.log('\n--- PAGE ERRORS (' + errors.length + ') ---');
      [...new Set(errors)].forEach((e) => console.log('  ' + e));
      process.exitCode = 1;
    } else {
      console.log('\nNo page errors.');
    }
  } finally {
    if (cdp) cdp.close();
    chrome.kill();
    try { fs.rmSync(chrome.profileDir, { recursive: true, force: true }); } catch (e) { /* ignore */ }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
