// Development-only adapter. The browser loads the same modules used by WeChat.
(function () {
  const cache = {};
  function load(path) {
    path = new URL(path, location.origin).pathname;
    if (!path.endsWith('.js')) path += '.js';
    if (cache[path]) return cache[path].exports;
    const xhr = new XMLHttpRequest(); xhr.open('GET', path, false); xhr.send();
    if (xhr.status !== 200) throw new Error('Module not found: ' + path);
    const module = { exports: {} }; cache[path] = module;
    const require = relative => load(new URL(relative, location.origin + path).pathname);
    new Function('require', 'module', 'exports', xhr.responseText + '\n//# sourceURL=' + path)(require, module, module.exports);
    return module.exports;
  }
  const params = new URLSearchParams(location.search), canvas = document.getElementById('game');
  const handlers = { start: [], move: [], end: [], cancel: [], show: [], hide: [], resize: [] };
  const emit = (kind, value) => handlers[kind].forEach(callback => callback(value));
  const wx = {
    createCanvas: () => canvas,
    createImage: () => new Image(),
    createInnerAudioContext: () => {
      const audio = new Audio();
      const context = {
        play: () => { window.previewAudioPlays.push(audio.src.split('/').pop()); const promise = audio.play(); if (promise) promise.catch(() => {}); },
        stop: () => { audio.pause(); audio.currentTime = 0; },
        seek: seconds => { audio.currentTime = seconds; },
        onError: callback => audio.addEventListener('error', callback),
      };
      ['src', 'volume', 'loop', 'autoplay'].forEach(key => Object.defineProperty(context, key, { get: () => audio[key], set: value => { audio[key] = value; } }));
      return context;
    },
    getWindowInfo: () => ({ windowWidth: innerWidth, windowHeight: innerHeight, screenWidth: innerWidth, screenHeight: innerHeight, pixelRatio: devicePixelRatio, safeArea: { top: Number(params.get('safeTop') || 0), bottom: innerHeight - Number(params.get('safeBottom') || 0) } }),
    getMenuButtonBoundingClientRect: () => params.has('capsule') ? ({ top: 50, bottom: 82, left: innerWidth - 98, right: innerWidth - 10, width: 88, height: 32 }) : null,
    getStorageSync: key => { const value = localStorage.getItem(key); return value ? JSON.parse(value) : null; },
    setStorageSync: (key, value) => localStorage.setItem(key, JSON.stringify(value)),
    showModal: options => options.success({ confirm: confirm(options.title + '\n\n' + options.content), cancel: false }),
    onTouchStart: callback => handlers.start.push(callback), onTouchMove: callback => handlers.move.push(callback),
    onTouchEnd: callback => handlers.end.push(callback), onTouchCancel: callback => handlers.cancel.push(callback),
    onShow: callback => handlers.show.push(callback), onHide: callback => handlers.hide.push(callback),
    onWindowResize: callback => handlers.resize.push(callback),
  };
  let pointer = null;
  const eventFor = event => ({ touches: [{ clientX: event.clientX, clientY: event.clientY }], changedTouches: [{ clientX: event.clientX, clientY: event.clientY }] });
  canvas.addEventListener('pointerdown', event => { if (pointer !== null) return; pointer = event.pointerId; canvas.setPointerCapture(pointer); emit('start', eventFor(event)); });
  canvas.addEventListener('pointermove', event => { if (event.pointerId === pointer) emit('move', eventFor(event)); });
  canvas.addEventListener('pointerup', event => { if (event.pointerId === pointer) { pointer = null; emit('end', eventFor(event)); } });
  canvas.addEventListener('pointercancel', () => { pointer = null; emit('cancel', {}); });
  addEventListener('resize', () => emit('resize', {}));
  document.addEventListener('visibilitychange', () => emit(document.hidden ? 'hide' : 'show', {}));
  window.previewWx = wx;
  window.previewAudioPlays = [];
  window.mergeGame = new (load('/js/merge/game'))(wx);
})();
