const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const SoundManager = require('../js/merge/sound');
function platform() {
  const contexts = [];
  return { contexts, createInnerAudioContext: () => { const audio = { played: 0, stopped: 0, seek: value => { audio.offset = value; }, stop: () => audio.stopped++, play: () => audio.played++, onError: callback => { audio.error = callback; } }; contexts.push(audio); return audio; } };
}
test('effects use local files, replay from the start, and pool voices for rapid input', () => {
  const wx = platform(), sound = new SoundManager(wx); sound.play('merge'); sound.play('merge'); sound.play('merge');
  assert.equal(wx.contexts.length, 2); assert.equal(wx.contexts[0].played, 2); assert.equal(wx.contexts[1].played, 1);
  assert(wx.contexts.every(audio => audio.src === 'sounds/merge.wav' && audio.offset === 0 && audio.obeyMuteSwitch));
});
test('muting stops active sounds and prevents new playback until enabled', () => {
  const wx = platform(), sound = new SoundManager(wx); sound.play('spawn'); sound.setEnabled(false);
  const played = wx.contexts.reduce((sum, audio) => sum + audio.played, 0); sound.play('spawn'); sound.play('order');
  assert.equal(wx.contexts.reduce((sum, audio) => sum + audio.played, 0), played); assert.equal(wx.contexts.length, 2);
  sound.setEnabled(true); sound.play('order'); assert.equal(wx.contexts.length, 4);
});
test('unavailable or failing audio is nonfatal', () => {
  assert.doesNotThrow(() => new SoundManager({}).play('merge'));
  assert.doesNotThrow(() => new SoundManager({ createInnerAudioContext() { throw new Error('unavailable'); } }).play('merge'));
});
test('all seven shipped WAVs contain valid mono PCM, nonzero samples and no clipping', () => {
  for (const name of ['spawn', 'move', 'merge', 'combo', 'order', 'chapter', 'error']) {
    const wav = fs.readFileSync(path.resolve(__dirname, '../sounds', name + '.wav'));
    assert.equal(wav.toString('ascii', 0, 4), 'RIFF'); assert.equal(wav.toString('ascii', 8, 12), 'WAVE');
    assert.equal(wav.readUInt16LE(20), 1); assert.equal(wav.readUInt16LE(22), 1); assert.equal(wav.readUInt32LE(24), 22050);
    assert.equal(wav.readUInt32LE(40), wav.length - 44); let peak = 0;
    for (let offset = 44; offset < wav.length; offset += 2) peak = Math.max(peak, Math.abs(wav.readInt16LE(offset)));
    assert(peak > 0 && peak < 32767); assert(wav.length / 44100 < 1);
  }
});
test('merge and combo are brief, softly enveloped and quieter than delivery effects', () => {
  function measure(name) {
    const wav = fs.readFileSync(path.resolve(__dirname, '../sounds', name + '.wav')); let peak = 0;
    for (let offset = 44; offset < wav.length; offset += 2) peak = Math.max(peak, Math.abs(wav.readInt16LE(offset)));
    return { duration: (wav.length - 44) / 44100, peak };
  }
  const merge = measure('merge'), combo = measure('combo'), order = measure('order');
  assert(merge.duration <= 0.17); assert(combo.duration <= 0.22);
  assert(merge.peak < order.peak * 0.6); assert(combo.peak < order.peak * 0.6);
});
