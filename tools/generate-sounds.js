// Reproducible, original synth effects. Run with Node; no external dependencies.
const fs = require('node:fs');
const path = require('node:path');
const rate = 22050;
const effects = {
  spawn: [[0, 0.14, 440, 0.3, 'drop']],
  move: [[0, 0.07, 680, 0.18, 'drop']],
  merge: [[0, 0.14, 659.25, 0.12, 'soft'], [0.035, 0.10, 783.99, 0.08, 'soft']],
  combo: [[0, 0.12, 659.25, 0.10, 'soft'], [0.035, 0.13, 783.99, 0.08, 'soft'], [0.075, 0.115, 1046.5, 0.06, 'soft']],
  order: [[0, 0.21, 783.99, 0.22], [0.08, 0.23, 1046.5, 0.2], [0.16, 0.32, 1318.51, 0.18]],
  chapter: [[0, 0.23, 523.25, 0.22], [0.09, 0.24, 659.25, 0.2], [0.18, 0.26, 783.99, 0.2], [0.3, 0.4, 1046.5, 0.21]],
  error: [[0, 0.12, 240, 0.14, 'drop'], [0.09, 0.13, 195, 0.12, 'drop']],
};
const output = path.resolve(__dirname, '../sounds'); fs.mkdirSync(output, { recursive: true });
for (const [name, notes] of Object.entries(effects)) {
  const duration = Math.max(...notes.map(note => note[0] + note[1])) + 0.02;
  const count = Math.ceil(duration * rate), pcm = Buffer.alloc(count * 2);
  for (let i = 0; i < count; i++) {
    const time = i / rate; let sample = 0;
    notes.forEach(([start, length, frequency, gain, type]) => {
      const t = time - start; if (t < 0 || t >= length) return;
      const envelope = Math.min(1, t / (type === 'soft' ? 0.012 : 0.005)) * Math.pow(1 - t / length, 2.3);
      const phase = 2 * Math.PI * frequency * (type === 'drop' ? (t - 0.25 * t * t / length) : t);
      sample += (Math.sin(phase) + (type === 'soft' ? 0.08 : 0.23) * Math.sin(2 * phase) + (type === 'soft' ? 0.02 : 0.06) * Math.sin(3 * phase)) * envelope * gain;
    });
    pcm.writeInt16LE(Math.round(Math.max(-0.8, Math.min(0.8, sample)) * 32767), i * 2);
  }
  const header = Buffer.alloc(44); header.write('RIFF', 0); header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVEfmt ', 8); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24); header.writeUInt32LE(rate * 2, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
  header.write('data', 36); header.writeUInt32LE(pcm.length, 40);
  fs.writeFileSync(path.join(output, name + '.wav'), Buffer.concat([header, pcm]));
  console.log(name + '.wav', duration.toFixed(2) + 's');
}
