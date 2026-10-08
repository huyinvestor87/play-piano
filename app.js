import { frequency, noteName, keyLayout, validateNotes } from './music.js?v=1.0.0';
const $ = id => document.getElementById(id);
const state = { ctx: null, buffer: null, notes: [], duration: 0, position: 0, playing: false, rate: 1, startAt: 0, offset: 0, source: null, backingGain: null, worker: null, loadId: 0, voices: new Map(), pointers: new Map(), cueVoices: [], layout: keyLayout(), editNotes: [], name: '' };
let canvasWidth = 0, canvasHeight = 0;
const canvas = $('guide'), drawing = canvas.getContext('2d');
function status(text) { $('status').textContent = text; }
function formatTime(t) { return `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`; }
async function audio() {
  if (!state.ctx) state.ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (state.ctx.state !== 'running') await state.ctx.resume();
  return state.ctx;
}
function currentPosition() {
  if (!state.playing) return state.position;
  return Math.min(state.duration, state.offset + Math.max(0, state.ctx.currentTime - state.startAt) * state.rate);
}
function beep(time, last = false) {
  const oscillator = state.ctx.createOscillator(), gain = state.ctx.createGain();
  oscillator.frequency.value = last ? 1000 : 700;
  gain.gain.setValueAtTime(.08, time); gain.gain.exponentialRampToValueAtTime(.001, time + .1);
  oscillator.connect(gain).connect(state.ctx.destination); oscillator.start(time); oscillator.stop(time + .12);
  oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  state.cueVoices.push(oscillator);
}
function pause() {
  state.position = currentPosition(); state.playing = false;
  if (state.source) { state.source.onended = null; try { state.source.stop(); } catch {} state.source.disconnect(); state.source = null; }
  if (state.backingGain) { state.backingGain.disconnect(); state.backingGain = null; }
  for (const oscillator of state.cueVoices) { try { oscillator.stop(); } catch {} }
  state.cueVoices = [];
  $('playButton').textContent = '▶ Bắt đầu'; $('countdown').hidden = true;
}
async function play() {
  if (!state.buffer) return;
  if (state.playing) { pause(); return; }
  try {
    await audio();
    if (state.position >= state.duration - .02) state.position = 0;
    const delay = $('countIn').checked ? 3.3 : .08;
    state.offset = state.position; state.startAt = state.ctx.currentTime + delay;
    const source = state.ctx.createBufferSource(), gain = state.ctx.createGain();
    state.rate = Number($('speed').value); source.buffer = state.buffer; source.playbackRate.value = state.rate;
    gain.gain.value = $('backing').checked ? .8 : 0;
    source.connect(gain).connect(state.ctx.destination);
    state.source = source; state.backingGain = gain; state.playing = true;
    source.onended = () => { if (state.source === source && state.playing) { state.position = state.duration; pause(); } };
    source.start(state.startAt, state.offset);
    if ($('countIn').checked) for (let i = 0; i < 3; i++) beep(state.startAt - 3 + i, i === 2);
    $('playButton').textContent = 'Ⅱ Tạm dừng';
  } catch (error) { pause(); status('Không phát được âm thanh: ' + error.message); }
}
function pianoVoice(midi) {
  const ctx = state.ctx, now = ctx.currentTime;
  const master = ctx.createGain(); master.gain.value = .24;
  master.connect(ctx.destination);
  const parts = [];
  [1, 2, 3, 4, 6].forEach((partial, i) => {
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    const level = [1, .3, .12, .055, .018][i];
    osc.type = 'sine'; osc.frequency.value = frequency(midi) * partial * (1 + .0002 * partial);
    gain.gain.setValueAtTime(.0001, now); gain.gain.exponentialRampToValueAtTime(level, now + .008);
    gain.gain.exponentialRampToValueAtTime(.0001, now + 3.7 / Math.sqrt(partial));
    osc.connect(gain).connect(master); osc.start(); osc.stop(now + 4);
    parts.push({ osc, gain });
  });
  // Natural decay even if a pointer is held indefinitely.
  parts[0].osc.onended = () => { for (const { osc, gain } of parts) { osc.disconnect(); gain.disconnect(); } master.disconnect(); };
  return () => { const t = ctx.currentTime; for (const { osc, gain } of parts) { gain.gain.cancelAndHoldAtTime(t); gain.gain.exponentialRampToValueAtTime(.0001, t + .22); try { osc.stop(t + .25); } catch {} } };
}
function press(pointer, midi) {
  if (state.pointers.get(pointer) === midi) return;
  release(pointer);
  state.pointers.set(pointer, midi);
  const key = document.querySelector(`[data-midi="${midi}"]`); key?.classList.add('pressed');
  $('playedNote').textContent = noteName(midi);
  if ($('pianoSound').checked && state.ctx?.state === 'running') state.voices.set(pointer, pianoVoice(midi));
}
function release(pointer) {
  const midi = state.pointers.get(pointer);
  state.pointers.delete(pointer); state.voices.get(pointer)?.(); state.voices.delete(pointer);
  if (![...state.pointers.values()].includes(midi)) document.querySelector(`[data-midi="${midi}"]`)?.classList.remove('pressed');
  if (!state.pointers.size) $('playedNote').textContent = 'CHẠM ĐỂ CHƠI';
}
function releaseAll() { for (const pointer of [...state.pointers.keys()]) release(pointer); }
function keyboard() {
  releaseAll(); state.layout = keyLayout(Number($('range').value)); $('keyboard').replaceChildren();
  for (const key of state.layout) {
    const button = document.createElement('button'); button.className = `key ${key.black ? 'black' : 'white'}`;
    button.dataset.midi = key.midi; button.style.left = `${key.x * 100}%`; button.style.width = `${key.width * 100}%`;
    button.textContent = noteName(key.midi); button.setAttribute('aria-label', `Chơi ${noteName(key.midi)}`);
    button.onpointerdown = event => {
      event.preventDefault(); button.setPointerCapture(event.pointerId);
      press(event.pointerId, key.midi);
      if (state.ctx?.state !== 'running') audio().then(() => {
        if (state.pointers.get(event.pointerId) === key.midi && $('pianoSound').checked && !state.voices.has(event.pointerId)) state.voices.set(event.pointerId, pianoVoice(key.midi));
      }).catch(() => status('Chạm Bắt đầu để bật âm thanh.'));
    };
    button.onpointermove = event => {
      if (!state.pointers.has(event.pointerId)) return;
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('.key');
      if (target) press(event.pointerId, Number(target.dataset.midi));
      else release(event.pointerId);
    };
    button.onpointerup = button.onpointercancel = button.onlostpointercapture = event => release(event.pointerId);
    button.onkeydown = event => { if ([' ', 'Enter'].includes(event.key) && !event.repeat) { event.preventDefault(); audio().then(() => press('keyboard-' + key.midi, key.midi)); } };
    button.onkeyup = event => { if ([' ', 'Enter'].includes(event.key)) release('keyboard-' + key.midi); };
    button.onblur = () => release('keyboard-' + key.midi);
    $('keyboard').append(button);
  }
}
function refreshNotes() {
  $('noteCount').textContent = `${state.notes.length} NỐT GỢI Ý`;
  $('guideEmpty').hidden = !!state.notes.length;
}
function acceptTrack(buffer, name, notes = []) {
  state.buffer = buffer; state.duration = buffer.duration; state.name = name; state.notes = notes;
  state.position = 0; $('trackName').textContent = name; $('seek').max = buffer.duration; $('seek').value = 0;
  $('playButton').disabled = $('stopButton').disabled = $('seek').disabled = false;
  refreshNotes();
}
function cancelAnalysis() { state.loadId++; state.worker?.terminate(); state.worker = null; $('analysisProgress').hidden = true; }
async function upload(file) {
  if (!file) return;
  if (file.size > 30 * 1024 * 1024) { status('File quá lớn. Chọn MP3/WAV dưới 30 MB.'); return; }
  pause(); cancelAnalysis(); const loadId = state.loadId;
  status('Đang mở file âm thanh…'); $('audioFile').disabled = true;
  try {
    const ctx = await audio(); const buffer = await ctx.decodeAudioData(await file.arrayBuffer());
    if (loadId !== state.loadId) return;
    if (buffer.duration > 300) throw new Error('Bản nhạc quá dài. Hãy cắt một đoạn tối đa 5 phút trước khi tải.');
    if (!Number.isFinite(buffer.duration) || buffer.duration < .1) throw new Error('File âm thanh quá ngắn.');
    acceptTrack(buffer, file.name);
    status('Đang tìm giai điệu piano… Bạn vẫn có thể thử bàn phím.');
    $('analysisProgress').hidden = false; $('analysisProgress').value = 0;
    const targetLength = Math.floor(buffer.duration * 8000), samples = new Float32Array(targetLength);
    const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));
    // Average source samples in each target bucket to reduce aliasing.
    for (let i = 0; i < targetLength; i++) {
      const start = Math.floor(i * buffer.sampleRate / 8000), end = Math.min(buffer.length, Math.max(start + 1, Math.floor((i + 1) * buffer.sampleRate / 8000)));
      let sum = 0; for (let k = start; k < end; k++) for (const channel of channels) sum += channel[k];
      samples[i] = sum / ((end - start) * channels.length);
    }
    const worker = new Worker(new URL('./analyzer-worker.js?v=1.0.0', import.meta.url), { type: 'module' }); state.worker = worker;
    const fail = message => { if (loadId !== state.loadId) return; worker.terminate(); state.worker = null; $('analysisProgress').hidden = true; status(message + ' Bạn vẫn nghe được nhạc và có thể nhập hướng dẫn JSON.'); };
    worker.onerror = () => fail('Không chạy được nhận diện trên trình duyệt này.');
    worker.onmessage = ({ data }) => {
      if (loadId !== state.loadId) return;
      if (data.error) { fail('Nhận diện gặp lỗi: ' + data.error); return; }
      $('analysisProgress').value = data.progress;
      if (data.notes) {
        state.notes = data.notes; refreshNotes(); worker.terminate(); state.worker = null; $('analysisProgress').hidden = true;
        const median = [...state.notes].sort((a, b) => a.midi - b.midi)[Math.floor(state.notes.length / 2)]?.midi;
        if (median && median < 60) { $('range').value = '48'; keyboard(); }
        status(state.notes.length ? `Tìm được ${state.notes.length} nốt gợi ý. Nghe và chỉnh lại trước khi quay; hợp âm hai tay có thể nhận sai.` : 'Chưa tìm được giai điệu rõ trong quãng C3–C6. Bạn có thể thêm nốt hoặc nhập JSON.');
      }
    };
    worker.postMessage({ samples, duration: buffer.duration }, [samples.buffer]);
  } catch (error) { if (loadId === state.loadId) { $('analysisProgress').hidden = true; status('Không mở được file: ' + error.message); } }
  finally { $('audioFile').disabled = false; $('audioFile').value = ''; }
}
async function demo() {
  pause(); cancelAnalysis();
  try {
    const ctx = await audio(); const duration = 18;
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate), samples = buffer.getChannelData(0);
    const melody = [60,64,67,72,71,67,65,64,62,65,69,74,72,69,67,65,64,67,72,76,74,72,71,67,65,64,62,67,64,62,60];
    const notes = melody.map((midi, i) => ({ midi, time: i * .52 + .2, duration: i === melody.length - 1 ? 1.5 : .43 }));
    for (const note of notes) {
      const start = Math.floor(note.time * ctx.sampleRate), length = Math.min(Math.floor(1.5 * ctx.sampleRate), samples.length - start);
      for (let j = 0; j < length; j++) { const t = j / ctx.sampleRate, f = frequency(note.midi); samples[start + j] += .24 * Math.min(1, t / .008) * Math.exp(-4 * t) * (Math.sin(2 * Math.PI * f * t) + .25 * Math.sin(4 * Math.PI * f * t)); }
    }
    acceptTrack(buffer, 'Nắng bên cửa sổ · giai điệu mẫu', notes); $('range').value = '60'; keyboard();
    status('Giai điệu mẫu có nốt chuẩn bị sẵn. Tải file của bạn để thử nhận diện piano.');
  } catch (error) { status('Không mở được âm thanh: ' + error.message); }
}
function draw() {
  const position = currentPosition();
  $('seek').value = position; $('timeLabel').textContent = `${formatTime(position)} / ${formatTime(state.duration)}`;
  if (state.playing && state.ctx.currentTime < state.startAt) {
    $('countdown').hidden = false; $('countdown').textContent = Math.min(3, Math.ceil(state.startAt - state.ctx.currentTime));
  } else $('countdown').hidden = true;
  drawing.clearRect(0, 0, canvasWidth, canvasHeight);
  const keyboardBounds = $('keyboard').getBoundingClientRect(), canvasBounds = canvas.getBoundingClientRect();
  const left = keyboardBounds.left - canvasBounds.left, width = keyboardBounds.width, hitY = canvasHeight - 23, secondsAhead = 3;
  for (const key of state.layout.filter(k => !k.black)) {
    drawing.fillStyle = '#ccefd404'; drawing.fillRect(left + key.x * width, 0, key.width * width - 1, canvasHeight);
    drawing.strokeStyle = '#aacbbc12'; drawing.beginPath(); drawing.moveTo(left + key.x * width, 0); drawing.lineTo(left + key.x * width, canvasHeight); drawing.stroke();
  }
  drawing.strokeStyle = '#b9edcf70'; drawing.beginPath(); drawing.moveTo(left, hitY); drawing.lineTo(left + width, hitY); drawing.stroke();
  let active = null, upcoming = null, outside = false;
  for (const note of state.notes) {
    if (note.time + note.duration < position || note.time > position + secondsAhead) continue;
    const key = state.layout.find(k => k.midi === note.midi);
    if (!key) { outside = true; continue; }
    const isActive = note.time <= position && note.time + note.duration >= position;
    if (isActive) active = note;
    if (!upcoming && note.time > position) upcoming = note;
    const scale = hitY / secondsAhead, y = hitY - (note.time - position) * scale;
    const h = Math.max(17, note.duration * scale), x = left + key.x * width + 3, w = Math.max(10, key.width * width - 6);
    drawing.fillStyle = isActive ? '#d4f9df' : key.black ? '#c7a4e9' : '#8cbea4';
    drawing.beginPath(); drawing.roundRect(x, y - h, w, h, 4); drawing.fill();
    if (w > 26) { drawing.fillStyle = '#183027'; drawing.font = '10px -apple-system, sans-serif'; drawing.textAlign = 'center'; drawing.fillText(noteName(note.midi), x + w / 2, y - 5); }
  }
  $('nextNote').textContent = active ? 'Bấm ' + noteName(active.midi) : upcoming ? 'Sắp tới ' + noteName(upcoming.midi) : outside ? 'Có nốt ngoài quãng · đổi quãng phím' : state.notes.length ? 'Theo nhịp của bạn' : 'Chưa có giai điệu';
  requestAnimationFrame(draw);
}
function resizeCanvas() {
  const bounds = canvas.getBoundingClientRect(), ratio = window.devicePixelRatio || 1;
  canvasWidth = bounds.width; canvasHeight = bounds.height; canvas.width = Math.round(canvasWidth * ratio); canvas.height = Math.round(canvasHeight * ratio); drawing.setTransform(ratio, 0, 0, ratio, 0, 0);
}
function renderEditor() {
  $('noteRows').replaceChildren();
  state.editNotes.forEach((note, index) => {
    const row = document.createElement('tr');
    for (const field of ['time', 'midi', 'duration']) {
      const cell = document.createElement('td'); let input;
      if (field === 'midi') { input = document.createElement('select'); for (let midi = 48; midi <= 84; midi++) { const option = document.createElement('option'); option.value = midi; option.textContent = noteName(midi); input.append(option); } }
      else { input = document.createElement('input'); input.type = 'number'; input.step = '.01'; input.min = field === 'duration' ? '.03' : '0'; input.max = state.duration; }
      input.value = typeof note[field] === 'number' ? Math.round(note[field] * 100) / 100 : note[field]; input.setAttribute('aria-label', `${field} nốt ${index + 1}`);
      input.oninput = () => { note[field] = input.value === '' ? NaN : Number(input.value); };
      cell.append(input); row.append(cell);
    }
    const cell = document.createElement('td'), remove = document.createElement('button'); remove.textContent = '×'; remove.setAttribute('aria-label', `Xóa nốt ${index + 1}`); remove.onclick = () => { state.editNotes.splice(index, 1); renderEditor(); }; cell.append(remove); row.append(cell); $('noteRows').append(row);
  });
}
function saveEditor(close = true) {
  try { state.notes = validateNotes(state.editNotes, state.duration); refreshNotes(); $('editorStatus').textContent = ''; status(`Đã lưu ${state.notes.length} nốt hướng dẫn.`); if (close) $('editorDialog').close(); return true; }
  catch (error) { $('editorStatus').textContent = error.message; return false; }
}
function download(data, name) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
}
$('audioFile').onchange = event => upload(event.target.files[0]); $('demoButton').onclick = demo; $('playButton').onclick = play;
$('stopButton').onclick = () => { pause(); state.position = 0; };
$('seek').oninput = event => { pause(); state.position = Number(event.target.value); };
$('speed').onchange = () => { if (state.playing) pause(); if ($('speed').value !== '1') status('Tốc độ chậm dùng để tập; cao độ nhạc cũng thay đổi. Quay và ghép file gốc ở 1×.'); };
$('backing').onchange = () => { if (state.backingGain) state.backingGain.gain.setTargetAtTime($('backing').checked ? .8 : 0, state.ctx.currentTime, .03); };
$('pianoSound').onchange = () => { if (!$('pianoSound').checked) { for (const stop of state.voices.values()) stop(); state.voices.clear(); } };
$('range').onchange = keyboard;
$('filmButton').onclick = () => { const on = document.body.classList.toggle('filming'); $('filmButton').textContent = on ? '↙ Bố cục thường' : '◉ Bố cục quay'; };
$('helpButton').onclick = () => $('helpDialog').showModal();
document.querySelectorAll('[data-close]').forEach(button => { button.onclick = () => $(button.dataset.close).close(); });
$('editButton').onclick = () => { if (!state.buffer) { status('Tải nhạc hoặc mở giai điệu mẫu trước khi chỉnh nốt.'); return; } pause(); cancelAnalysis(); state.editNotes = state.notes.map(note => ({ ...note })); $('editorStatus').textContent = ''; renderEditor(); $('editorDialog').showModal(); };
$('addNote').onclick = () => { state.editNotes.push({ time: Math.min(state.position, state.duration - .1), midi: 60, duration: Math.min(.5, state.duration - Math.min(state.position, state.duration - .1)) }); renderEditor(); };
$('saveNotes').onclick = () => saveEditor();
$('exportNotes').onclick = () => { if (saveEditor(false)) download({ version: 1, track: state.name, duration: state.duration, notes: state.notes }, 'piano-guide.json'); };
$('notesFile').onchange = async event => {
  const file = event.target.files[0]; if (!file) return;
  try { if (file.size > 2 * 1024 * 1024) throw new Error('JSON quá lớn (tối đa 2 MB).'); const data = JSON.parse(await file.text()); state.editNotes = validateNotes(data.notes, state.duration); renderEditor(); $('editorStatus').textContent = `Đã nhập ${state.editNotes.length} nốt. Bấm Lưu hướng dẫn để áp dụng.`; }
  catch (error) { $('editorStatus').textContent = 'Không nhập được JSON: ' + error.message; }
  event.target.value = '';
};
document.addEventListener('visibilitychange', () => { if (document.hidden) { pause(); releaseAll(); } }); window.addEventListener('blur', releaseAll);
new ResizeObserver(resizeCanvas).observe(canvas); keyboard(); requestAnimationFrame(draw);
