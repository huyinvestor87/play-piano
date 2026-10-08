import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import { frequency } from '../music.js';
test('analysis worker returns ordered guides for a complete uploaded-like melody', async () => {
  const rate = 8000, samples = new Float32Array(rate * 3);
  const expected = [60, 64, 67];
  expected.forEach((midi, n) => {
    for (let i = 0; i < rate * .65; i++) {
      const t = i / rate, f = frequency(midi), attack = Math.min(1, t / .012);
      samples[Math.floor((n * .9 + .1) * rate) + i] = .35 * attack * Math.exp(-2 * t) * (Math.sin(2 * Math.PI * f * t) + .2 * Math.sin(4 * Math.PI * f * t));
    }
  });
  const moduleUrl = new URL('../analyzer-worker.js', import.meta.url).href;
  const worker = new Worker(`const {parentPort}=require('node:worker_threads'); global.self={postMessage:data=>parentPort.postMessage(data)}; import(${JSON.stringify(moduleUrl)}).then(()=>{parentPort.on('message',data=>self.onmessage({data}));parentPort.postMessage({ready:true});});`, { eval: true });
  try {
    const result = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('worker timeout')), 10000);
      worker.on('error', reject);
      worker.on('message', data => {
        if (data.ready) worker.postMessage({ samples, duration: 3 }, [samples.buffer]);
        if (data.notes || data.error) { clearTimeout(timeout); data.error ? reject(new Error(data.error)) : resolve(data); }
      });
    });
    assert.deepEqual(result.notes.map(n => n.midi), expected);
    for (let i = 0; i < 3; i++) assert.ok(Math.abs(result.notes[i].time - (i * .9 + .1)) < .14);
    assert.ok(result.notes.every(n => n.time + n.duration <= 3));
    assert.equal(result.progress, 1);
  } finally { await worker.terminate(); }
});
