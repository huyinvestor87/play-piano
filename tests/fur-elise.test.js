import test from 'node:test';
import assert from 'node:assert/strict';
import { buildScore, buildSteps, parseVoice, noteLabel, keyPlace, midiName, LESSONS, ORDER, TICKS, fitRange, whiteKeys, keyboardWindows } from '../fur-elise-score.js';

const score = buildScore();

test('every bar has matching hand lengths and the piece is complete', () => {
  // buildScore throws when the two hands of a bar differ in length.
  assert.equal(score.bars.length, ORDER.length);
  assert.equal(score.bars.length, 127);
  assert.equal(score.notes.length, 1041);
  assert.equal(score.length / TICKS, 750); // 750 nốt móc kép ≈ 2'36" ở ♩ = 72
});

test('opening theme and left-hand accompaniment are correct', () => {
  const right = score.notes.filter(n => n.hand === 'R').slice(0, 12).map(n => n.name);
  assert.deepEqual(right, ['E5', 'D#5', 'E5', 'D#5', 'E5', 'B4', 'D5', 'C5', 'A4', 'C4', 'E4', 'A4']);
  const left = score.notes.filter(n => n.hand === 'L').slice(0, 6).map(n => n.name);
  assert.deepEqual(left, ['A2', 'E3', 'A3', 'E2', 'E3', 'G#3']);
  const range = score.notes.map(n => n.midi);
  assert.equal(midiName(Math.min(...range)), 'A1');
  assert.equal(midiName(Math.max(...range)), 'E7');
});

test('every note has a finger and chords are fingered in hand order', () => {
  for (const note of score.notes) assert.ok(note.finger >= 1 && note.finger <= 5, `ô ${note.bar} ${note.name}`);
  const groups = new Map();
  for (const note of score.notes) {
    const key = `${note.hand}:${note.start}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(note);
  }
  for (const [key, notes] of groups) {
    const sorted = notes.sort((a, b) => a.midi - b.midi);
    for (let i = 1; i < sorted.length; i++) {
      if (key.startsWith('R')) assert.ok(sorted[i].finger > sorted[i - 1].finger, key);
      else assert.ok(sorted[i].finger < sorted[i - 1].finger, key);
    }
  }
});

test('lessons cover valid bar ranges and produce steps for each hand choice', () => {
  for (const lesson of LESSONS) {
    assert.ok(lesson.from >= 0 && lesson.from <= lesson.to && lesson.to < ORDER.length, lesson.id);
    for (const hands of ['RL', 'R', 'L']) {
      const { steps } = buildSteps(score, lesson.from, lesson.to, hands);
      assert.ok(steps.length > 0, `${lesson.id} ${hands}`);
      for (let i = 1; i < steps.length; i++) assert.ok(steps[i].time > steps[i - 1].time);
      for (const step of steps) assert.ok(step.notes.every(n => hands.includes(n.hand)));
    }
  }
  const first = buildSteps(score, LESSONS[0].from, LESSONS[0].to);
  assert.deepEqual(first.steps.slice(0, 3).map(s => s.notes.map(n => n.name).join('+')), ['E5', 'D#5', 'E5']);
});

test('voice parser handles rests, chords, tuplets, grace notes and repeats', () => {
  assert.equal(parseVoice('A4/1:2 r C4/1 E4/2 A4/3').length, 6 * TICKS);
  assert.equal(parseVoice('A3/1:t C4/2:t E4/3:t').length, 2 * TICKS);
  assert.equal(parseVoice('A2/1 x6').events.length, 6);
  const grace = parseVoice('~F4/1 ~A4/2 C5/3:4');
  assert.equal(grace.length, 4 * TICKS);
  assert.ok(grace.events[0].grace && grace.events[1].grace);
  assert.deepEqual(parseVoice('E4/1+G4/3+C5/5').events[0].pitches.map(p => p.finger), [1, 3, 5]);
});

test('note names and key positions describe the real keyboard', () => {
  assert.deepEqual(noteLabel('D#5'), { solfege: 'Rê♯', letter: 'D♯', octave: 5 });
  assert.equal(noteLabel('Bb4').solfege, 'Si♭');
  assert.equal(keyPlace(60).where, 'cùng quãng tám với Đô giữa');
  assert.match(keyPlace(60).place, /bên trái nhóm 2 phím đen/);
  assert.equal(keyPlace(76).where, 'cao hơn Đô giữa 1 quãng tám');
  assert.equal(keyPlace(45).where, 'thấp hơn Đô giữa 2 quãng tám');
  assert.match(keyPlace(75).place, /phím đen bên phải trong nhóm 2/);
});

test('keyboard ranges show whole black-key groups and enough keys', () => {
  const [lo, hi] = fitRange(45, 76); // La2 … Mi5
  assert.ok([0, 5].includes(lo % 12) && [4, 11].includes(hi % 12));
  assert.ok(lo < 45 && hi > 76 && whiteKeys(lo, hi) >= 22);
  assert.deepEqual(fitRange(60, 62, 24, [53, 83]), [53, 83]); // không vượt ra ngoài giới hạn
});

test('playing the whole piece, the keyboard follows the hands without hiding upcoming notes', () => {
  const lesson = LESSONS.find(l => l.full);
  assert.equal(lesson.from, 0);
  assert.equal(lesson.to, ORDER.length - 1);
  const { notes } = buildSteps(score, lesson.from, lesson.to);
  const range = fitRange(Math.min(...notes.map(n => n.midi)), Math.max(...notes.map(n => n.midi)));
  const windows = keyboardWindows(notes, lesson.from, lesson.to, range);
  let changes = 0, previous = null;
  for (let bar = lesson.from; bar <= lesson.to; bar++) {
    const [lo, hi] = windows.get(bar);
    assert.ok([0, 5].includes(lo % 12) && [4, 11].includes(hi % 12), `ô ${bar}`);
    assert.ok(lo >= range[0] && hi <= range[1] && whiteKeys(lo, hi) >= 24, `ô ${bar}`);
    for (const note of notes) if (note.bar >= bar && note.bar <= bar + 2) assert.ok(note.midi > lo && note.midi < hi, `ô ${bar} ${note.name}`);
    if (previous && (previous[0] !== lo || previous[1] !== hi)) changes++;
    previous = [lo, hi];
  }
  assert.ok(changes <= 20, `bàn phím trượt ${changes} lần`);
});
