// Short local PCM sound effects; no network requests and no background music.
const FILES = { spawn: 'spawn', move: 'move', merge: 'merge', combo: 'combo', order: 'order', chapter: 'chapter', error: 'error' };
class SoundManager {
  constructor(platform, enabled = true) {
    this.platform = platform; this.enabled = enabled; this.pools = {}; this.failed = new Set();
  }
  setEnabled(enabled) { this.enabled = enabled; if (!enabled) this.stopAll(); }
  play(name) {
    if (!this.enabled || !FILES[name] || !this.platform.createInnerAudioContext) return;
    try {
      if (!this.pools[name]) {
        const voices = Array.from({ length: 2 }, () => {
          const audio = this.platform.createInnerAudioContext();
          audio.autoplay = false; audio.loop = false; audio.obeyMuteSwitch = true; audio.volume = 0.5;
          if (audio.onError) audio.onError(() => {
            if (!this.failed.has(name)) { this.failed.add(name); console.warn('音效暂不可用:', name); }
          });
          audio.src = 'sounds/' + FILES[name] + '.wav';
          return audio;
        });
        this.pools[name] = { voices, cursor: 0 };
      }
      const pool = this.pools[name], audio = pool.voices[pool.cursor++ % pool.voices.length];
      audio.stop(); audio.seek(0); audio.play();
    } catch (_) { /* A missing audio capability must never interrupt a game action. */ }
  }
  stopAll() {
    Object.keys(this.pools).forEach(key => this.pools[key].voices.forEach(audio => { try { audio.stop(); } catch (_) {} }));
  }
}
module.exports = SoundManager;
