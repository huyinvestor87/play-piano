import { detectPitch, framesToNotes } from './music.js?v=1.0.0';
self.onmessage = ({ data }) => {
  try {
    const { samples, duration } = data;
    const frames = [], hop = 256;
    for (let offset = 0; offset + 1024 < samples.length; offset += hop) {
      frames.push(detectPitch(samples, offset));
      if (frames.length % 100 === 0) self.postMessage({ progress: offset / samples.length });
    }
    self.postMessage({ notes: framesToNotes(frames, 8000, hop, duration), progress: 1 });
  } catch (error) { self.postMessage({ error: error.message }); }
};
