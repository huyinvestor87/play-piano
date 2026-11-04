// Für Elise (WoO 59) – L. v. Beethoven. Nốt nhạc chép từ bản Breitkopf & Härtel 1888
// (bản khắc LilyPond của Mutopia Project, public domain). Số ngón là gợi ý cho người mới.
//
// Cú pháp mỗi bè: các token cách nhau bởi dấu cách.
//   E5/5      nốt Mi5, ngón 5, dài 1 nốt móc kép (1/16)
//   A4/1:2    dài 2 móc kép (= 1 móc đơn)      :.5 = 1/32   :t = 1 nốt chùm ba móc kép
//   C4/1+E4/3 hợp âm (các nốt bấm cùng lúc)     ~F4/1 = nốt hoa mỹ, đánh nhanh ngay trước nốt sau
//   r:3       lặng 3 móc kép                     x6 ở cuối = lặp lại token 6 lần
export const TICKS = 24; // 1 nốt móc kép (1/16) = 24 tick
export const GRACE_TICKS = 6;

const P = 1; // đạp pedal ở đầu ô nhịp, nhả ở cuối ô nhịp
// [tay phải, tay trái, pedal]
const BARS = {
  // ───────── Phần A ─────────
  pu: ['E5/5 D#5/4', 'r:2'],
  a1: ['E5/5 D#5/4 E5/5 B4/2 D5/4 C5/3', 'r:6'],
  a2: ['A4/1:2 r C4/1 E4/2 A4/3', 'A2/5 E3/2 A3/1 r:3', P],
  a3: ['B4/4:2 r E4/1 G#4/2 B4/4', 'E2/5 E3/2 G#3/1 r:3', P],
  a4: ['C5/5:2 r E4/1 E5/5 D#5/4', 'A2/5 E3/2 A3/1 r:3', P],
  a7: ['B4/4:2 r E4/1 C5/3 B4/2', 'E2/5 E3/2 G#3/1 r:3', P],
  a8x: ['A4/1:4', 'A2/5 E3/2 A3/1 r'],
  a8: ['A4/1:2 r B4/2 C5/3 D5/4', 'A2/5 E3/2 A3/1 r:3'],
  c9: ['E5/5:3 G4/1 F5/5 E5/4', 'C3/5 G3/2 C4/1 r:3', P],
  c10: ['D5/3:3 F4/1 E5/5 D5/4', 'G2/5 G3/2 B3/1 r:3', P],
  c11: ['C5/3:3 E4/1 D5/5 C5/4', 'A2/5 E3/2 A3/1 r:3', P],
  c12: ['B4/3:2 r E4/1 E5/5 r', 'E2/5 E3/2 E4/1 r:2 E4/5', P],
  c13: ['r E5/1 E6/5 r:2 D#5/4', 'E5/1 r:2 D#5/2 E5/1 r', P],
  c14: ['E5/5:2 r D#5/4 E5/5 D#5/4', 'r D#5/2 E5/1 r:3'],
  c14b: ['E5/5 r:2 D#5/4 E5/5 D#5/4', 'r D#5/2 E5/1 r:3'],
  a22: ['A4/1:2 r E4/1+C5/5 F4/2+C5/5 E4/1+G4/3+C5/5', 'A2/5 E3/2 A3/1 Bb3/2+C4/1 A3/2+C4/1 G3/3+Bb3/2+C4/1'],
  end: ['A4/1:2 r:2', 'A1/5+A2/1:2 r:2'],

  // ───────── Phần B (Fa trưởng) ─────────
  b1: ['~F4/1 ~A4/2 C5/3:4 F5/5:1.5 E5/4:.5', 'F3/5 A3/3 C4/1 A3/3 C4/1 A3/3'],
  b2: ['E5/2:2 D5/1:2 Bb5/5:1.5 A5/4:.5', 'F3/5 Bb3/2 D4/1 Bb3/2 D4/1 Bb3/2'],
  b3: ['A5/5 G5/4 F5/3 E5/2 D5/1 C5/3', 'F3/5 E4/1 F3/5+G3/4+Bb3/2 E4/1 F3/5+G3/4+Bb3/2 E4/1'],
  b4: ['Bb4/2:2 A4/1:2 ~Bb4/3 A4/2:.5 G4/1:.5 A4/2:.5 Bb4/3:.5', 'F3/5 A3/3 C4/1 A3/3 C4/1 A3/3'],
  b5: ['C5/1:4 D5/2 D#5/3', 'F3/5 A3/3 C4/1 A3/3 C4/1 A3/3'],
  b6: ['E5/4:3 E5/4 F5/5 A4/1', 'E3/5 A3/3 C4/1 A3/3 D3/5+D4/1 F3/4'],
  b7: ['C5/2:4 D5/3:1.5 B4/1:.5', 'G3/3 E4/1 G3/3 E4/1 G3/3 F4/1'],
  b8: ['C5/2:.5 G5/5:.5 G4/1:.5 G5/5:.5 A4/1:.5 G5/5:.5 B4/2:.5 G5/5:.5 C5/2:.5 G5/5:.5 D5/3:.5 G5/5:.5', 'C4/5+E4/3:2 r F4/2+G4/1 E4/3+G4/1 D4/4+F4/2+G4/1'],
  b9: ['E5/1:.5 G5/2:.5 C6/5:.5 B5/4:.5 A5/3:.5 G5/2:.5 F5/1:.5 E5/3:.5 D5/2:.5 G5/5:.5 F5/4:.5 D5/2:.5', 'C4/5+E4/3+G4/1:2 F3/5+A3/3:2 G3/4+B3/2:2'],
  b10: ['C5/1:.5 G5/5:.5 G4/1:.5 G5/5:.5 A4/1:.5 G5/5:.5 B4/2:.5 G5/5:.5 C5/2:.5 G5/5:.5 D5/3:.5 G5/5:.5', 'C4/5:2 r F4/2+G4/1 E4/3+G4/1 D4/4+F4/2+G4/1'],
  b12: ['E5/4:.5 F5/5:.5 E5/4:.5 D#5/3:.5 E5/4:.5 B4/1:.5 E5/4:.5 D#5/3:.5 E5/4:.5 B4/1:.5 E5/4:.5 D#5/3:.5', 'G#3/4+B3/2:2 r:4'],
  b13: ['E5/5:3 B4/1 E5/5 D#5/4', 'r:6'],
  b15: ['E5/5 D#5/4 E5/5 D#5/4 E5/5 D#5/4', 'r:6'],

  // ───────── Phần C (bè La ngân dưới) ─────────
  k0: ['A4/1:2 r:4', 'A2/1 x6'],
  k1: ['E4/1+G4/2+Bb4/3+C#5/5:6', 'A2/1 x6'],
  k2: ['F4/1+A4/2+D5/5:4 C#5/2+E5/4 D5/3+F5/5', 'A2/1 x6'],
  k3: ['G#4/1+D5/3+F5/5:4 G#4/1+D5/3+F5/5:2', 'A2/1 x6'],
  k4: ['A4/1+C5/3+E5/5:6', 'A2/1 x6'],
  k5: ['F4/1+D5/5:4 E4/1+C5/5 D4/1+B4/5', 'D2/5+A2/1 x6'],
  k6: ['C4/1+F#4/3+A4/5:4 C4/1+A4/5:2', 'D#2/5+A2/1 x6'],
  k7: ['C4/1+A4/5:2 E4/1+C5/5:2 D4/1+B4/5:2', 'E2/5+A2/1 x4 E2/5+G#2/2 x2'],
  k8: ['C4/1+A4/5:6', 'A1/5+A2/1 A2/1 x5'],
  k11: ['D5/3+F5/5:4 D5/3+F5/5:2', 'A2/1 x6'],
  k12: ['D5/3+F5/5:6', 'Bb2/1 x6'],
  k13: ['G4/1+Eb5/5:4 F4/1+D5/5 Eb4/1+C5/5', 'Bb2/1 x6'],
  k14: ['D4/1+F4/2+Bb4/5:4 D4/1+F4/2+A4/5:2', 'Bb2/1 x6'],
  k15: ['D4/1+F4/2+G#4/4:4 D4/1+F4/2+G#4/4:2', 'B2/1 x6'],
  k16: ['C4/1+E4/2+A4/5:4 r:2', 'C3/1:4 r:2'],
  k17: ['E4/1+B4/5:2 r:4', 'E3/2+G#3/1:2 r:4'],
  k18: ['A3/1:t C4/2:t E4/3:t A4/1:t C5/2:t E5/5:t D5/4:t C5/3:t B4/2:t', 'A1/5:2 r:2 A3/5+C4/3+E4/1:2', P],
  k19: ['A4/1:t C5/2:t E5/3:t A5/1:t C6/2:t E6/5:t D6/4:t C6/3:t B5/2:t', 'A3/5+C4/3+E4/1:2 r:2 A3/5+C4/3+E4/1:2', P],
  k20: ['A5/1:t C6/2:t E6/3:t A6/1:t C7/2:t E7/4:t D7/3:t C7/2:t B6/1:t', 'A3/5+C4/3+E4/1:2 r:2 A3/5+C4/3+E4/1:2', P],
  k21: ['Bb6/3:t A6/1:t G#6/3:t G6/1:t F#6/3:t F6/2:t E6/1:t D#6/3:t D6/1:t', 'A3/5+C4/3+E4/1:2 r:4', P],
  k22: ['C#6/3:t C6/2:t B5/1:t Bb5/3:t A5/1:t G#5/3:t G5/1:t F#5/3:t F5/2:t', 'r:6', P],
};
BARS.b11 = BARS.b9;
BARS.b14 = BARS.b13;
BARS.k9 = BARS.k1;
BARS.k10 = BARS.k2;

const seq = (prefix, from, to) => Array.from({ length: to - from + 1 }, (_, i) => prefix + (from + i));
const THEME_A = ['a1', 'a2', 'a3', 'a4', 'a1', 'a2', 'a7'];
const MIDDLE = ['c9', 'c10', 'c11', 'c12', 'c13'];
// Thứ tự chơi thực tế (đã mở các dấu nhắc lại).
export const SECTIONS = [
  { id: 'A', title: 'Phần A', bars: ['pu', ...THEME_A, 'a8x', 'pu', ...THEME_A, 'a8', ...MIDDLE, 'c14', ...THEME_A, 'a8', ...MIDDLE, 'c14', ...THEME_A, 'a22'] },
  { id: 'B', title: 'Phần B', bars: [...seq('b', 1, 15), 'a1'] },
  { id: 'A2', title: 'Phần A (nhắc lại)', bars: [...THEME_A.slice(1), 'a8', ...MIDDLE, 'c14b', ...THEME_A] },
  { id: 'C', title: 'Phần C', bars: seq('k', 0, 22) },
  { id: 'A3', title: 'Phần A (kết)', bars: [...THEME_A, 'a8', ...MIDDLE, 'c14b', ...THEME_A, 'end'] },
];
export const ORDER = SECTIONS.flatMap(section => section.bars.map(key => ({ key, section: section.id })));
const sectionStart = id => ORDER.findIndex(bar => bar.section === id);

// Bài tập: [ô nhịp đầu, ô nhịp cuối] tính theo ORDER (đã mở nhắc lại), gồm cả hai đầu.
const A = sectionStart('A');
export const LESSONS = [
  { id: 'cau1', title: 'Câu 1 · Chủ đề', hint: 'Mi Rê♯ Mi Rê♯ Mi Si Rê Đô La – đoạn nổi tiếng nhất', from: A, to: A + 4, star: true },
  { id: 'cau2', title: 'Câu 2 · Trả lời', hint: 'Lặp lại chủ đề, kết về nốt La', from: A + 5, to: A + 8 },
  { id: 'cau3', title: 'Câu 3 · Đô trưởng', hint: 'Si Đô Rê → Mi… Sol Fa Mi, sáng hơn', from: A + 17, to: A + 21 },
  { id: 'cau4', title: 'Câu 4 · Cầu nối', hint: 'Hai tay thay nhau đánh Mi – Rê♯', from: A + 21, to: A + 24 },
  { id: 'cau5', title: 'Câu 5 · Về chủ đề', hint: 'Chủ đề trở lại và kết câu', from: A + 24, to: A + 31 },
  { id: 'phanA', title: 'Phần A đầy đủ', hint: 'Câu 1 → 5 với đủ các lần nhắc lại', from: A, to: sectionStart('B') - 1 },
  { id: 'phanB1', title: 'Phần B · Giai điệu', hint: 'Đoạn Fa trưởng, tay trái rải đều', from: sectionStart('B'), to: sectionStart('B') + 6 },
  { id: 'phanB2', title: 'Phần B · Nốt nhanh', hint: 'Chuỗi nốt móc ba quanh Sol5, về lại Mi – Rê♯', from: sectionStart('B') + 7, to: sectionStart('A2') - 1 },
  { id: 'phanC1', title: 'Phần C · Hợp âm', hint: 'Tay trái gõ đều La2, tay phải bấm hợp âm', from: sectionStart('C'), to: sectionStart('C') + 17 },
  { id: 'phanC2', title: 'Phần C · Rải lên', hint: 'Rải hợp âm La thứ lên cao rồi đi xuống từng phím', from: sectionStart('C') + 18, to: sectionStart('C') + 22 },
  { id: 'ket', title: 'Đoạn kết', hint: 'Phần A lần cuối', from: sectionStart('A3'), to: ORDER.length - 1 },
  { id: 'all', title: 'Cả bài', hint: 'Toàn bộ Für Elise ≈ 3 phút ở tốc độ gốc', from: 0, to: ORDER.length - 1 },
];

// ───────── Tên nốt ─────────
const STEP = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const SOLFEGE = { C: 'Đô', D: 'Rê', E: 'Mi', F: 'Fa', G: 'Sol', A: 'La', B: 'Si' };
export function parsePitch(name) {
  const match = /^([A-G])(#|b)?(\d)$/.exec(name);
  if (!match) throw new Error('Tên nốt không hợp lệ: ' + name);
  const [, letter, accidental = '', octave] = match;
  return { letter, accidental, octave: Number(octave), midi: 12 * (Number(octave) + 1) + STEP[letter] + (accidental === '#' ? 1 : accidental === 'b' ? -1 : 0) };
}
const SIGN = { '#': '♯', b: '♭', '': '' };
/** "D#5" → { solfege: "Rê♯", letter: "D♯", octave: 5 } */
export function noteLabel(name) {
  const { letter, accidental, octave } = parsePitch(name);
  return { solfege: SOLFEGE[letter] + SIGN[accidental], letter: letter + SIGN[accidental], octave };
}
const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const midiName = midi => SHARP_NAMES[midi % 12] + (Math.floor(midi / 12) - 1);
export const isBlack = midi => [1, 3, 6, 8, 10].includes(((midi % 12) + 12) % 12);
export const MIDDLE_C = 60;

// Mô tả vị trí phím trên đàn thật dựa vào nhóm phím đen.
const PLACE = [
  'phím trắng ngay bên trái nhóm 2 phím đen',
  'phím đen bên trái trong nhóm 2 phím đen',
  'phím trắng nằm giữa 2 phím đen',
  'phím đen bên phải trong nhóm 2 phím đen',
  'phím trắng ngay bên phải nhóm 2 phím đen',
  'phím trắng ngay bên trái nhóm 3 phím đen',
  'phím đen thứ nhất trong nhóm 3 phím đen',
  'phím trắng giữa phím đen thứ 1 và thứ 2 (nhóm 3)',
  'phím đen ở giữa nhóm 3 phím đen',
  'phím trắng giữa phím đen thứ 2 và thứ 3 (nhóm 3)',
  'phím đen thứ ba trong nhóm 3 phím đen',
  'phím trắng ngay bên phải nhóm 3 phím đen',
];
export function keyPlace(midi) {
  const octaveFromMiddle = Math.floor(midi / 12) - 5;
  const where = octaveFromMiddle === 0 ? 'cùng quãng tám với Đô giữa'
    : octaveFromMiddle > 0 ? `cao hơn Đô giữa ${octaveFromMiddle} quãng tám`
    : `thấp hơn Đô giữa ${-octaveFromMiddle} quãng tám`;
  return { place: PLACE[midi % 12], where };
}

// ───────── Đọc bản nhạc ─────────
function parseDuration(text) {
  if (text === undefined) return TICKS;
  if (text === 't') return TICKS * 2 / 3;
  const value = Number(text);
  if (!Number.isFinite(value) || value <= 0) throw new Error('Trường độ không hợp lệ: ' + text);
  return Math.round(value * TICKS);
}
export function parseVoice(text) {
  const events = [];
  let position = 0;
  const tokens = text.trim().split(/\s+/);
  for (let i = 0; i < tokens.length; i++) {
    let token = tokens[i];
    let repeat = 1;
    if (/^x\d+$/.test(tokens[i + 1] ?? '')) { repeat = Number(tokens[i + 1].slice(1)); i++; }
    const grace = token.startsWith('~');
    if (grace) token = token.slice(1);
    const [body, durationText] = token.split(':');
    const duration = grace ? 0 : parseDuration(durationText);
    const pitches = body === 'r' ? [] : body.split('+').map(part => {
      const [name, finger] = part.split('/');
      const { midi } = parsePitch(name);
      return { name, midi, finger: finger ? Number(finger) : null };
    });
    for (let k = 0; k < repeat; k++) {
      events.push({ start: position, duration, pitches, grace });
      position += duration;
    }
  }
  return { events, length: position };
}

/** Toàn bộ bản nhạc theo thứ tự chơi: danh sách nốt và ô nhịp (thời gian tính bằng tick). */
export function buildScore(order = ORDER) {
  const notes = [], bars = [];
  let time = 0;
  order.forEach(({ key, section }, index) => {
    const [right, left, pedal] = BARS[key] ?? (() => { throw new Error('Thiếu ô nhịp ' + key); })();
    const voices = { R: parseVoice(right), L: parseVoice(left) };
    if (voices.R.length !== voices.L.length) throw new Error(`Ô ${key}: tay phải ${voices.R.length} ≠ tay trái ${voices.L.length}`);
    bars.push({ index, key, section, start: time, length: voices.R.length, pedal: !!pedal });
    for (const hand of ['R', 'L']) {
      const events = voices[hand].events;
      events.forEach((event, e) => {
        if (!event.pitches.length) return;
        let start = time + event.start, duration = event.duration;
        if (event.grace) {
          // Nốt hoa mỹ: đặt sát trước nốt chính tiếp theo.
          let after = 0;
          while (events[e + after + 1]?.grace) after++;
          start -= (after + 1) * GRACE_TICKS;
          duration = GRACE_TICKS;
        }
        for (const pitch of event.pitches) notes.push({ ...pitch, hand, start, duration, bar: index, grace: event.grace });
      });
    }
    time += voices.R.length;
  });
  notes.sort((a, b) => a.start - b.start || a.midi - b.midi);
  notes.forEach((note, id) => { note.id = id; });
  return { notes, bars, length: time };
}

/** Nhóm nốt thành từng "bước" bấm (các nốt bắt đầu cùng lúc). */
export function buildSteps(score, fromBar, toBar, hands = 'RL') {
  const start = score.bars[fromBar].start;
  const end = score.bars[toBar].start + score.bars[toBar].length;
  const inRange = score.notes.filter(n => hands.includes(n.hand) && n.start >= start - GRACE_TICKS * 4 && n.start < end && n.bar >= fromBar && n.bar <= toBar);
  const steps = [];
  for (const note of inRange) {
    const last = steps[steps.length - 1];
    if (last && last.time === note.start) last.notes.push(note);
    else steps.push({ time: note.start, notes: [note], bar: note.bar });
  }
  return { steps, start, end, notes: inRange };
}
