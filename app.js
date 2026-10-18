const STORAGE_KEY = 'bolillero:v1';
const BALL_OPTIONS = [75, 90];
const DEFAULT_MAX = 90;
const ROLL_MS = 800;
// Auto mode («Ritmo»): how long to wait after a callout ends before the next draw.
const AUTO_PACES = {
  tranqui: { label: 'Tranqui', pauseMs: 2000 },
  normal: { label: 'Normal', pauseMs: 1200 },
  rapido: { label: 'Rápido', pauseMs: 600 },
};
const HISTORY_SIZE = 5;
const VOICE_TIMEOUT_MS = 2500;
const VOICE_LANGS = ['es-ar', 'es-419', 'es-mx', 'es-us', 'es-es'];
// Apple lists its robotic "Eloquence" voices first. The automatic pick skips them for a natural one
// (Paulina, Mónica…), and the voice picker lists them as the funny ones.
const ROBOTIC_VOICES = /^(eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley)\b|eloquence/i;
// Pitch (0 to 2) and speed of each voice style.
const VOICE_STYLES = {
  normal: { label: 'Normal', pitch: 1, rate: 0.9 },
  ardilla: { label: 'Ardilla', pitch: 2, rate: 1.1 },
  monstruo: { label: 'Monstruo', pitch: 0.1, rate: 0.75 },
  apurado: { label: 'Apurado', pitch: 1.1, rate: 1.6 },
};
const DIGIT_WORDS = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];

// Sayings («Dichos»): said right after the number, as in "8, ¡el culo te abrocho!".
// SAYINGS wins for its numbers. Every other number rhymes with its last word, so 8, 18, 28… all
// rhyme with "ocho"; RHYMES picks one of the variants by the tens digit.
const SAYINGS = {
  10: '¡como el Diego y como Messi!',
  11: '¡más duro que el bronce!',
  12: '¡una docena de facturas!',
  13: '¡la mala suerte!',
  14: '¡que nadie se esfuerce!',
  15: '¡la niña bonita!',
  20: '¡apretá los dientes!',
  22: '¡los dos patitos!',
  30: '¡la vieja contenta!',
  33: '¡la edad de Cristo!',
  40: '¡te canto las cuarenta!',
  48: '¡el muerto que habla!',
  50: '¡y nadie se da cuenta!',
  55: '¡pegá dos brincos!',
  60: '¡la abuela se sienta!',
  69: '¡dalo vuelta y es el mismo!',
  70: '¡pagá la cuenta!',
  77: '¡las dos banderitas!',
  80: '¡con sal y pimienta!',
  88: '¡las dos gorditas!',
  90: '¡el abuelo!',
};
const RHYMES = {
  1: ['¡como el Diego no hay ninguno!', '¡tomate el desayuno!'],
  2: ['¡te quiero a vos!', '¡arroz con pollo para los dos!'],
  3: ['¡el que no salta es un inglés!', '¡el mundo al revés!'],
  4: ['¡el gato en el teatro!', '¡aplausos en el teatro!'],
  5: ['¡pegá un brinco!', '¡bailá con ahínco!'],
  6: ['¡pagame a fin de mes!', '¡saltá con los dos pies!'],
  7: ['¡chupete!', '¡te como el cachete!'],
  8: ['¡el culo te abrocho!', '¡comete un bizcocho!'],
  9: ['¡el que se mueve no sale en la foto!', '¡guarda que llueve!'],
};

const els = {
  ball: document.getElementById('ball'),
  current: document.getElementById('current'),
  status: document.getElementById('status'),
  announce: document.getElementById('announce'),
  draw: document.getElementById('draw'),
  repeat: document.getElementById('repeat'),
  tools: document.getElementById('tools'),
  undo: document.getElementById('undo'),
  claimLine: document.getElementById('claim-line'),
  claimBingo: document.getElementById('claim-bingo'),
  actions: document.querySelector('.actions'),
  history: document.getElementById('history'),
  board: document.getElementById('board'),
  count: document.getElementById('count'),
  max: document.getElementById('max'),
  mute: document.getElementById('mute'),
  auto: document.getElementById('auto'),
  reset: document.getElementById('reset'),
  saying: document.getElementById('saying'),
  voiceField: document.getElementById('voice-field'),
  voice: document.getElementById('voice'),
  styleField: document.getElementById('style-field'),
  style: document.getElementById('style'),
  pace: document.getElementById('pace'),
  sayings: document.getElementById('sayings'),
  cardNews: document.getElementById('card-news'),
  cards: document.getElementById('cards'),
  cardsEmpty: document.getElementById('cards-empty'),
  cardsBingoRow: document.getElementById('cards-bingo-row'),
  cardsBingo: document.getElementById('cards-bingo'),
  cardsLineRow: document.getElementById('cards-line-row'),
  cardsLine: document.getElementById('cards-line'),
  cardSetField: document.getElementById('card-set-field'),
  cardSet: document.getElementById('card-set'),
};

const speech = 'speechSynthesis' in window ? window.speechSynthesis : null;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

let state = load();
let rolling = false;
let voice = null;
let utterances = [];
let speakTimer = null;
let voiceTimer = null;
// Resolves the promise that speak() returned, once that speech ends, fails or is replaced.
let finishSpeech = null;
let speechDone = Promise.resolve();
let voiceProblem = false;
let auto = false;
// Bumped on every auto mode change, so a loop from an earlier run stops at its next step.
let autoRun = 0;
let autoTimer = null;
let wakeLock = null;
let wakeLockPending = false;
let cells = [];
let cardSets = [];
// "¡Línea! Cartón 12", for the ball on screen only: Repetir and tab sync never announce it again.
let cardNews = '';

// --- State -----------------------------------------------------------------

function readSaved() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && BALL_OPTIONS.includes(saved.max) && Array.isArray(saved.drawn)) {
      const drawn = saved.drawn.filter((n) => Number.isInteger(n) && n >= 1 && n <= saved.max);
      return {
        max: saved.max,
        drawn: [...new Set(drawn)],
        muted: Boolean(saved.muted),
        voice: typeof saved.voice === 'string' ? saved.voice : '',
        style: Object.hasOwn(VOICE_STYLES, saved.style) ? saved.style : 'normal',
        pace: Object.hasOwn(AUTO_PACES, saved.pace) ? saved.pace : 'normal',
        sayings: Boolean(saved.sayings),
        cardSet: typeof saved.cardSet === 'string' ? saved.cardSet : '',
      };
    }
  } catch {
    // Storage blocked or corrupt.
  }
  return null;
}

function load() {
  return (
    readSaved() ?? {
      max: DEFAULT_MAX,
      drawn: [],
      muted: false,
      voice: '',
      style: 'normal',
      pace: 'normal',
      sayings: false,
      cardSet: '',
    }
  );
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
  if (speech) pickVoice();
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

const langOf = (v) => v.lang.replace('_', '-').toLowerCase();
const isFunny = (v) => ROBOTIC_VOICES.test(v.name) || ROBOTIC_VOICES.test(v.voiceURI);

function spanishVoices() {
  return speech.getVoices().filter((v) => langOf(v).startsWith('es'));
}

// The voice picked in «Voz» if this device has it, else a natural Spanish voice.
function pickVoice() {
  const all = spanishVoices();
  const natural = all.filter((v) => !isFunny(v));
  voice =
    all.find((v) => v.voiceURI === state.voice) ??
    natural.find((v) => v.default) ??
    VOICE_LANGS.map((lang) => natural.find((v) => langOf(v) === lang)).find(Boolean) ??
    natural[0] ??
    null;
}

// "Grandpa (Spanish (Mexico))" → "Grandpa (México)".
function voiceLabel(v) {
  const name = v.name.replace(/\s*\(.*\)\s*$/, '') || v.name;
  const region = langOf(v).split('-')[1];
  if (!region) return name;
  try {
    return `${name} (${new Intl.DisplayNames(['es'], { type: 'region' }).of(region.toUpperCase())})`;
  } catch {
    return `${name} (${region.toUpperCase()})`;
  }
}

// The voice list arrives late on iOS and Android (on "voiceschanged"), so this runs again then.
function buildVoiceOptions() {
  const group = (label, voices) => {
    const optgroup = document.createElement('optgroup');
    optgroup.label = label;
    const options = voices.map((v) => new Option(voiceLabel(v), v.voiceURI));
    options.sort((a, b) => a.text.localeCompare(b.text, 'es'));
    optgroup.append(...options);
    return optgroup;
  };
  const all = spanishVoices();
  const natural = all.filter((v) => !isFunny(v));
  const funny = all.filter(isFunny);
  els.voice.replaceChildren(
    new Option('Automática', ''),
    ...(natural.length ? [group('Naturales', natural)] : []),
    ...(funny.length ? [group('Divertidas', funny)] : []),
  );
}

function setVoiceProblem(value) {
  if (voiceProblem === value) return;
  voiceProblem = value;
  render();
}

function settleSpeech() {
  finishSpeech?.();
  finishSpeech = null;
}

function stopSpeech() {
  clearTimeout(speakTimer);
  clearTimeout(voiceTimer);
  utterances = [];
  settleSpeech();
  speech?.cancel();
}

function makeUtterance(text, volume) {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = voice?.lang ?? 'es-AR';
  if (voice) utterance.voice = voice;
  const { pitch, rate } = VOICE_STYLES[state.style];
  utterance.pitch = pitch;
  utterance.rate = rate;
  utterance.volume = volume;
  utterance.onerror = (event) => {
    // Errors from speech that was already replaced or stopped do not matter.
    if (!utterances.includes(utterance)) return;
    settleSpeech();
    if (volume === 0 || event.error === 'interrupted' || event.error === 'canceled') return;
    clearTimeout(voiceTimer);
    setVoiceProblem(true);
  };
  return utterance;
}

// Queues all the parts at once, so the audio never goes idle between them: phones clip the start
// of speech that comes after a silence, and a short first digit ("cuatro") could vanish.
// Returns a promise that resolves when the speech ends, fails, never starts or is replaced.
// Silent speech (the iOS unlock) resolves at once: nothing waits on it, and it has no timeout.
function speak(parts, volume = 1) {
  if (!speech) return Promise.resolve();
  if (!voice) pickVoice();
  settleSpeech();
  // Kept in a module variable: Chrome can garbage-collect a local utterance before its events fire.
  const queue = [parts].flat().map((text) => makeUtterance(text, volume));
  utterances = queue;

  if (volume > 0) {
    speechDone = new Promise((resolve) => {
      finishSpeech = resolve;
    });
    queue.at(-1).onend = () => {
      if (utterances === queue) settleSpeech();
    };
    // If the voice never starts (iOS did not unlock it, no Spanish voice…), tell the host,
    // and stop auto mode so balls don't keep coming out in silence.
    clearTimeout(voiceTimer);
    voiceTimer = setTimeout(() => {
      stopAuto();
      settleSpeech();
      setVoiceProblem(true);
      render();
    }, VOICE_TIMEOUT_MS);
    queue[0].onstart = () => {
      clearTimeout(voiceTimer);
      setVoiceProblem(false);
    };
  }

  const start = () => queue.forEach((utterance) => speech.speak(utterance));
  clearTimeout(speakTimer);
  // Chrome can stay paused after the tab was in the background.
  if (speech.paused) speech.resume();
  if (speech.speaking || speech.pending) {
    speech.cancel();
    // Some engines drop a speak() that comes right after cancel(), so give it a moment.
    speakTimer = setTimeout(start, 60);
  } else {
    start();
  }
  return volume > 0 ? speechDone : Promise.resolve();
}

// iOS only lets a page speak after a speak() call inside a user gesture.
// The real announcement comes after the roll animation, so unlock speech on every tap.
function primeSpeech() {
  if (!speech || state.muted || speech.speaking || speech.pending) return;
  speak(' ', 0);
}

function sayingFor(n) {
  if (SAYINGS[n]) return SAYINGS[n];
  const rhymes = RHYMES[n % 10];
  return rhymes ? rhymes[Math.floor(n / 10) % rhymes.length] : '';
}

// "47." then "cuatro, siete": two utterances give a sentence break between the number and its digits.
// With «Dichos» on, the saying comes right after the number: "47, ¡te como el cachete!".
function callout(n) {
  const saying = state.sayings ? sayingFor(n) : '';
  const number = saying ? `${n}, ${saying}` : `${n}.`;
  if (n < 10) return [number];
  const digits = String(n)
    .split('')
    .map((d) => DIGIT_WORDS[Number(d)])
    .join(', ');
  return [number, digits];
}

// Called from a change event (a user gesture), so iOS lets it speak.
// Only when the caller is idle: during a game the new voice simply takes over from the next callout,
// instead of a sample cutting off the number that is being said.
function previewVoice() {
  if (state.muted || auto || rolling || finishSpeech || speech?.speaking || speech?.pending) return;
  speak('¡Hola! Así canto los números.');
}

// Resolves when the callout is over (at once when the voice is off).
// `news` holds the cards that just got a line or bingo with this ball.
function announce(n, news = { lines: [], bingos: [] }) {
  const said = [];
  if (news.bingos.length) said.push(`¡Bingo en ${cardsWord(news.bingos, 'el cartón', 'los cartones')}!`);
  if (news.lines.length) said.push(`¡Línea en ${cardsWord(news.lines, 'el cartón', 'los cartones')}!`);
  if (speech && !state.muted) return speak([...callout(n), ...said]);
  // Screen readers only, when the voice is off. Clear first so "Repetir" re-announces the same text.
  els.announce.textContent = '';
  requestAnimationFrame(() => {
    els.announce.textContent = [`Salió el ${n}.`, ...said].join(' ');
  });
}

// --- Card sets ---------------------------------------------------------------
// cards.json holds sets of real bingo cards (transcribed from photos). With a set picked in
// «Cartones», the app shows which cards have a full row (línea) or every number out (bingo).

function validCard(card) {
  return (
    card &&
    (typeof card.id === 'string' || Number.isInteger(card.id)) &&
    Array.isArray(card.rows) &&
    card.rows.length > 0 &&
    card.rows.every((row) => Array.isArray(row) && row.length > 0 && row.every((n) => Number.isInteger(n) && n >= 1))
  );
}

function parseCardSets(data) {
  const sets = Array.isArray(data?.sets) ? data.sets : [];
  return sets
    .filter((set) => set && typeof set.id === 'string' && set.id && Array.isArray(set.cards))
    .map((set) => ({
      id: set.id,
      name: typeof set.name === 'string' && set.name ? set.name : set.id,
      cards: set.cards.filter(validCard).map((card) => ({ id: String(card.id), rows: card.rows })),
    }))
    .filter((set) => set.cards.length > 0);
}

async function loadCardSets() {
  try {
    const response = await fetch('cards.json');
    if (!response.ok) return;
    cardSets = parseCardSets(await response.json());
  } catch {
    // Offline before the first visit, or a broken file: the game works without cards.
    return;
  }
  els.cardSet.replaceChildren(new Option('Ninguno', ''), ...cardSets.map((set) => new Option(set.name, set.id)));
  render();
}

function selectedSet() {
  return cardSets.find((set) => set.id === state.cardSet) ?? null;
}

// Card ids with every number out (bingos), and with at least one full row but not all (lines).
function cardResults(drawnSet) {
  const lines = [];
  const bingos = [];
  selectedSet()?.cards.forEach((card) => {
    const fullRows = card.rows.filter((row) => row.every((n) => drawnSet.has(n))).length;
    if (fullRows === card.rows.length) bingos.push(card.id);
    else if (fullRows > 0) lines.push(card.id);
  });
  return { lines, bingos };
}

function listOf(items) {
  try {
    return new Intl.ListFormat('es', { type: 'conjunction' }).format(items);
  } catch {
    return items.join(', ');
  }
}

// "el cartón 12" or "los cartones 12 y 45".
function cardsWord(ids, one, many) {
  return `${ids.length > 1 ? many : one} ${listOf(ids)}`;
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

// --- Sound effects ---------------------------------------------------------------
// Made in the browser with Web Audio, so there are no audio files. They follow «Voz» on/off.

let audio = null;

// iOS only starts audio inside a tap, so this runs on every tap. After the first one it does nothing.
function unlockAudio() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  audio ??= new AudioContextClass();
  if (audio.state !== 'running') audio.resume().catch(() => {});
}

function canPlaySound() {
  return audio?.state === 'running' && !state.muted;
}

function tone(type, freq, start, length, volume, endFreq = freq) {
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (endFreq !== freq) osc.frequency.exponentialRampToValueAtTime(endFreq, start + length);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
  osc.connect(gain).connect(audio.destination);
  osc.start(start);
  osc.stop(start + length + 0.02);
}

// A short knock, like a ball hitting the drum. The roll plays one per number it shows.
function knock() {
  if (!canPlaySound()) return;
  tone('triangle', 400 + Math.random() * 500, audio.currentTime, 0.06, 0.18, 110);
}

// Note frequencies (Hz): C5 E5 G5, then up to C6 for a bingo.
const FANFARES = {
  line: [523.25, 659.25, 783.99],
  bingo: [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5],
};

function fanfare(kind) {
  if (!canPlaySound()) return;
  const notes = FANFARES[kind];
  const step = 0.13;
  const start = audio.currentTime + 0.02;
  notes.forEach((freq, i) => {
    const length = i === notes.length - 1 ? 0.55 : step * 0.9;
    tone('square', freq, start + i * step, length, 0.1);
  });
}

// --- Game ------------------------------------------------------------------

function roll(pool) {
  if (reducedMotion.matches) return Promise.resolve();
  els.ball.classList.add('rolling');
  els.ball.classList.remove('empty');
  const timer = setInterval(() => {
    els.current.textContent = pool[randomIndex(pool.length)];
    knock();
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
  cardNews = '';
  render();
  await roll(pool);
  rolling = false;

  const before = cardResults(new Set(state.drawn));
  state.drawn.push(n);
  save();
  const after = cardResults(new Set(state.drawn));
  const news = {
    lines: after.lines.filter((id) => !before.lines.includes(id)),
    bingos: after.bingos.filter((id) => !before.bingos.includes(id)),
  };
  cardNews = [
    news.bingos.length ? `¡Bingo! ${cardsWord(news.bingos, 'Cartón', 'Cartones')}` : '',
    news.lines.length ? `¡Línea! ${cardsWord(news.lines, 'Cartón', 'Cartones')}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
  // Someone won something: stop auto mode, so the host can check the card.
  if (cardNews) stopAuto();
  render();
  if (!reducedMotion.matches) {
    els.ball.animate([{ transform: 'scale(1.12)' }, { transform: 'scale(1)' }], {
      duration: 300,
      easing: 'ease-out',
    });
  }
  navigator.vibrate?.(cardNews ? [40, 80, 160] : 40);
  const done = announce(n, news);
  // The fanfare comes after the voice has said who won.
  if (cardNews) Promise.resolve(done).then(() => fanfare(news.bingos.length ? 'bingo' : 'line'));
  return done;
}

// For a mis-tap: the last ball goes back into the drum.
function undoLast() {
  const last = state.drawn.at(-1);
  if (last === undefined || rolling) return;
  if (!window.confirm(`¿Deshacer el ${last}? La bolilla vuelve al bolillero.`)) return;
  stopAuto();
  stopSpeech();
  state.drawn.pop();
  cardNews = '';
  save();
  render();
}

// Someone shouted "¡Línea!" or "¡Bingo!": pause the game so the host can check the card.
function claim(kind) {
  if (rolling) return;
  stopAuto();
  const word = kind === 'bingo' ? '¡Bingo!' : '¡Línea!';
  cardNews = `${word} A revisar el cartón`;
  render();
  navigator.vibrate?.([40, 80, 160]);
  const done = speech && !state.muted ? speak(`${word} A revisar el cartón.`) : Promise.resolve();
  done.then(() => fanfare(kind));
}

function newGame(max = state.max) {
  stopAuto();
  stopSpeech();
  voiceProblem = false;
  cardNews = '';
  state = { ...state, max, drawn: [] };
  save();
  buildBoard();
  render();
}

// --- Auto mode -------------------------------------------------------------

function stopAuto() {
  auto = false;
  autoRun += 1;
  clearTimeout(autoTimer);
}

// Called from a tap: the first draw starts right away, still inside the gesture, so iOS unlocks speech.
function startAuto() {
  stopAuto();
  auto = true;
  autoStep(autoRun);
}

async function autoStep(run) {
  if (run !== autoRun) return;
  if (remaining().length === 0) {
    stopAuto();
    render();
    return;
  }
  // Let speech in progress (a callout, "Repetir") finish before the next ball.
  if (finishSpeech) await speechDone;
  if (run !== autoRun) return;
  await draw();
  if (run !== autoRun) return;
  autoTimer = setTimeout(() => autoStep(run), AUTO_PACES[state.pace].pauseMs);
}

// The big button draws a ball, or pauses auto mode while it runs.
function onDrawButton() {
  if (auto) {
    stopAuto();
    render();
  } else {
    draw();
  }
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
  else els.status.textContent = auto ? `Quedan ${left} · automático` : `Quedan ${left}`;

  // aria-disabled (not disabled) during the roll, so the button keeps keyboard and screen-reader focus.
  // In auto mode it is the pause button, so it stays live during the roll too.
  els.draw.textContent = auto ? 'Pausar' : 'Sacar bolilla';
  els.draw.disabled = left === 0 && !auto;
  els.draw.setAttribute('aria-disabled', String(rolling && !auto));
  els.auto.disabled = left === 0;
  els.auto.setAttribute('aria-pressed', String(auto));
  els.auto.textContent = auto ? '⏸ Auto' : '▶ Auto';
  els.repeat.disabled = rolling || last === undefined || muted || !speech;
  els.tools.hidden = last === undefined;
  els.undo.disabled = rolling;
  els.claimLine.disabled = rolling;
  els.claimBingo.disabled = rolling;
  els.reset.disabled = rolling;
  els.max.disabled = rolling;
  els.max.value = String(max);

  els.mute.hidden = !speech;
  els.repeat.hidden = !speech;
  els.mute.setAttribute('aria-pressed', String(!muted));
  els.mute.textContent = muted ? '🔇 Voz' : '🔊 Voz';

  els.voiceField.hidden = !speech;
  els.styleField.hidden = !speech;
  els.voice.value = voice && voice.voiceURI === state.voice ? state.voice : '';
  els.style.value = state.style;
  els.pace.value = state.pace;
  els.sayings.checked = state.sayings;
  const saying = state.sayings && !rolling && last !== undefined ? sayingFor(last) : '';
  els.saying.textContent = saying;
  els.saying.hidden = !saying;

  const set = selectedSet();
  const news = rolling ? '' : cardNews;
  els.cardNews.textContent = news;
  els.cardNews.hidden = !news;
  els.cardSetField.hidden = cardSets.length === 0;
  els.cardSet.value = set ? set.id : '';
  els.cards.hidden = !set;
  if (set) {
    const { lines, bingos } = cardResults(drawnSet);
    const chips = (ids) =>
      ids.map((id) => {
        const li = document.createElement('li');
        li.textContent = id;
        return li;
      });
    els.cardsEmpty.hidden = lines.length + bingos.length > 0;
    els.cardsBingoRow.hidden = bingos.length === 0;
    els.cardsBingo.replaceChildren(...chips(bingos));
    els.cardsLineRow.hidden = lines.length === 0;
    els.cardsLine.replaceChildren(...chips(lines));
  }

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

els.draw.addEventListener('click', onDrawButton);

els.auto.addEventListener('click', () => {
  if (auto) stopAuto();
  else startAuto();
  render();
});

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

els.voice.addEventListener('change', () => {
  state.voice = els.voice.value;
  pickVoice();
  save();
  previewVoice();
});

els.style.addEventListener('change', () => {
  state.style = els.style.value;
  save();
  previewVoice();
});

// A running auto mode picks up the new pace from its next pause.
els.pace.addEventListener('change', () => {
  state.pace = els.pace.value;
  save();
});

els.sayings.addEventListener('change', () => {
  state.sayings = els.sayings.checked;
  save();
  render();
});

els.cardSet.addEventListener('change', () => {
  state.cardSet = els.cardSet.value;
  cardNews = '';
  save();
  render();
});

els.undo.addEventListener('click', undoLast);
els.claimLine.addEventListener('click', () => claim('line'));
els.claimBingo.addEventListener('click', () => claim('bingo'));

// Capture phase: runs before the button handlers, so the roll of that same tap already has sound.
document.addEventListener('click', unlockAudio, true);
document.addEventListener('keydown', unlockAudio, true);

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
  onDrawButton();
});

// Ask for the wake lock on the first touch too, so the screen stays on before the first draw.
document.addEventListener('pointerdown', keepAwake, { once: true });

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    // Pause auto mode, so balls never come out while the phone is locked,
    // and don't let a half-spoken number play late when the host comes back.
    stopAuto();
    stopSpeech();
    render();
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

els.style.append(...Object.entries(VOICE_STYLES).map(([key, { label }]) => new Option(label, key)));
els.pace.append(...Object.entries(AUTO_PACES).map(([key, { label }]) => new Option(label, key)));

function onVoicesChanged() {
  pickVoice();
  buildVoiceOptions();
  render();
}

if (speech) {
  // Chrome can keep speech queued from before a reload, and new speech would wait behind it.
  speech.cancel();
  pickVoice();
  buildVoiceOptions();
  speech.addEventListener('voiceschanged', onVoicesChanged);
}

// Offline support for the deployed site. Skipped on localhost so it never caches other local dev servers.
if ('serviceWorker' in navigator && !['localhost', '127.0.0.1'].includes(location.hostname)) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

buildBoard();
render();
loadCardSets();
