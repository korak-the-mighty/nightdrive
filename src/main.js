/* Nightdrive — boot, fixed-step main loop and pixel-perfect presentation. */
(function () {
  'use strict';
  const ND = window.ND;
  const { W, H } = ND;

  const params = new URLSearchParams(location.search);
  const seed = parseInt(params.get('seed') || '1985', 10);
  const debug = params.has('debug');

  const screen = document.getElementById('screen');
  const sctx = screen.getContext('2d', { alpha: false });
  const hud = document.getElementById('hud');
  const stats = document.getElementById('stats');

  let world, renderer, music, recorder, radio;
  let paused = params.has('paused');

  // phones and tablets get touch controls
  const touch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  if (touch) document.body.classList.add('touch');
  ND.touch = touch;
  ND.muted = params.has('mute');
  // the opening scene (skip it with ?intro=0)
  const introOn = params.get('intro') !== '0';

  // --- presentation: exact integer scale where possible, otherwise nearest
  // upscale to the next integer and a smooth downscale ("sharp bilinear").
  // A phone held sideways is wider than 16:9: there the picture fills the
  // screen, cropping a strip off the top and bottom instead of boxing it in.
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const cw = window.innerWidth * dpr, ch = window.innerHeight * dpr;
    const fill = touch && cw / ch > W / H + 0.01;
    const s = fill ? cw / W : Math.min(cw / W, ch / H);
    if (renderer) renderer.cropY = fill ? Math.ceil((H * s - ch) / 2 / s) : 0;
    document.body.classList.toggle('portrait', touch && ch > cw);
    const exact = Math.abs(s - Math.round(s)) < 0.01 && Math.round(s) >= 1;
    const k = exact ? Math.round(s) : Math.max(1, Math.ceil(s));
    screen.width = W * k;
    screen.height = H * k;
    const cssW = (W * (exact ? k : s)) / dpr, cssH = (H * (exact ? k : s)) / dpr;
    screen.style.width = cssW + 'px';
    screen.style.height = cssH + 'px';
    screen.style.imageRendering = exact ? 'pixelated' : 'auto';
    sctx.imageSmoothingEnabled = false;
  }

  function present() {
    sctx.imageSmoothingEnabled = false;
    sctx.drawImage(renderer.scene, 0, 0, screen.width, screen.height);
    if (recorder && recorder.active) recorder.frame(renderer.scene);
  }

  // --- fixed 60 Hz simulation; dt snapped to the refresh interval to avoid
  // judder from timer noise.
  const STEP = 1000 / 60;
  let last = 0, acc = 0;
  let frames = 0, fpsT = 0, fps = 0, worst = 0, renderMs = 0;
  // performance bookkeeping (also drives adaptive quality)
  const perf = (ND.perf = { frames: 0, steps: [0, 0, 0, 0, 0, 0, 0], renderMax: 0, renderSum: 0, drops: 0, quality: 2 });
  let win = 0, winDrops = 0, winRender = 0;
  const forcedQ = params.get('q');

  function frame(now) {
    requestAnimationFrame(frame);
    if (!last) last = now;
    let dt = now - last;
    last = now;
    if (dt > 250) dt = STEP;
    const k = Math.round(dt / STEP);
    if (k >= 1 && Math.abs(dt - k * STEP) < 2.2) dt = k * STEP;
    if (!paused) acc += dt;
    let steps = 0;
    while (acc >= STEP - 0.01 && steps < 6) {
      world.update();
      acc -= STEP;
      steps++;
    }
    if (steps >= 6) acc = 0;
    if (steps > 0) {
      const t0 = performance.now();
      renderer.render();
      present();
      renderMs = performance.now() - t0;
      worst = Math.max(worst, renderMs);
    }
    if (!paused) {
      perf.frames++;
      perf.steps[Math.min(6, steps)]++;
      perf.renderMax = Math.max(perf.renderMax, renderMs);
      perf.renderSum += renderMs;
      if (k >= 2 && k < 10) { perf.drops++; winDrops++; }
      win++;
      winRender += renderMs;
      // adaptive quality: step detail down if this machine keeps missing frames
      if (win >= 180) {
        if (forcedQ == null && renderer.q > 0 && (winDrops > 18 || winRender / win > 11)) {
          renderer.q--;
          perf.quality = renderer.q;
          console.log('Nightdrive: quality ->', renderer.q);
        }
        win = winDrops = winRender = 0;
      }
    }
    if (world.pedal) showSpeed();
    // background generation of upcoming buildings, within the frame budget
    world.work(Math.max(1, 9 - renderMs));
    frames++;
    if (now - fpsT > 1000) {
      fps = (frames * 1000) / (now - fpsT);
      frames = 0;
      fpsT = now;
      if (debug) stats.textContent = `${fps.toFixed(0)} fps · render ${renderMs.toFixed(1)}ms · worst ${worst.toFixed(1)}ms · jobs ${world.jobs.jobs.length}`;
      worst = 0;
    }
  }

  // --- UI
  const toastEl = document.getElementById('toast');
  let toastTimer = 0;
  function toast(text) {
    toastEl.textContent = text;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1600);
  }
  let hudTimer = 0;
  function showHud() {
    document.body.classList.remove('idle');
    clearTimeout(hudTimer);
    hudTimer = setTimeout(() => document.body.classList.add('idle'), 2500);
  }
  function toggleFullscreen() {
    const el = document.documentElement;
    try {
      let p;
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        const fn = el.requestFullscreen || el.webkitRequestFullscreen;
        if (fn) p = fn.call(el);
      } else {
        const fn = document.exitFullscreen || document.webkitExitFullscreen;
        if (fn) p = fn.call(document);
      }
      if (p && p.catch) p.catch(() => {});
    } catch (e) { /* fullscreen not allowed here */ }
  }
  // --- actions, shared by the keyboard and the touch controls
  const ACTIONS = {
    fullscreen: () => toggleFullscreen(),
    pause: () => { paused = !paused; toast(paused ? 'paused' : 'playing'); },
    hints: () => document.body.classList.toggle('nohud'),
    stats: () => stats.classList.toggle('show'),
    weather: () => { world.weather.cycle(); toast(world.weather.phase); },
    letterbox: () => { renderer.letterOn = !renderer.letterOn; toast(renderer.letterOn ? 'letterbox on' : 'letterbox off'); },
    grain: () => { renderer.grainOn = !renderer.grainOn; toast(renderer.grainOn ? 'grain on' : 'grain off'); },
    music: () => { const on = music.toggle(); soundHint(false); toast(on ? 'music on' : 'music off'); },
    next: () => { if (!music.ctx) music.start(); music.skip(); soundHint(false); toast('next track'); },
    driver: () => { music.chatter = !music.chatter; toast(music.chatter ? 'driver talk on' : 'driver talk off'); },
    titles: () => { renderer.titlesOn = !renderer.titlesOn; toast(renderer.titlesOn ? 'track titles on' : 'track titles off'); },
    record: () => toggleRecording(),
  };
  const KEYS = { f: 'fullscreen', ' ': 'pause', h: 'hints', d: 'stats', w: 'weather', l: 'letterbox', g: 'grain', m: 'music', n: 'next', v: 'driver', t: 'titles', r: 'record' };

  // the speed pedal: hold up to accelerate, down to brake; let go to hold the speed
  let mphShown = 0;
  const speedText = () => (world.speedTarget <= 0.05 ? 'stopped' : world.mph + ' mph');
  function showSpeed() {
    const now = performance.now();
    if (now - mphShown > 200) { toast(speedText()); mphShown = now; }
  }
  // the opening scene: START sends him into the car
  const lobby = () => world && world.intro && world.intro.lobby;
  function launch() {
    startSound();
    world.intro.start(music);
  }
  function pedal(v) {
    if (world && world.intro && world.intro.active) { if (v > 0 && lobby()) launch(); return; } // no pedal until we roll
    world.pedal = v;
    startSound();
    showSpeed();
    showHud();
  }
  function pedalUp(v) {
    if (world.pedal !== v) return;
    world.pedal = 0;
    toast(speedText());
  }
  window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowUp') pedalUp(1);
    if (e.key === 'ArrowDown') pedalUp(-1);
  });
  window.addEventListener('keydown', (e) => {
    // browser shortcuts (⌘R / Ctrl+R reload, ⌘L, ⌘M…) are the browser's, not ours:
    // ⌘R used to start a recording and flash the save dialog as the page reloaded
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (lobby() && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      launch();
      return;
    }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      pedal(e.key === 'ArrowUp' ? 1 : -1);
      return;
    }
    // the car stereo: left and right change station
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      startSound();
      if (radio && !(world.intro && world.intro.active)) radio.step(e.key === 'ArrowRight' ? 1 : -1);
      showHud();
      return;
    }
    const act = KEYS[e.key.length === 1 ? e.key.toLowerCase() : ''];
    if (act) {
      if (e.key === ' ') e.preventDefault();
      if (!e.repeat) ACTIONS[act](); // holding a key doesn't flip a toggle back and forth
    } else startSound();
    showHud();
  });
  window.addEventListener('pointerdown', (e) => {
    // in the opening scene, the START button in the picture launches; anywhere else just turns the sound on
    if (lobby() && e.target === screen) {
      const b = screen.getBoundingClientRect();
      if (world.intro.hits(((e.clientX - b.left) / b.width) * W, ((e.clientY - b.top) / b.height) * H)) { launch(); showHud(); return; }
    }
    startSound();
    showHud();
  });

  // --- touch controls: hold-to-press pedals, and a menu for everything else
  const menu = document.getElementById('menu');
  const holdPedal = (el, v) => {
    const up = () => { el.classList.remove('on'); pedalUp(v); };
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* keep the press even without capture */ }
      el.classList.add('on');
      pedal(v);
    });
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(ev, up);
  };
  if (menu) {
    holdPedal(document.getElementById('gas'), 1);
    holdPedal(document.getElementById('brake'), -1);
    document.getElementById('menuBtn').addEventListener('click', () => menu.classList.toggle('open'));
    menu.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-act]');
      if (!b) return;
      ACTIONS[b.dataset.act]();
      if (b.dataset.act !== 'pause') menu.classList.remove('open');
    });
    // offer only what this browser can do
    if (!(document.fullscreenEnabled || document.webkitFullscreenEnabled)) menu.querySelector('[data-act="fullscreen"]').remove();
  }

  // --- sound starts with the first click / key press (browser autoplay rules)
  const hintEl = document.getElementById('soundhint');
  function soundHint(show) { if (hintEl) hintEl.classList.toggle('show', !!show); }
  function startSound() {
    if (!music || music.ctx || params.has('mute')) return;
    music.start();
    soundHint(false);
  }

  // --- recording
  const recEl = document.getElementById('rec');
  let recTimer = 0;
  async function toggleRecording() {
    if (!recorder) return;
    if (window.ND_PREVIEW) { toast('record from dist/nightdrive.html on your computer'); return; }
    if (recorder.active) {
      recorder.stop();
      recEl.classList.remove('show');
      clearInterval(recTimer);
      return;
    }
    startSound();
    try {
      const ok = await recorder.start(music, renderer.scene);
      if (!ok) return;
      recEl.classList.add('show');
      recTimer = setInterval(() => {
        const s = Math.floor(recorder.elapsed);
        recEl.textContent = `REC ${String(Math.floor(s / 3600)).padStart(1, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
      }, 250);
    } catch (e) {
      toast(e.message || 'recording failed');
    }
  }
  window.addEventListener('mousemove', showHud);
  screen.addEventListener('dblclick', toggleFullscreen);
  window.addEventListener('resize', resize);

  function boot() {
    const t0 = performance.now();
    world = new ND.World(seed, { weather: params.get('weather'), intro: introOn });
    renderer = new ND.Renderer(world, { quality: params.get('q') != null ? +params.get('q') : undefined });
    ND.world = world;
    ND.renderer = renderer;
    // a fresh soundtrack every visit (so the first style is random too),
    // unless ?seed asks for a particular one
    const musicSeed = params.has('seed') ? seed : Math.floor(Math.random() * 1e9);
    music = ND.music = new ND.Music(musicSeed, { style: params.get('style'), lobby: !!world.intro });
    if (world.intro) {
      document.body.classList.add('intro');
      ND.bus.on('intro-done', () => document.body.classList.remove('intro'));
    }
    recorder = new ND.Recorder(params.get('rec') === '4k' ? 6 : params.get('rec') === '1440p' ? 4 : 3);
    recorder.onsaved = (name, streamed) => toast(streamed ? 'saved ' + name : 'downloading ' + name);
    // big moments: a drop during a storm brings the lightning with it
    ND.bus.on('drop', () => {
      const wx = world.weather;
      if (wx.v.storm > 0.5 && !wx.bolt) wx.strike();
    });
    if (menu && (window.ND_PREVIEW || !recorder.supported())) menu.querySelector('[data-act="record"]').remove();
    if (touch && hintEl) hintEl.textContent = 'TAP FOR SOUND';
    soundHint(!params.has('mute') && !world.intro);
    resize();
    if (ND.Radio) radio = new ND.Radio({ music, screen, power: () => ACTIONS.music(), toast });
    renderer.render();
    present();
    document.body.classList.add('ready');
    if (debug) stats.classList.add('show');
    console.log(`Nightdrive ready in ${(performance.now() - t0).toFixed(0)} ms`);
    showHud();
    requestAnimationFrame(frame);
  }

  // Let the loading text paint before the (synchronous) world build.
  requestAnimationFrame(() => setTimeout(boot, 30));
})();
