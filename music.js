export const MIN_MIDI = 48;
export const MAX_MIDI = 84;
const names = ['Đô', 'Đô♯', 'Rê', 'Rê♯', 'Mi', 'Fa', 'Fa♯', 'Sol', 'Sol♯', 'La', 'La♯', 'Si'];
export const frequency = midi => 440 * 2 ** ((midi - 69) / 12);
export const noteName = midi => names[((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1);
export const isBlack = midi => [1, 3, 6, 8, 10].includes(midi % 12);
export function keyLayout(start = 60, end = start + 24) {
  const whites = [];
  for (let midi = start; midi <= end; midi++) if (!isBlack(midi)) whites.push(midi);
  const width = 1 / whites.length;
  let whiteIndex = 0;
  const keys = [];
  for (let midi = start; midi <= end; midi++) {
    const black = isBlack(midi);
    keys.push({ midi, black, x: black ? whiteIndex * width - width * .31 : whiteIndex * width, width: black ? width * .62 : width });
    if (!black) whiteIndex++;
  }
  return keys;
}
export function validateNotes(value, duration) {
  if (!Array.isArray(value) || value.length > 10000) throw new Error('Hướng dẫn phải có mảng notes, tối đa 10.000 nốt.');
  return value.map((n, index) => {
    if (!n || typeof n !== 'object') throw new Error(`Nốt ${index + 1} không hợp lệ.`);
    const { time, midi, duration: length } = n;
    if (![time, midi, length].every(v => typeof v === 'number' && Number.isFinite(v)) || !Number.isInteger(midi) || midi < MIN_MIDI || midi > MAX_MIDI || time < 0 || length < .03 || time + length > duration + .05) {
      throw new Error(`Nốt ${index + 1}: thời điểm / độ dài phải nằm trong bản nhạc, MIDI ${MIN_MIDI}–${MAX_MIDI}.`);
    }
    return { time, midi, duration: Math.min(length, duration - time) };
  }).sort((a, b) => a.time - b.time);
}
// YIN-style normalized difference: a monophonic pitch estimate, never a full score.
export function detectPitch(samples, offset, sampleRate = 8000) {
  const frame = 1024;
  if (offset + frame >= samples.length) return null;
  let energy = 0;
  for (let j = 0; j < frame; j++) energy += samples[offset + j] ** 2;
  const rms = Math.sqrt(energy / frame);
  if (rms < .006) return null;
  const minTau = Math.floor(sampleRate / frequency(MAX_MIDI));
  const maxTau = Math.ceil(sampleRate / frequency(MIN_MIDI));
  const normalized = new Float64Array(maxTau + 2);
  let sum = 0;
  for (let tau = 1; tau <= maxTau + 1; tau++) {
    let diff = 0;
    for (let j = 0; j < frame - maxTau - 1; j++) {
      const delta = samples[offset + j] - samples[offset + j + tau];
      diff += delta * delta;
    }
    sum += diff;
    normalized[tau] = sum ? diff * tau / sum : 1;
  }
  let chosen = -1;
  for (let tau = minTau; tau <= maxTau; tau++) {
    if (normalized[tau] < .20) {
      while (tau < maxTau && normalized[tau + 1] < normalized[tau]) tau++;
      chosen = tau;
      break;
    }
  }
  if (chosen < 0) return null;
  const a = normalized[chosen - 1], b = normalized[chosen], c = normalized[chosen + 1];
  const denominator = 2 * (2 * b - a - c);
  const refined = chosen + (denominator ? (c - a) / denominator : 0);
  const midi = Math.round(69 + 12 * Math.log2(sampleRate / refined / 440));
  if (midi < MIN_MIDI || midi > MAX_MIDI) return null;
  return { midi, rms, confidence: 1 - b };
}
export function framesToNotes(frames, sampleRate = 8000, hop = 256, duration = Infinity) {
  const notes = [];
  let run = null;
  const finish = () => {
    if (run && run.count >= 3) {
      const time = run.start * hop / sampleRate;
      const length = Math.min(run.count * hop / sampleRate, duration - time);
      if (length >= .07) notes.push({ time, midi: run.midi, duration: length });
    }
    run = null;
  };
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    // A clear energy rise helps preserve repeated strikes of the same pitch.
    const newStrike = run && f && run.count >= 4 && f.rms > frames[i - 1]?.rms * 1.9;
    if (!f || f.midi !== run?.midi || newStrike) {
      finish();
      if (f) run = { start: i, midi: f.midi, count: 1 };
    } else run.count++;
  }
  finish();
  return notes;
}
