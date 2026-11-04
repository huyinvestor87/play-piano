import { buildScore, buildSteps, LESSONS, noteLabel, keyPlace, isBlack, midiName, MIDDLE_C, TICKS } from './fur-elise-score.js?v=1.0.0';

const $ = id => document.getElementById(id);
const score = buildScore();
const BPM = 72; // ♩ = 72 như bản gốc → 100%
const PIANOS = { 88: [21, 108], 76: [28, 103], 61: [36, 96] };
const STORE = 'playPiano.furElise.v1';
const DEFAULTS = { lesson: 'cau1', hands: 'RL', speed: 50, loop: false, sound: true, accomp: true, countIn: true, preview: true, names: 'both', labels: 'all', piano: '88', wake: true, seenGuide: false, steps: {}, done: {} };
const settings = (() => {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORE) || '{}') }; } catch { return { ...DEFAULTS }; }
})();
let saveTimer = 0;
function save() { clearTimeout(saveTimer); saveTimer = setTimeout(() => { try { localStorage.setItem(STORE, JSON.stringify(settings)); } catch {} }, 250); }

const state = {
  lesson: LESSONS[0], view: { steps: [] }, notes: [], start: 0, end: 0,
  index: 0, pos: 0, target: 0, keys: new Map(), lo: 41, hi: 83,
  play: null, dirty: true, lastFrame: 0, marked: [], stepVoices: new Map(), done: false, zoom: 1,
};
const secondsPerTick = () => 60 / BPM / 4 / TICKS / (settings.speed / 100);

// ───────────────────────── Âm thanh (piano tổng hợp, không cần tải file) ─────────────────────────
const audio = { ctx: null, out: null };
async function ensureAudio() {
  if (!audio.ctx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    let ctx;
    try { ctx = new AudioCtx({ latencyHint: 'interactive' }); } catch { ctx = new AudioCtx(); }
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -18; compressor.knee.value = 12; compressor.ratio.value = 4;
    compressor.attack.value = .003; compressor.release.value = .25;
    const master = ctx.createGain(); master.gain.value = .95;
    compressor.connect(master).connect(ctx.destination);
    // Mở khoá âm thanh trên iOS bằng một mẫu im lặng.
    const silent = ctx.createBufferSource(); silent.buffer = ctx.createBuffer(1, 1, 22050); silent.connect(ctx.destination); silent.start(0);
    audio.ctx = ctx; audio.out = compressor;
  }
  // iOS 17+: phát cả khi gạt công tắc im lặng.
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch {}
  if (audio.ctx.state !== 'running') { try { await audio.ctx.resume(); } catch {} }
  return audio.ctx;
}
const PARTIALS = [[1, 1], [2, .4], [3, .17], [4, .08], [5, .035], [6, .02]];
function pianoNote(midi, when, length, velocity = .85) {
  const ctx = audio.ctx;
  if (!ctx) return null;
  const f = 440 * 2 ** ((midi - 69) / 12);
  const env = ctx.createGain(), tone = ctx.createBiquadFilter();
  tone.type = 'lowpass'; tone.Q.value = .5;
  tone.frequency.setValueAtTime(Math.min(16000, f * 9 + 900), when);
  tone.frequency.setTargetAtTime(Math.min(9000, f * 2.6 + 350), when + .01, .4);
  const peak = .2 * velocity * (midi < 50 ? 1.25 : midi > 86 ? .75 : 1);
  const tail = Math.max(.7, Math.min(5, 3.6 * (262 / f) ** .5));
  env.gain.setValueAtTime(0, when);
  env.gain.linearRampToValueAtTime(peak, when + .005);
  env.gain.setTargetAtTime(peak * .3, when + .006, .1);
  const release = when + Math.max(.12, length);
  if (release > when + .35) env.gain.setTargetAtTime(0, when + .35, tail / 4);
  env.gain.setTargetAtTime(0, release, .09);
  const stopAt = release + .7;
  tone.connect(env).connect(audio.out);
  const oscillators = [], gains = [];
  for (const [n, amp] of PARTIALS) {
    if (f * n > 12000) break;
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.frequency.value = f * n * (1 + .00035 * n * n);
    gain.gain.value = amp;
    osc.connect(gain).connect(tone); osc.start(when); osc.stop(stopAt);
    oscillators.push(osc); gains.push(gain);
  }
  const warm = ctx.createOscillator(), warmGain = ctx.createGain();
  warm.frequency.value = f * 1.0008; warmGain.gain.value = .35;
  warm.connect(warmGain).connect(tone); warm.start(when); warm.stop(stopAt);
  oscillators.push(warm); gains.push(warmGain);
  oscillators[0].onended = () => { for (const node of [...oscillators, ...gains, tone, env]) node.disconnect(); };
  return {
    end: stopAt,
    stop(at = ctx.currentTime) {
      if (at <= when) {
        env.gain.cancelScheduledValues(0); env.gain.setValueAtTime(0, at);
        for (const osc of oscillators) { try { osc.stop(at); } catch {} }
      } else {
        env.gain.cancelScheduledValues(at); env.gain.setTargetAtTime(0, at, .04);
        for (const osc of oscillators) { try { osc.stop(at + .3); } catch {} }
      }
    },
  };
}
function click(when, accent) {
  const ctx = audio.ctx, osc = ctx.createOscillator(), gain = ctx.createGain();
  osc.frequency.value = accent ? 1560 : 1040;
  gain.gain.setValueAtTime(.0001, when); gain.gain.exponentialRampToValueAtTime(.35, when + .002); gain.gain.exponentialRampToValueAtTime(.0001, when + .07);
  osc.connect(gain).connect(audio.out); osc.start(when); osc.stop(when + .08);
  osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  return { end: when + .08, stop: at => { try { osc.stop(at); } catch {} } };
}
function soundTicks(note) {
  const bar = score.bars[note.bar];
  return bar.pedal ? Math.max(note.duration, bar.start + bar.length - note.start) : note.duration;
}

// ───────────────────────── Giữ màn hình sáng / toàn màn hình ─────────────────────────
let wakeLock = null;
async function keepAwake() {
  if (!settings.wake || wakeLock || !('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
  try { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } catch {}
}
function releaseWake() { wakeLock?.release().catch(() => {}); wakeLock = null; }
const root = document.documentElement;
const fullscreenElement = () => document.fullscreenElement || document.webkitFullscreenElement;
if ((root.requestFullscreen || root.webkitRequestFullscreen) && !navigator.standalone && !matchMedia('(display-mode: standalone)').matches) {
  $('fullscreenButton').hidden = false;
  $('fullscreenButton').onclick = () => {
    if (fullscreenElement()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    else (root.requestFullscreen || root.webkitRequestFullscreen).call(root)?.catch?.(() => {});
  };
}

// ───────────────────────── Tên nốt ─────────────────────────
function nameParts(note) {
  const label = noteLabel(note.name ?? midiName(note.midi));
  const main = settings.names === 'letter' ? label.letter : label.solfege;
  const sub = settings.names === 'both' ? label.letter + label.octave : '';
  return { main, octave: label.octave, sub, spoken: `${label.solfege} ${label.octave}` };
}
function noteChip(note) {
  const { main, octave, sub } = nameParts(note);
  return `<span class="nc ${note.hand}"><b class="finger">${note.finger}</b><span class="nm">${main}<span class="oct">${octave}</span></span>${sub ? `<small>${sub}</small>` : ''}</span>`;
}

// ───────────────────────── Bàn phím ─────────────────────────
const BLACK_SHIFT = { 1: -.12, 3: .12, 6: -.14, 8: 0, 10: .14 };
function layoutKeys(lo, hi) {
  let whites = 0;
  for (let m = lo; m <= hi; m++) if (!isBlack(m)) whites++;
  const ww = 1 / whites, bw = ww * .6, keys = new Map();
  let wi = 0;
  for (let m = lo; m <= hi; m++) {
    if (isBlack(m)) keys.set(m, { midi: m, black: true, x: wi * ww - bw / 2 + BLACK_SHIFT[m % 12] * bw, w: bw });
    else { keys.set(m, { midi: m, black: false, x: wi * ww, w: ww }); wi++; }
  }
  return { keys, whites };
}
const whiteCount = (lo, hi) => { let n = 0; for (let m = lo; m <= hi; m++) if (!isBlack(m)) n++; return n; };
function computeRange() {
  const midis = state.notes.map(n => n.midi);
  let lo = Math.min(...midis) - 1, hi = Math.max(...midis) + 1;
  const toLow = () => { while (![0, 5].includes(lo % 12)) lo--; };
  const toHigh = () => { while (![4, 11].includes(hi % 12)) hi++; };
  toLow(); toHigh();
  for (let grow = 0; whiteCount(lo, hi) < 22; grow++) { if (grow % 2) { hi++; toHigh(); } else { lo--; toLow(); } }
  state.lo = lo; state.hi = hi;
}
function keyLabel(midi) {
  const isC = midi % 12 === 0;
  if (settings.labels === 'none' || (settings.labels === 'c' && !isC)) return '';
  const label = noteLabel(midiName(midi));
  const main = settings.names === 'letter' ? label.letter : label.solfege;
  const text = isC ? `${main}<span class="oct">${label.octave}</span>` : main;
  return settings.names === 'both' ? `${text}<br><span class="letter">${label.letter}${isC ? label.octave : ''}</span>` : text;
}
function buildKeyboard() {
  const { keys } = layoutKeys(state.lo, state.hi);
  const [pianoLo, pianoHi] = PIANOS[settings.piano];
  const board = $('keyboard');
  board.replaceChildren();
  for (const key of keys.values()) {
    const el = document.createElement('div');
    el.className = `key ${key.black ? 'black' : 'white'}${key.midi % 12 === 0 ? ' c' : ''}${key.midi === MIDDLE_C ? ' middle-c' : ''}${key.midi < pianoLo || key.midi > pianoHi ? ' out' : ''}`;
    el.dataset.midi = key.midi;
    el.style.left = `${key.x * 100}%`; el.style.width = `${key.w * 100}%`;
    const badge = document.createElement('span'); badge.className = 'badge'; el.append(badge);
    if (!key.black) { const label = document.createElement('span'); label.className = 'label'; label.innerHTML = keyLabel(key.midi); el.append(label); }
    board.append(el);
    key.el = el; key.badge = badge;
  }
  state.keys = keys; state.marked = [];
  fitLabels();
}
function fitLabels() {
  const width = $('keyboard').clientWidth / Math.max(1, whiteCount(state.lo, state.hi));
  $('keyboard').classList.toggle('narrow', width < 34);
}
function markKeys(striking, held, upcoming) {
  for (const el of state.marked) el.classList.remove('on-R', 'on-L', 'hold-R', 'hold-L', 'next-R', 'next-L');
  state.marked = [];
  const mark = (note, kind) => {
    const key = state.keys.get(note.midi);
    if (!key) return;
    key.el.classList.add(`${kind}-${note.hand}`);
    if (kind !== 'next') key.badge.textContent = note.finger;
    state.marked.push(key.el);
  };
  const struck = new Set(striking.map(n => n.midi));
  for (const note of held) if (!struck.has(note.midi)) mark(note, 'hold');
  for (const note of striking) mark(note, 'on');
  if (settings.preview) for (const note of upcoming) if (!struck.has(note.midi)) mark(note, 'next');
}

// Bấm thử phím trên màn hình để nghe.
$('keyboard').addEventListener('pointerdown', async event => {
  const el = event.target.closest('.key');
  if (!el) return;
  event.preventDefault();
  el.classList.add('tap');
  setTimeout(() => el.classList.remove('tap'), 180);
  const ctx = await ensureAudio();
  if (ctx) pianoNote(Number(el.dataset.midi), ctx.currentTime + .005, .5, .8);
});

// ───────────────────────── Bản đồ đàn 88 phím ─────────────────────────
const minimap = $('minimap'), mini = minimap.getContext('2d');
function drawMinimap() {
  const ratio = window.devicePixelRatio || 1, w = minimap.clientWidth, h = minimap.clientHeight;
  if (!w || !h) return;
  if (minimap.width !== Math.round(w * ratio)) { minimap.width = Math.round(w * ratio); minimap.height = Math.round(h * ratio); }
  mini.setTransform(ratio, 0, 0, ratio, 0, 0); mini.clearRect(0, 0, w, h);
  const [lo, hi] = PIANOS[settings.piano];
  const { keys } = layoutKeys(lo, hi);
  const keyH = h - 2;
  for (const key of keys.values()) if (!key.black) { mini.fillStyle = key.midi >= state.lo && key.midi <= state.hi ? '#e9e8df' : '#7d827c'; mini.fillRect(key.x * w + .5, 1, key.w * w - 1, keyH); }
  for (const key of keys.values()) if (key.black) { mini.fillStyle = '#111'; mini.fillRect(key.x * w, 1, key.w * w, keyH * .6); }
  // Vùng đang hiển thị
  const first = keys.get(Math.max(lo, state.lo)), last = keys.get(Math.min(hi, state.hi));
  if (first && last) { mini.strokeStyle = '#b9edcf'; mini.lineWidth = 2; mini.strokeRect(first.x * w, 1, (last.x + last.w - first.x) * w, keyH); }
  // Đô giữa
  const middle = keys.get(MIDDLE_C);
  mini.fillStyle = '#c2484f'; mini.beginPath(); mini.arc((middle.x + middle.w / 2) * w, keyH - 4, 3, 0, Math.PI * 2); mini.fill();
  // Nốt đang bấm
  const step = state.view.steps[state.index];
  for (const note of step?.notes ?? []) {
    const key = keys.get(note.midi); if (!key) continue;
    mini.fillStyle = note.hand === 'R' ? '#5ed39a' : '#6aa8ff';
    mini.beginPath(); mini.arc((key.x + key.w / 2) * w, key.black ? keyH * .3 : keyH * .55, 3.5, 0, Math.PI * 2); mini.fill();
  }
  $('minimapLabel').textContent = `Vùng phím trên đàn ${settings.piano} phím`;
}

// ───────────────────────── Nốt rơi ─────────────────────────
const roll = $('roll'), pen = roll.getContext('2d');
let rollW = 0, rollH = 0;
function resizeRoll() {
  const ratio = window.devicePixelRatio || 1;
  rollW = roll.clientWidth; rollH = roll.clientHeight;
  roll.width = Math.round(rollW * ratio); roll.height = Math.round(rollH * ratio);
  pen.setTransform(ratio, 0, 0, ratio, 0, 0);
  state.dirty = true;
}
function roundRect(x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  pen.beginPath(); pen.moveTo(x + r, y); pen.arcTo(x + w, y, x + w, y + h, r); pen.arcTo(x + w, y + h, x, y + h, r); pen.arcTo(x, y + h, x, y, r); pen.arcTo(x, y, x + w, y, r); pen.closePath();
}
const COLORS = { R: ['#5ed39a', '#2f9a63', '#06281a'], L: ['#6aa8ff', '#3a6fd2', '#071a36'] };
function drawRoll() {
  const W = rollW, H = rollH;
  if (!W || !H) return;
  pen.clearRect(0, 0, W, H);
  const px16 = Math.min(Math.max(24, Math.min(64, H / 8)) * state.zoom, Math.max(30, H / 4));
  const pxTick = px16 / TICKS, hitY = H - 3, pos = state.pos;
  const yOf = t => hitY - (t - pos) * pxTick;
  // Cột phím
  for (const key of state.keys.values()) {
    if (key.black) { pen.fillStyle = '#ffffff06'; pen.fillRect(key.x * W, 0, key.w * W, H); continue; }
    const c = key.midi % 12 === 0;
    pen.fillStyle = key.midi === MIDDLE_C ? '#c2484f55' : c ? '#ffffff22' : '#ffffff0c';
    pen.fillRect(Math.round(key.x * W), 0, 1, H);
  }
  // Vạch ô nhịp
  const lesson = state.lesson;
  pen.font = '600 11px -apple-system, system-ui, sans-serif'; pen.textAlign = 'left';
  for (let b = lesson.from; b <= lesson.to + 1; b++) {
    const t = b <= lesson.to ? score.bars[b].start : state.end;
    const y = yOf(t);
    if (y < -2 || y > H + 2) continue;
    pen.fillStyle = b > lesson.to ? '#e6c68f66' : '#ffffff1f'; pen.fillRect(0, Math.round(y), W, 1);
    pen.fillStyle = '#ffffff55';
    pen.fillText(b > lesson.to ? 'hết đoạn' : `ô ${b - lesson.from + 1}`, 6, y - 4);
  }
  // Nốt
  const step = state.view.steps[state.index];
  const horizon = pos + (H + 20) / pxTick;
  for (const note of state.notes) {
    if (note.start > horizon) break;
    if (note.start + note.duration <= pos - .5) continue;
    const key = state.keys.get(note.midi);
    if (!key) continue;
    const active = settings.hands.includes(note.hand);
    const now = active && step && note.start === step.time;
    const inset = key.black ? 1 : 2.5;
    const x = key.x * W + inset, w = key.w * W - inset * 2;
    const y0 = yOf(note.start + note.duration), y1 = Math.min(yOf(note.start), hitY);
    const h = Math.max(note.grace ? 7 : 9, y1 - y0);
    const [fill, dark, ink] = COLORS[note.hand];
    pen.globalAlpha = !active ? .28 : now || note.start >= pos - .5 ? 1 : .55;
    pen.fillStyle = active ? (key.black ? dark : fill) : '#5d6d6a';
    roundRect(x, y1 - h, w, h, Math.min(6, w / 3)); pen.fill();
    if (now) { pen.lineWidth = 2.5; pen.strokeStyle = '#ffffff'; pen.stroke(); }
    else if (active && key.black) { pen.lineWidth = 1.5; pen.strokeStyle = fill; pen.stroke(); }
    // Số ngón tay
    if (active) {
      const r = Math.min(w / 2 - 1, 12);
      if (r >= 6 && (h >= r * 2 + 2 || now)) {
        const cx = x + w / 2, cy = y1 - Math.max(r + 2, Math.min(h / 2, r + 3));
        pen.fillStyle = key.black ? fill : '#ffffffee';
        if (note.hand === 'L') { roundRect(cx - r, cy - r, r * 2, r * 2, r * .35); pen.fill(); } else { pen.beginPath(); pen.arc(cx, cy, r, 0, Math.PI * 2); pen.fill(); }
        pen.fillStyle = key.black ? ink : dark; pen.textAlign = 'center'; pen.textBaseline = 'middle';
        pen.font = `800 ${Math.round(r * 1.25)}px -apple-system, system-ui, sans-serif`;
        pen.fillText(String(note.finger), cx, cy + .5);
        if (h >= r * 2 + 22 && w >= 26) {
          pen.font = '600 11px -apple-system, system-ui, sans-serif'; pen.fillStyle = key.black ? '#ffffffdd' : ink;
          pen.fillText(nameParts(note).main, cx, cy - r - 9);
        }
        pen.textBaseline = 'alphabetic';
      } else if (h >= 11 && w >= 12) {
        pen.fillStyle = key.black ? '#ffffff' : ink; pen.textAlign = 'center'; pen.textBaseline = 'middle';
        pen.font = `800 ${Math.round(Math.min(h - 2, 13))}px -apple-system, system-ui, sans-serif`;
        pen.fillText(String(note.finger), x + w / 2, y1 - h / 2 + .5);
        pen.textBaseline = 'alphabetic';
      }
    }
    pen.globalAlpha = 1;
  }
  // Vạch chạm phím
  pen.fillStyle = '#b9edcf'; pen.fillRect(0, hitY, W, 3);
}

// ───────────────────────── Hiển thị bước hiện tại ─────────────────────────
function context(time = state.view.steps[state.index]?.time ?? 0) {
  const steps = state.view.steps, step = steps[state.index];
  const striking = step?.notes ?? [];
  const held = state.notes.filter(n => settings.hands.includes(n.hand) && n.start < time && n.start + n.duration > time && !striking.includes(n));
  return { step, striking, held, upcoming: steps[state.index + 1]?.notes ?? [] };
}
function renderStep() {
  const { step, striking, held, upcoming } = context();
  if (!step) return;
  const [pianoLo, pianoHi] = PIANOS[settings.piano];
  const spoken = [];
  for (const hand of ['R', 'L']) {
    const card = $('card' + hand), notesEl = $('notes' + hand), whereEl = $('where' + hand);
    const on = settings.hands.includes(hand);
    const mine = striking.filter(n => n.hand === hand), keep = held.filter(n => n.hand === hand);
    card.classList.toggle('off', !on);
    card.classList.toggle('idle', on && !mine.length);
    if (!on) { notesEl.innerHTML = '<span class="rest">Đang tập tay kia</span>'; whereEl.textContent = ''; continue; }
    if (mine.length) {
      notesEl.innerHTML = mine.map(noteChip).join('');
      spoken.push(`${hand === 'R' ? 'Tay phải' : 'Tay trái'} ${mine.map(n => `ngón ${n.finger} ${nameParts(n).spoken}`).join(', ')}`);
    } else if (keep.length) notesEl.innerHTML = `<span class="held">Giữ phím <b>${keep.map(n => nameParts(n).main + nameParts(n).octave).join(' + ')}</b></span>`;
    else notesEl.innerHTML = '<span class="rest">Nghỉ</span>';
    const outside = mine.find(n => n.midi < pianoLo || n.midi > pianoHi);
    if (outside) whereEl.innerHTML = `<span class="warn">⚠ Đàn ${settings.piano} phím không có phím này: đánh ${nameParts(outside).main} ${outside.midi < pianoLo ? 'cao' : 'thấp'} hơn 1 quãng tám.</span>`;
    else if (mine.length === 1) { const { place, where } = keyPlace(mine[0].midi); whereEl.textContent = `${place[0].toUpperCase() + place.slice(1)} · ${where}`; }
    else whereEl.textContent = mine.length ? `Bấm ${mine.length} phím cùng lúc` : '';
  }
  $('nextNotes').innerHTML = upcoming.length ? upcoming.map(noteChip).join('') : '<span class="rest">Hết đoạn</span>';
  // Pedal
  const bar = score.bars[step.bar], steps = state.view.steps;
  const pedal = $('pedal');
  pedal.hidden = !bar.pedal;
  if (bar.pedal) {
    const first = steps[state.index - 1]?.bar !== step.bar, last = steps[state.index + 1]?.bar !== step.bar;
    pedal.textContent = first ? 'PEDAL ↓ đạp' : last ? 'PEDAL ↑ nhả sau nốt này' : 'PEDAL giữ';
  }
  const lesson = state.lesson;
  $('progressText').textContent = `Ô ${step.bar - lesson.from + 1}/${lesson.to - lesson.from + 1} · Bước ${state.index + 1}/${steps.length}`;
  $('seek').value = state.index;
  markKeys(striking, held, upcoming);
  drawMinimap();
  if (!state.play) $('announce').textContent = spoken.join('. ');
  state.dirty = true;
}

// ───────────────────────── Chọn đoạn / tay ─────────────────────────
function renderLessons() {
  const nav = $('lessons');
  nav.replaceChildren(...LESSONS.map((lesson, i) => {
    const button = document.createElement('button');
    button.className = 'chip' + (lesson.id === state.lesson.id ? ' active' : '');
    button.innerHTML = `<span class="n">${lesson.star ? '★' : i + 1}</span>${lesson.title}${settings.done[lesson.id] ? ' <span class="ok">✓</span>' : ''}`;
    button.title = lesson.hint;
    button.onclick = () => selectLesson(lesson.id);
    return button;
  }));
  nav.querySelector('.active')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}
const stepKey = () => `${state.lesson.id}:${settings.hands}`;
function selectLesson(id, index) {
  stopPlay();
  state.lesson = LESSONS.find(l => l.id === id) ?? LESSONS[0];
  settings.lesson = state.lesson.id;
  const all = buildSteps(score, state.lesson.from, state.lesson.to, 'RL');
  state.notes = all.notes; state.start = all.start; state.end = all.end;
  computeRange(); buildKeyboard();
  rebuildSteps(index ?? settings.steps[stepKey()] ?? 0);
  renderLessons(); save();
}
// Đoạn nhiều nốt nhanh (móc ba, chùm ba) được kéo giãn theo chiều dọc cho dễ nhìn.
function computeZoom() {
  const steps = state.view.steps, gaps = [];
  for (let i = 1; i < steps.length; i++) if (steps[i].time > steps[i - 1].time) gaps.push(steps[i].time - steps[i - 1].time);
  gaps.sort((a, b) => a - b);
  state.zoom = Math.min(2.2, Math.max(1, TICKS / (gaps[Math.floor(gaps.length * .15)] ?? TICKS)));
  state.dirty = true;
}
function rebuildSteps(index) {
  state.view = buildSteps(score, state.lesson.from, state.lesson.to, settings.hands);
  computeZoom();
  $('seek').max = Math.max(0, state.view.steps.length - 1);
  goTo(index, { sound: false, instant: true });
}
function setHands(hands) {
  stopPlay();
  const time = state.view.steps[state.index]?.time ?? 0;
  settings.hands = hands;
  document.querySelectorAll('#handSeg button').forEach(b => b.setAttribute('aria-checked', String(b.dataset.hands === hands)));
  state.view = buildSteps(score, state.lesson.from, state.lesson.to, hands);
  computeZoom();
  $('seek').max = Math.max(0, state.view.steps.length - 1);
  const index = state.view.steps.findIndex(s => s.time >= time);
  goTo(index < 0 ? 0 : index, { sound: false });
  save();
}
function goTo(index, { sound = true, instant = false } = {}) {
  const steps = state.view.steps;
  if (!steps.length) return;
  state.index = Math.max(0, Math.min(steps.length - 1, index));
  state.target = steps[state.index].time;
  if (instant) state.pos = state.target;
  hideDone();
  settings.steps[stepKey()] = state.index; save();
  renderStep();
  if (sound && settings.sound) playStep();
}
async function playStep() {
  const ctx = await ensureAudio();
  if (!ctx) return;
  const { striking, held } = context();
  const keep = new Set(held.map(n => n.id));
  for (const [id, voice] of state.stepVoices) if (!keep.has(id)) { voice.stop(ctx.currentTime); state.stepVoices.delete(id); }
  const spt = secondsPerTick();
  for (const note of striking) {
    const voice = pianoNote(note.midi, ctx.currentTime + .01, Math.min(2, Math.max(.35, soundTicks(note) * spt)), .85);
    if (voice) state.stepVoices.set(note.id, voice);
  }
}
function next() {
  if (state.play) { stopPlay(); return; }
  if (state.done) { goTo(0); return; }
  $('tapHint').style.opacity = 0;
  if (state.index >= state.view.steps.length - 1) { finishLesson(); return; }
  goTo(state.index + 1);
}
function prev() {
  if (state.play) stopPlay();
  goTo(state.index - 1);
}
function finishLesson() {
  settings.done[state.lesson.id] = true; save(); renderLessons();
  if (settings.loop) { goTo(0); return; }
  const i = LESSONS.indexOf(state.lesson);
  $('nextLessonButton').hidden = i >= LESSONS.length - 1;
  $('doneSub').textContent = i >= LESSONS.length - 1 ? 'Bạn đã đi hết cả bài Für Elise. Tuyệt vời!' : `Tập lại vài lần cho thuộc tay, rồi sang “${LESSONS[i + 1].title}”.`;
  $('done').hidden = false; state.done = true;
}
function hideDone() { $('done').hidden = true; state.done = false; }

// ───────────────────────── Tự chạy ─────────────────────────
async function startPlay() {
  const ctx = await ensureAudio();
  if (!ctx) return;
  keepAwake();
  const steps = state.view.steps;
  let index = state.index;
  if (state.done || index >= steps.length - 1) index = 0;
  hideDone();
  beginPlayback(steps[index].time, settings.countIn);
}
function beginPlayback(tick, countIn) {
  const ctx = audio.ctx, spt = secondsPerTick(), eighth = 2 * TICKS * spt;
  const lead = countIn ? eighth * 3 : .12;
  const t0 = ctx.currentTime + lead + .05;
  const cursor = state.notes.findIndex(n => n.start >= tick);
  state.play = { t0, tick0: tick, spt, cursor: cursor < 0 ? state.notes.length : cursor, voices: [], eighth };
  if (countIn) for (let i = 0; i < 3; i++) state.play.voices.push(click(t0 - eighth * (3 - i), i === 0));
  state.play.timer = setInterval(schedule, 25);
  schedule();
  $('playButton').textContent = 'Ⅱ Dừng'; $('playButton').classList.add('on');
  $('tapHint').style.opacity = 0;
}
function schedule() {
  const p = state.play, ctx = audio.ctx;
  if (!p) return;
  const horizon = ctx.currentTime + .3;
  p.voices = p.voices.filter(v => v.end > ctx.currentTime);
  while (p.cursor < state.notes.length) {
    const note = state.notes[p.cursor];
    const when = p.t0 + (note.start - p.tick0) * p.spt;
    if (when > horizon) break;
    p.cursor++;
    const practiced = settings.hands.includes(note.hand);
    if (!settings.sound || (!practiced && !settings.accomp) || when < ctx.currentTime - .05) continue;
    const voice = pianoNote(note.midi, Math.max(when, ctx.currentTime), soundTicks(note) * p.spt, practiced ? .85 : .5);
    if (voice) p.voices.push(voice);
  }
}
function updatePlayback() {
  const p = state.play, ctx = audio.ctx;
  const tick = p.tick0 + (ctx.currentTime - p.t0) / p.spt;
  state.pos = state.target = Math.max(p.tick0, tick);
  const countdown = $('countdown');
  if (ctx.currentTime < p.t0 - .02) { countdown.hidden = false; countdown.textContent = Math.max(1, Math.ceil((p.t0 - ctx.currentTime) / p.eighth)); }
  else countdown.hidden = true;
  const steps = state.view.steps;
  let index = state.index;
  while (index + 1 < steps.length && steps[index + 1].time <= tick + .5) index++;
  while (index > 0 && steps[index].time > tick + .5) index--;
  if (index !== state.index) { state.index = index; renderStep(); }
  if (tick >= state.end + TICKS) {
    if (settings.loop) { const voices = p.voices; clearInterval(p.timer); state.play = null; settings.done[state.lesson.id] = true; state.index = 0; renderStep(); beginPlayback(steps[0].time, false); state.play.voices.push(...voices); }
    else { stopPlay(); goTo(steps.length - 1, { sound: false }); finishLesson(); }
  }
}
function stopPlay() {
  const p = state.play;
  if (!p) return;
  clearInterval(p.timer);
  const now = audio.ctx.currentTime;
  for (const voice of p.voices) voice.stop(now);
  state.play = null;
  $('countdown').hidden = true;
  $('playButton').textContent = '▶ Tự chạy'; $('playButton').classList.remove('on');
  const steps = state.view.steps;
  state.target = steps[state.index]?.time ?? 0;
  settings.steps[stepKey()] = state.index; save();
  renderStep();
}
function togglePlay() { if (state.play) stopPlay(); else startPlay(); }
function changeSpeed() {
  settings.speed = Number($('speed').value);
  $('speedOut').textContent = settings.speed + '%';
  save();
  const p = state.play;
  if (!p) return;
  // Đổi tốc độ khi đang chạy: neo lại thời gian từ vị trí hiện tại.
  const ctx = audio.ctx, tick = p.tick0 + (ctx.currentTime - p.t0) / p.spt;
  for (const voice of p.voices) voice.stop(ctx.currentTime + .05);
  clearInterval(p.timer); state.play = null;
  beginPlayback(Math.max(tick, p.tick0), false);
}

// ───────────────────────── Vòng vẽ ─────────────────────────
function frame(now) {
  const dt = Math.min(.1, (now - state.lastFrame) / 1000 || 0);
  state.lastFrame = now;
  if (state.play) { updatePlayback(); state.dirty = true; }
  else if (state.pos !== state.target) {
    state.pos += (state.target - state.pos) * (1 - Math.exp(-dt * 14));
    if (Math.abs(state.target - state.pos) < .3) state.pos = state.target;
    state.dirty = true;
  }
  if (state.dirty) { state.dirty = false; drawRoll(); }
  requestAnimationFrame(frame);
}

// ───────────────────────── Hình minh hoạ trong hướng dẫn ─────────────────────────
function keyboardSVG(lo, hi, { marks = [], tags = {}, height = 120 } = {}) {
  const { keys, whites } = layoutKeys(lo, hi), ww = 30, W = whites * ww, top = 26, H = height;
  let svg = `<svg viewBox="0 0 ${W} ${H + top + 4}" role="img" aria-label="Sơ đồ bàn phím">`;
  const marked = new Map(marks.map(m => [m.midi, m]));
  for (const key of keys.values()) if (!key.black) {
    const m = marked.get(key.midi), x = key.x * W;
    const fill = m ? (m.hand === 'L' ? '#a9cbff' : '#9fe8c0') : key.midi === MIDDLE_C ? '#ffd9db' : '#f3f2e9';
    svg += `<rect x="${x + .5}" y="${top}" width="${ww - 1}" height="${H}" rx="3" fill="${fill}" stroke="#8d8f84"/>`;
    const label = noteLabel(midiName(key.midi));
    svg += `<text x="${x + ww / 2}" y="${top + H - 8}" font-size="10" text-anchor="middle" fill="#4b4e46" font-weight="${key.midi % 12 ? 400 : 700}">${label.solfege}${key.midi % 12 ? '' : label.octave}</text>`;
  }
  for (const key of keys.values()) if (key.black) svg += `<rect x="${key.x * W}" y="${top}" width="${key.w * W}" height="${H * .6}" rx="2" fill="${marked.has(key.midi) ? '#2f9a63' : '#1a1f1d'}"/>`;
  for (const m of marks) {
    const key = keys.get(m.midi); if (!key) continue;
    const cx = (key.x + key.w / 2) * W, cy = top + (key.black ? H * .6 - 13 : H - 30);
    svg += m.hand === 'L' ? `<rect x="${cx - 10}" y="${cy - 10}" width="20" height="20" rx="5" fill="#6aa8ff" stroke="#fff" stroke-width="1.5"/>` : `<circle cx="${cx}" cy="${cy}" r="10" fill="#5ed39a" stroke="#fff" stroke-width="1.5"/>`;
    svg += `<text x="${cx}" y="${cy + 4.5}" font-size="13" font-weight="800" text-anchor="middle" fill="${m.hand === 'L' ? '#071a36' : '#06281a'}">${m.finger}</text>`;
  }
  for (const [midi, text] of Object.entries(tags)) {
    const key = keys.get(Number(midi)); if (!key) continue;
    const cx = (key.x + key.w / 2) * W;
    svg += `<text x="${cx}" y="${top - 9}" font-size="11" font-weight="700" text-anchor="middle" fill="${Number(midi) === MIDDLE_C ? '#ff8f95' : '#b9edcf'}">${text}</text><path d="M${cx} ${top - 6}v5" stroke="#b9edcf"/>`;
  }
  return svg + '</svg>';
}
function handSVG(side) {
  // Bàn tay úp trên phím, nhìn từ trên xuống. Tay trái là ảnh gương của tay phải (ngón cái ở bên phải).
  const color = side === 'L' ? '#6aa8ff' : '#5ed39a', ink = '#0b1b14';
  const X = x => (side === 'L' ? 138 - x : x);
  const badge = (x, y, n) => `<circle cx="${X(x)}" cy="${y}" r="10" fill="${color}"/><text x="${X(x)}" y="${y + 4.5}" font-size="12" font-weight="800" text-anchor="middle" fill="${ink}">${n}</text>`;
  let g = `<path d="M${X(30)} 92 Q${X(18)} 70 ${X(6)} 58" stroke="${color}" stroke-width="18" stroke-linecap="round" fill="none" opacity=".45"/>${badge(8, 58, 1)}`;
  g += `<rect x="${side === 'L' ? 10 : 30}" y="80" width="98" height="78" rx="30" fill="${color}" opacity=".3" stroke="${color}"/>`;
  for (const [n, x, len] of [[2, 44, 66], [3, 66, 76], [4, 88, 70], [5, 108, 52]]) {
    g += `<rect x="${X(x) - 9}" y="${88 - len}" width="18" height="${len + 8}" rx="9" fill="${color}" opacity=".45"/>${badge(x, 88 - len + 9, n)}`;
  }
  return `${g}<text x="69" y="178" font-size="12" font-weight="700" letter-spacing="1.5" text-anchor="middle" fill="${color}">${side === 'L' ? 'TAY TRÁI' : 'TAY PHẢI'}</text>`;
}
function renderGuide() {
  $('guideKeys').innerHTML = keyboardSVG(48, 83, { tags: { 48: 'Đô3', 60: 'Đô giữa (Đô4)', 72: 'Đô5' }, height: 110 });
  $('guideHands').innerHTML = `<svg viewBox="0 0 320 186" role="img" aria-label="Số ngón tay hai bàn tay"><g transform="translate(10 0)">${handSVG('L')}</g><g transform="translate(172 0)">${handSVG('R')}</g></svg>`;
  const start = [
    { midi: 45, finger: 5, hand: 'L' },
    { midi: 69, finger: 1, hand: 'R' }, { midi: 71, finger: 2, hand: 'R' }, { midi: 72, finger: 3, hand: 'R' }, { midi: 74, finger: 4, hand: 'R' }, { midi: 76, finger: 5, hand: 'R' },
  ];
  $('guideStart').innerHTML = keyboardSVG(41, 77, { marks: start, tags: { 45: 'La2', 60: 'Đô giữa', 69: 'La4' }, height: 100 });
}

// ───────────────────────── Sự kiện ─────────────────────────
$('nextButton').onclick = next;
$('prevButton').onclick = prev;
$('playButton').onclick = togglePlay;
$('againButton').onclick = () => goTo(0);
$('nextLessonButton').onclick = () => { const i = LESSONS.indexOf(state.lesson); selectLesson(LESSONS[Math.min(LESSONS.length - 1, i + 1)].id, 0); };
$('stage').addEventListener('pointerdown', event => {
  if (event.target.closest('button, .done') || event.button > 0) return;
  event.preventDefault();
  next();
});
document.querySelectorAll('#handSeg button').forEach(button => { button.onclick = () => setHands(button.dataset.hands); });
$('speed').value = settings.speed; $('speedOut').textContent = settings.speed + '%';
$('speed').oninput = changeSpeed;
$('seek').oninput = () => { if (state.play) stopPlay(); goTo(Number($('seek').value), { sound: false }); };
const syncToggles = () => {
  $('loopButton').setAttribute('aria-pressed', String(settings.loop));
  $('soundButton').setAttribute('aria-pressed', String(settings.sound));
  $('soundButton').textContent = settings.sound ? '🔊' : '🔇';
};
$('loopButton').onclick = () => { settings.loop = !settings.loop; syncToggles(); save(); };
$('soundButton').onclick = () => { settings.sound = !settings.sound; syncToggles(); save(); if (!settings.sound) { for (const v of state.stepVoices.values()) v.stop(); state.stepVoices.clear(); } else ensureAudio(); };
// <dialog> có từ iPadOS 15.4; bản cũ hơn chỉ hiện/ẩn bằng thuộc tính open.
const openDialog = dialog => (dialog.showModal ? dialog.showModal() : dialog.setAttribute('open', ''));
const closeDialog = dialog => {
  if (dialog.close) dialog.close();
  else { dialog.removeAttribute('open'); dialog.dispatchEvent(new Event('close')); }
};
$('guideButton').onclick = () => openDialog($('guideDialog'));
$('settingsButton').onclick = () => {
  $('setNames').value = settings.names; $('setLabels').value = settings.labels; $('setPiano').value = settings.piano;
  $('setPreview').checked = settings.preview; $('setAccomp').checked = settings.accomp; $('setCountIn').checked = settings.countIn; $('setWake').checked = settings.wake;
  openDialog($('settingsDialog'));
};
for (const [id, field] of [['setNames', 'names'], ['setLabels', 'labels'], ['setPiano', 'piano']]) $(id).onchange = () => { settings[field] = $(id).value; save(); buildKeyboard(); renderStep(); };
for (const [id, field] of [['setPreview', 'preview'], ['setAccomp', 'accomp'], ['setCountIn', 'countIn'], ['setWake', 'wake']]) $(id).onchange = () => {
  settings[field] = $(id).checked; save();
  if (field === 'wake') { if (settings.wake) keepAwake(); else releaseWake(); }
  renderStep();
};
$('resetProgress').onclick = () => { settings.done = {}; settings.steps = {}; save(); renderLessons(); };
document.querySelectorAll('[data-close]').forEach(button => { button.onclick = () => closeDialog($(button.dataset.close)); });
$('guideDialog').addEventListener('close', () => { settings.seenGuide = true; save(); });
document.addEventListener('keydown', event => {
  if (document.querySelector('dialog[open]') || event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.target.closest?.('input, select')) return;
  const onButton = event.target.closest?.('button');
  if (['ArrowRight', 'ArrowDown', 'PageDown'].includes(event.key) || ([' ', 'Enter'].includes(event.key) && !onButton)) { event.preventDefault(); next(); }
  else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(event.key)) { event.preventDefault(); prev(); }
  else if (event.key === 'p' || event.key === 'P') togglePlay();
});
document.addEventListener('pointerdown', () => { keepAwake(); }, { passive: true });
// Safari iOS chỉ mở âm thanh trong touchend/click: mở sẵn ở lần chạm đầu tiên.
const unlockAudio = () => { ensureAudio(); document.removeEventListener('touchend', unlockAudio); document.removeEventListener('click', unlockAudio); };
document.addEventListener('touchend', unlockAudio, { passive: true });
document.addEventListener('click', unlockAudio);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') keepAwake();
  else stopPlay();
});
new ResizeObserver(() => { resizeRoll(); fitLabels(); drawMinimap(); }).observe($('stage'));

syncToggles();
document.querySelectorAll('#handSeg button').forEach(b => b.setAttribute('aria-checked', String(b.dataset.hands === settings.hands)));
renderGuide();
selectLesson(settings.lesson);
resizeRoll();
requestAnimationFrame(frame);
if (!settings.seenGuide) openDialog($('guideDialog'));
