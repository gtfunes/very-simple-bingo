const STORAGE_KEY = 'bolillero:v1';
const BALL_OPTIONS = [75, 90];
const DEFAULT_MAX = 90;
const ROLL_MS = 800;
const HISTORY_SIZE = 5;
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
let speechPrimed = false;
let speakTimer = null;
let wakeLock = null;
let wakeLockPending = false;
let cells = [];

// --- State -----------------------------------------------------------------

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && BALL_OPTIONS.includes(saved.max) && Array.isArray(saved.drawn)) {
      const drawn = saved.drawn.filter((n) => Number.isInteger(n) && n >= 1 && n <= saved.max);
      return { max: saved.max, drawn: [...new Set(drawn)], muted: Boolean(saved.muted) };
    }
  } catch {
    // Storage blocked or corrupt: start a fresh game.
  }
  return { max: DEFAULT_MAX, drawn: [], muted: false };
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage blocked: the game still works, it just won't survive a reload.
  }
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

function speak(text, volume = 1) {
  if (!speech) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = voice?.lang ?? 'es-AR';
  if (voice) utterance.voice = voice;
  utterance.rate = 0.9;
  utterance.volume = volume;

  clearTimeout(speakTimer);
  // Chrome can stay paused after the tab was in the background.
  if (speech.paused) speech.resume();
  if (speech.speaking || speech.pending) {
    speech.cancel();
    // Some engines drop a speak() that comes right after cancel(), so give it a moment.
    speakTimer = setTimeout(() => speech.speak(utterance), 60);
  } else {
    speech.speak(utterance);
  }
}

// iOS only lets a page speak after a speak() call inside a user gesture.
// The real announcement happens after the roll animation, so unlock it up front.
function primeSpeech() {
  if (speechPrimed || !speech || state.muted) return;
  speak(' ', 0);
  speechPrimed = true;
}

function callout(n) {
  if (n < 10) return `${n}`;
  const digits = String(n)
    .split('')
    .map((d) => DIGIT_WORDS[Number(d)])
    .join(', ');
  return `${n}. ${digits}.`;
}

function announce(n) {
  els.announce.textContent = `Salió el ${n}`;
  if (!state.muted) speak(callout(n));
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
  clearTimeout(speakTimer);
  speech?.cancel();
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
    li.textContent = n;
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
  else if (left === 0) els.status.textContent = '¡Salieron todas las bolillas!';
  else if (last === undefined) els.status.textContent = 'Tocá «Sacar bolilla» para empezar';
  else els.status.textContent = `Quedan ${left}`;

  els.draw.disabled = rolling || left === 0;
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
    cell.classList.toggle('drawn', drawnSet.has(n));
    cell.classList.toggle('last', n === last);
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
  if (state.muted) {
    clearTimeout(speakTimer);
    speech?.cancel();
  }
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

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && state.drawn.length) keepAwake();
});

if (speech) {
  pickVoice();
  speech.addEventListener('voiceschanged', pickVoice);
}

buildBoard();
render();
