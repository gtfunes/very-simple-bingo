const STORAGE_KEY = 'bolillero:v1';
const BALL_OPTIONS = [75, 90];
const DEFAULT_MAX = 90;
const ROLL_MS = 800;
const HISTORY_SIZE = 5;
const VOICE_TIMEOUT_MS = 2500;
// Pause between the number and its digits: "47" … "cuatro, siete".
const DIGITS_PAUSE_MS = 300;
const VOICE_LANGS = ['es-ar', 'es-419', 'es-mx', 'es-us', 'es-es'];
// Apple lists its robotic "Eloquence" voices first; skip them for a natural one (Paulina, Mónica…).
const ROBOTIC_VOICES = /^(eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley)\b|eloquence/i;
const DIGIT_WORDS = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];

const els = {
  ball: document.getElementById('ball'),
  current: document.getElementById('current'),
  status: document.getElementById('status'),
  announce: document.getElementById('announce'),
  draw: document.getElementById('draw'),
  repeat: document.getElementById('repeat'),
  actions: document.querySelector('.actions'),
  history: document.getElementById('history'),
  board: document.getElementById('board'),
  count: document.getElementById('count'),
  max: document.getElementById('max'),
  mute: document.getElementById('mute'),
  reset: document.getElementById('reset'),
};

const speech = 'speechSynthesis' in window ? window.speechSynthesis : null;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

let state = load();
let rolling = false;
let voice = null;
let utterance = null;
let speakTimer = null;
let followUpTimer = null;
let voiceTimer = null;
let voiceProblem = false;
let wakeLock = null;
let wakeLockPending = false;
let cells = [];

// --- State -----------------------------------------------------------------

function readSaved() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && BALL_OPTIONS.includes(saved.max) && Array.isArray(saved.drawn)) {
      const drawn = saved.drawn.filter((n) => Number.isInteger(n) && n >= 1 && n <= saved.max);
      return { max: saved.max, drawn: [...new Set(drawn)], muted: Boolean(saved.muted) };
    }
  } catch {
    // Storage blocked or corrupt.
  }
  return null;
}

function load() {
  return readSaved() ?? { max: DEFAULT_MAX, drawn: [], muted: false };
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage blocked: the game still works, it just won't survive a reload.
  }
}

// Another tab with the same game may have drawn balls; adopt its state so we never repeat one.
function syncFromStorage() {
  const saved = readSaved();
  if (!saved || rolling) return;
  const maxChanged = saved.max !== state.max;
  state = saved;
  if (maxChanged) buildBoard();
  render();
}

function remaining() {
  const drawn = new Set(state.drawn);
  const pool = [];
  for (let n = 1; n <= state.max; n += 1) {
    if (!drawn.has(n)) pool.push(n);
  }
  return pool;
}

function randomIndex(length) {
  const [value] = crypto.getRandomValues(new Uint32Array(1));
  return value % length;
}

// --- Voice -----------------------------------------------------------------

function pickVoice() {
  const langOf = (v) => v.lang.replace('_', '-').toLowerCase();
  const spanish = speech
    .getVoices()
    .filter((v) => langOf(v).startsWith('es') && !ROBOTIC_VOICES.test(v.name) && !ROBOTIC_VOICES.test(v.voiceURI));
  voice =
    spanish.find((v) => v.default) ??
    VOICE_LANGS.map((lang) => spanish.find((v) => langOf(v) === lang)).find(Boolean) ??
    spanish[0] ??
    null;
}

function setVoiceProblem(value) {
  if (voiceProblem === value) return;
  voiceProblem = value;
  render();
}

function stopSpeech() {
  clearTimeout(speakTimer);
  clearTimeout(followUpTimer);
  clearTimeout(voiceTimer);
  // Forget the current utterance so its "end" event (fired on cancel by some engines) queues nothing.
  utterance = null;
  speech?.cancel();
}

function speak(text, volume = 1) {
  if (!speech) return;
  if (!voice) pickVoice();
  // Any new speech replaces a follow-up that is still waiting.
  clearTimeout(followUpTimer);
  // Kept in a module variable: Chrome can garbage-collect a local utterance before its events fire.
  utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = voice?.lang ?? 'es-AR';
  if (voice) utterance.voice = voice;
  utterance.rate = 0.9;
  utterance.volume = volume;

  if (volume > 0) {
    // If the voice never starts (iOS did not unlock it, no Spanish voice…), tell the host.
    clearTimeout(voiceTimer);
    voiceTimer = setTimeout(() => setVoiceProblem(true), VOICE_TIMEOUT_MS);
    utterance.onstart = () => {
      clearTimeout(voiceTimer);
      setVoiceProblem(false);
    };
    utterance.onerror = (event) => {
      if (event.error === 'interrupted' || event.error === 'canceled') return;
      clearTimeout(voiceTimer);
      setVoiceProblem(true);
    };
  }

  const next = utterance;
  clearTimeout(speakTimer);
  // Chrome can stay paused after the tab was in the background.
  if (speech.paused) speech.resume();
  if (speech.speaking || speech.pending) {
    speech.cancel();
    // Some engines drop a speak() that comes right after cancel(), so give it a moment.
    speakTimer = setTimeout(() => speech.speak(next), 60);
  } else {
    speech.speak(next);
  }
}

// iOS only lets a page speak after a speak() call inside a user gesture.
// The real announcement comes after the roll animation, so unlock speech on every tap.
function primeSpeech() {
  if (!speech || state.muted || speech.speaking || speech.pending) return;
  speak(' ', 0);
}

// Says each part in turn, waiting DIGITS_PAUSE_MS after one ends before the next starts.
function speakParts([first, ...rest]) {
  speak(first);
  if (rest.length === 0) return;
  const current = utterance;
  current.onend = () => {
    // Newer speech (or stopSpeech) replaced this utterance: drop the rest.
    if (utterance !== current) return;
    followUpTimer = setTimeout(() => speakParts(rest), DIGITS_PAUSE_MS);
  };
}

function callout(n) {
  if (n < 10) return [`${n}`];
  const digits = String(n)
    .split('')
    .map((d) => DIGIT_WORDS[Number(d)])
    .join(', ');
  return [`${n}`, digits];
}

function announce(n) {
  if (speech && !state.muted) {
    speakParts(callout(n));
    return;
  }
  // Screen readers only, when the voice is off. Clear first so "Repetir" re-announces the same text.
  els.announce.textContent = '';
  requestAnimationFrame(() => {
    els.announce.textContent = `Salió el ${n}`;
  });
}

// --- Screen wake lock --------------------------------------------------------

async function keepAwake() {
  if (!('wakeLock' in navigator) || wakeLock || wakeLockPending) return;
  wakeLockPending = true;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => {
      wakeLock = null;
    });
  } catch {
    // Denied (for example, battery saver): the screen may dim, nothing else breaks.
  } finally {
    wakeLockPending = false;
  }
}

// --- Game ------------------------------------------------------------------

function roll(pool) {
  if (reducedMotion.matches) return Promise.resolve();
  els.ball.classList.add('rolling');
  els.ball.classList.remove('empty');
  const timer = setInterval(() => {
    els.current.textContent = pool[randomIndex(pool.length)];
  }, 70);
  return new Promise((resolve) => {
    setTimeout(() => {
      clearInterval(timer);
      els.ball.classList.remove('rolling');
      resolve();
    }, ROLL_MS);
  });
}

async function draw() {
  const pool = remaining();
  if (rolling || pool.length === 0) return;

  primeSpeech();
  keepAwake();
  const n = pool[randomIndex(pool.length)];

  rolling = true;
  render();
  await roll(pool);
  rolling = false;

  state.drawn.push(n);
  save();
  render();
  if (!reducedMotion.matches) {
    els.ball.animate([{ transform: 'scale(1.12)' }, { transform: 'scale(1)' }], {
      duration: 300,
      easing: 'ease-out',
    });
  }
  navigator.vibrate?.(40);
  announce(n);
}

function newGame(max = state.max) {
  stopSpeech();
  voiceProblem = false;
  state = { ...state, max, drawn: [] };
  save();
  buildBoard();
  render();
}

// --- Rendering -------------------------------------------------------------

function buildBoard() {
  cells = [];
  const fragment = document.createDocumentFragment();
  for (let n = 1; n <= state.max; n += 1) {
    const li = document.createElement('li');
    const label = document.createElement('span');
    label.className = 'sr-only';
    li.append(String(n), label);
    cells[n] = li;
    fragment.append(li);
  }
  els.board.replaceChildren(fragment);
}

function render() {
  const { drawn, max, muted } = state;
  const last = drawn.at(-1);
  const left = max - drawn.length;
  const drawnSet = new Set(drawn);

  if (!rolling) {
    els.current.textContent = last ?? '–';
    els.ball.classList.toggle('empty', last === undefined);
  }

  if (rolling) els.status.textContent = 'Girando…';
  else if (voiceProblem && !muted) els.status.textContent = '¿No se escucha? Subí el volumen o sacá el modo silencio y tocá «Repetir».';
  else if (left === 0) els.status.textContent = '¡Salieron todas las bolillas!';
  else if (last === undefined) els.status.textContent = 'Tocá «Sacar bolilla» para empezar';
  else els.status.textContent = `Quedan ${left}`;

  // aria-disabled (not disabled) during the roll, so the button keeps keyboard and screen-reader focus.
  els.draw.disabled = left === 0;
  els.draw.setAttribute('aria-disabled', String(rolling));
  els.repeat.disabled = rolling || last === undefined || muted || !speech;
  els.reset.disabled = rolling;
  els.max.disabled = rolling;
  els.max.value = String(max);

  els.mute.hidden = !speech;
  els.repeat.hidden = !speech;
  els.mute.setAttribute('aria-pressed', String(!muted));
  els.mute.textContent = muted ? '🔇 Voz' : '🔊 Voz';

  els.history.replaceChildren(
    ...drawn
      .slice(-HISTORY_SIZE - 1, -1)
      .reverse()
      .map((n) => {
        const li = document.createElement('li');
        li.textContent = n;
        return li;
      }),
  );

  els.count.textContent = `${drawn.length} / ${max}`;
  cells.forEach((cell, n) => {
    const isDrawn = drawnSet.has(n);
    cell.classList.toggle('drawn', isDrawn);
    cell.classList.toggle('last', n === last);
    cell.lastChild.textContent = isDrawn ? ', salió' : '';
  });
}

// --- Events ----------------------------------------------------------------

els.draw.addEventListener('click', draw);

els.repeat.addEventListener('click', () => {
  const last = state.drawn.at(-1);
  if (last !== undefined) announce(last);
});

els.mute.addEventListener('click', () => {
  state.muted = !state.muted;
  if (state.muted) stopSpeech();
  voiceProblem = false;
  save();
  render();
});

els.reset.addEventListener('click', () => {
  if (state.drawn.length && !window.confirm('¿Empezar un juego nuevo? Se borran las bolillas que salieron.')) return;
  newGame();
});

els.max.addEventListener('change', () => {
  const max = Number(els.max.value);
  if (state.drawn.length && !window.confirm('Cambiar la cantidad de bolillas empieza un juego nuevo. ¿Seguimos?')) {
    els.max.value = String(state.max);
    return;
  }
  newGame(max);
});

document.addEventListener('keydown', (event) => {
  if (event.code !== 'Space' || event.repeat) return;
  if (event.target.closest?.('button, select, input, a')) return;
  event.preventDefault();
  draw();
});

// Ask for the wake lock on the first touch too, so the screen stays on before the first draw.
document.addEventListener('pointerdown', keepAwake, { once: true });

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    // Don't let a half-spoken number play late when the host comes back.
    stopSpeech();
    return;
  }
  syncFromStorage();
  if (state.drawn.length) keepAwake();
});

window.addEventListener('storage', (event) => {
  if (event.key === STORAGE_KEY) syncFromStorage();
});

// Keep the page padding in step with the real height of the bottom bar (large text, safe areas).
new ResizeObserver(() => {
  document.documentElement.style.setProperty('--bar-height', `${els.actions.offsetHeight}px`);
}).observe(els.actions);

if (speech) {
  pickVoice();
  speech.addEventListener('voiceschanged', pickVoice);
}

// Offline support for the deployed site. Skipped on localhost so it never caches other local dev servers.
if ('serviceWorker' in navigator && !['localhost', '127.0.0.1'].includes(location.hostname)) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

buildBoard();
render();
