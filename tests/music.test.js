import test from 'node:test';
import assert from 'node:assert/strict';
import { frequency, detectPitch, framesToNotes, keyLayout, validateNotes } from '../music.js';
function tone(midi, seconds = .4, sampleRate = 8000) {
  const samples = new Float32Array(seconds * sampleRate);
  for (let i = 0; i < samples.length; i++) {
    const t = i / sampleRate, f = frequency(midi);
    samples[i] = .3 * (Math.sin(2 * Math.PI * f * t) + .3 * Math.sin(4 * Math.PI * f * t) + .1 * Math.sin(6 * Math.PI * f * t));
  }
  return samples;
}
test('recognizes piano-like fundamental across supported range', () => {
  for (const midi of [48, 52, 60, 64, 69, 72, 79, 84]) {
    assert.equal(detectPitch(tone(midi), 0)?.midi, midi, 'MIDI ' + midi);
  }
});
test('silence and unpitched noise do not become invented guide notes', () => {
  assert.equal(detectPitch(new Float32Array(2000), 0), null);
  let seed = 13; const noise = new Float32Array(2000);
  for (let i = 0; i < noise.length; i++) { seed = (1664525 * seed + 1013904223) >>> 0; noise[i] = seed / 2 ** 32 - .5; }
  assert.equal(detectPitch(noise, 0), null);
});
test('segments sustained notes, silence, pitch changes and repeated strikes', () => {
  const frame = (midi, rms = .1) => ({ midi, rms, confidence: .99 });
  const frames = [...Array.from({ length: 5 }, () => frame(60)), null, ...Array.from({ length: 4 }, () => frame(64)), frame(64, .3), ...Array.from({ length: 3 }, () => frame(64, .2))];
  const notes = framesToNotes(frames);
  assert.deepEqual(notes.map(n => n.midi), [60, 64, 64]);
  assert.equal(notes[1].time, 6 * 256 / 8000);
});
test('rejects malformed, out-of-range and out-of-track imported notes', () => {
  for (const notes of [null, [null], [{time:0,midi:60,duration:-1}], [{time:9,midi:60,duration:2}], [{time:0,midi:90,duration:.5}], [{time:0,midi:60.5,duration:.5}], [{time:'0',midi:60,duration:.5}]]) assert.throws(() => validateNotes(notes, 10));
  assert.equal(validateNotes([{time:1,midi:60,duration:.5},{time:0,midi:64,duration:.5}], 10)[0].time, 0);
});
test('keyboard geometry preserves all semitones and ends inside the frame', () => {
  for (const start of [48, 60]) {
    const keys = keyLayout(start); assert.equal(keys.length, 25);
    assert.equal(keys.filter(k => !k.black).length, 15);
    for (const k of keys) { assert.ok(k.x >= 0); assert.ok(k.x + k.width <= 1.00001); }
  }
});
