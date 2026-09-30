/* Nightdrive — weather: a slow director cycling clear/drizzle/rain/storm/mist,
 * light-catching rain in three depths, road splashes and ripple rings,
 * lightning with fractal bolts, and drifting ground mist. */
(function () {
  'use strict';
  const ND = window.ND;
  const { W, H, CX, Y, SPEED } = ND;

  // Tiny event bus (the soundtrack listens to lightning, weather changes...)
  const handlers = {};
  ND.bus = {
    on(ev, fn) { (handlers[ev] = handlers[ev] || []).push(fn); },
    emit(ev, data) { (handlers[ev] || []).forEach((fn) => { try { fn(data); } catch (e) { console.error(e); } }); },
  };

  // ---------------------------------------------------------------------------
  // Director
  // ---------------------------------------------------------------------------
  const PHASES = {
    clear: { rain: 0, storm: 0, fog: 0.12, cloud: 0.22, dur: [70, 150] },
    drizzle: { rain: 0.3, storm: 0, fog: 0.24, cloud: 0.55, dur: [45, 90] },
    rain: { rain: 0.68, storm: 0, fog: 0.3, cloud: 0.8, dur: [60, 130] },
    storm: { rain: 1.0, storm: 1, fog: 0.36, cloud: 1.0, dur: [50, 100] },
    mist: { rain: 0.04, storm: 0, fog: 0.62, cloud: 0.45, dur: [40, 75] },
  };
  const ORDER = ['clear', 'drizzle', 'rain', 'storm', 'mist'];

  class Weather {
    constructor(seed, lock) {
      this.r = ND.rng(seed);
      this.lock = lock && PHASES[lock] ? lock : null;
      this.v = { rain: 0, storm: 0, fog: 0.12, cloud: 0.22 };
      this.queue = [];
      this.flash = 0;
      this.bolt = null;
      this.boost = 0;
      if (this.lock) {
        this.setPhase(this.lock, Infinity);
        Object.assign(this.v, PHASES[this.lock]);
      } else {
        this.setPhase('clear', this.r.range(35, 55)); // open on the reference look: wet, just after rain
      }
    }
    plan() {
      const r = this.r;
      const q = ['drizzle', 'rain'];
      if (r() < 0.65) q.push('storm', 'rain');
      q.push('drizzle');
      if (r() < 0.6) q.push('mist');
      q.push('clear');
      this.queue.push(...q);
    }
    setPhase(name, secs) {
      this.phase = name;
      this.target = PHASES[name];
      const d = this.target.dur;
      this.left = (secs != null ? secs : this.r.range(d[0], d[1])) * 60;
      ND.bus.emit('weather', { phase: name });
    }
    next() {
      if (!this.queue.length) this.plan();
      this.setPhase(this.queue.shift());
    }
    // Manual override (W key): jump to the next phase in a fixed order.
    cycle() {
      const i = ORDER.indexOf(this.phase);
      this.queue.length = 0;
      this.setPhase(ORDER[(i + 1) % ORDER.length], this.lock ? Infinity : undefined);
      if (this.lock) this.lock = this.phase;
    }
    update() {
      if (!this.lock && !this.hold && --this.left <= 0) this.next(); // held clear during the opening scene
      const k = 1 / (60 * 7);
      for (const key of ['rain', 'storm', 'fog', 'cloud']) this.v[key] += (this.target[key] - this.v[key]) * k;
      // lightning
      if (!this.bolt && this.v.storm > 0.35 && this.r() < 0.004 * this.v.storm) this.strike();
      if (this.bolt) {
        const b = this.bolt;
        b.t++;
        this.flash = (b.pattern[b.t] || 0) * b.intensity;
        if (b.t >= b.pattern.length) this.bolt = null;
      } else this.flash = 0;
      this.boost = Math.max(0, this.boost - 1 / 45);
    }
    strike() {
      const r = this.r;
      const intensity = r.range(0.45, 1);
      const pattern = [];
      const n = r.int(2, 4);
      for (let i = 0; i < n; i++) {
        const peak = i === 0 ? 1 : r.range(0.4, 0.95);
        pattern.push(peak, peak * 0.9, peak * 0.35);
        const gap = r.int(1, 4);
        for (let g = 0; g < gap; g++) pattern.push(r.range(0.02, 0.12));
      }
      for (let i = 0; i < 16; i++) pattern.push(0.25 * Math.pow(0.78, i));
      const x = r.int(30, W - 110);
      const showBolt = r() < 0.7;
      this.bolt = { t: 0, pattern, intensity, x, img: showBolt ? genBolt(r.int(1, 1e9)) : null };
      this.boost = 1;
      ND.bus.emit('lightning', { intensity, x, near: intensity > 0.8 });
    }
  }

  // Fractal lightning bolt sprite (colour + glow).
  function genBolt(seed) {
    const r = ND.rng(seed);
    const w = 90, h = 170;
    const pb = new ND.PB(w, h), gl = new ND.PB(w, h);
    const seg = (x0, y0, x1, y1, d, width) => {
      if (d <= 0 || Math.hypot(x1 - x0, y1 - y0) < 4) {
        pb.lineFn(x0, y0, x1, y1, (x, y) => {
          pb.set(x, y, ND.pack(250, 246, 255));
          if (width > 1) pb.set(x + 1, y, ND.pack(210, 200, 255));
          gl.set(x, y, ND.pack(220, 210, 255));
          gl.set(x - 1, y, ND.pack(120, 110, 220));
          gl.set(x + 1, y, ND.pack(120, 110, 220));
        });
        return;
      }
      const mx = (x0 + x1) / 2 + r.range(-1, 1) * Math.abs(y1 - y0) * 0.28;
      const my = (y0 + y1) / 2 + r.range(-2, 2);
      seg(x0, y0, mx, my, d - 1, width);
      seg(mx, my, x1, y1, d - 1, width);
      if (d > 2 && r() < 0.28) {
        const bx = mx + r.range(-30, 30), by = my + r.range(15, 45);
        seg(mx, my, ND.clamp(bx, 2, w - 3), Math.min(h - 2, by), d - 2, 1);
      }
    };
    seg(w / 2 + r.range(-10, 10), 0, w / 2 + r.range(-25, 25), r.range(120, h - 4), 6, 2);
    return ND.sprite(pb, gl);
  }

  // ---------------------------------------------------------------------------
  // Rain: three depth layers of motion-blurred streaks. Rain falls straight in
  // the world, so our leftward motion slants it by each layer's parallax.
  // ---------------------------------------------------------------------------
  // Far and mid rain are scrolling, seamlessly tiling sheets (3 densities
  // each, stacked as the rain gets heavier) that end where they reach the
  // ground; near rain is individual drops that splash where they land.
  // The impact layer falls at the car's depth: its drops land on the road
  // around the car at their own depth, or burst on the car itself.
  const LAYERS = [
    { f: 0.3, sheet: 110, len: 5, fall: 7, a: 0.5, ground: 232 },
    { f: 0.8, sheet: 70, len: 10, fall: 11, a: 0.7, ground: 262 },
    { f: 1.7, max: 70, len: 19, fall: 17, a: 0.95, floor: [318, 372], splash: true },
    { f: 1, max: 130, len: 12, fall: 14, a: 0.85, impact: true },
  ];

  function rainSheet(seed, n, dx, dy, len) {
    const r = ND.rng(seed);
    const pb = new ND.PB(W, H);
    const nrm = Math.hypot(dx, dy), ux = dx / nrm, uy = dy / nrm;
    for (let i = 0; i < n; i++) {
      const x0 = r() * W, y0 = r() * H, L = len + r.int(-2, 2);
      for (let k = 0; k <= L; k++) {
        const t = k / L;
        const x = ((Math.round(x0 + ux * k) % W) + W) % W, y = ((Math.round(y0 + uy * k) % H) + H) % H;
        pb.set(x, y, ND.pack(255, 255, 255, (0.15 + 0.85 * t) * 255));
      }
    }
    return pb.canvas();
  }

  function streakSprite(dx, dy, len) {
    const n = Math.hypot(dx, dy);
    const ux = dx / n, uy = dy / n;
    const ex = ux * len, ey = uy * len;
    const w = Math.ceil(Math.abs(ex)) + 2, h = Math.ceil(ey) + 2;
    const pb = new ND.PB(w, h);
    const x0 = ex < 0 ? w - 1 : 0;
    pb.lineFn(x0, 0, x0 + ex, ey, (x, y, t) => {
      const a = 0.15 + 0.85 * t;
      pb.set(x, y, ND.pack(255, 255, 255, a * 255));
    });
    return { c: pb.canvas(), ox: x0 + ex, oy: ey };
  }

  class Rain {
    constructor(seed) {
      this.r = ND.rng(seed);
      this.layers = LAYERS.map((L, li) => {
        const vx = L.f * SPEED;
        return {
          ...L,
          vx,
          vy: L.fall,
          sprites: [streakSprite(vx, L.fall, L.len), streakSprite(vx, L.fall, L.len - 2), streakSprite(vx, L.fall, L.len + 2)],
          bySpeed: {}, // streaks slanted for other speeds, made as needed
          ox: 0,
          sheets: L.sheet ? [0, 1, 2].map((k) => rainSheet(seed * 7 + li * 31 + k, L.sheet, vx, L.fall, L.len)) : null,
          p: [],
        };
      });
      this.splashes = [];
      this.carHits = [];
    }
    spawn(L, top) {
      const r = this.r;
      const p = { f: L.f, y: top ? r.range(-40, -2) : r.range(-40, H), s: r.int(0, 2) };
      if (L.impact) {
        p.f = r() < 0.5 ? 1 : r.range(0.86, 1.45); // f = 1: the car's own depth
        p.floor = ND.yAt(p.f) + r.range(-1, 1);
      } else p.floor = r.range(L.floor[0], L.floor[1]);
      p.x = r.range(-((p.f * (this.speed ?? SPEED)) / L.vy) * H - 20, W + 10);
      return p;
    }
    // Droplets thrown up when a drop bursts on the car: [vx, vy] per droplet.
    bounce() {
      const r = this.r;
      return [[r.range(-1.4, -0.3), -r.range(0.7, 1.6)], [r.range(0.3, 1.4), -r.range(0.6, 1.4)], [r.range(-0.4, 0.4), -r.range(1, 1.9)]];
    }
    // A drop hits the ground: a crown, droplets thrown up, and a ripple ring.
    splash(x, y, f, big) {
      const r = this.r, drops = [];
      for (let i = 0, n = big ? 3 : r.int(1, 3); i < n; i++) drops.push([r.range(-1.2, 1.2) * (big ? 1.5 : 1), -r.range(0.7, 1.7) * (big ? 1.4 : 1)]);
      this.splashes.push({ P: this.D - (x - CX) / f, y, f, age: 0, life: r.int(12, 20), crown: true, big, drops });
    }
    update(w, D, hero, speed = SPEED) {
      const rain = w.v.rain, r = this.r;
      this.D = D;
      this.speed = speed;
      // our motion slants the rain: the streaks match the current speed
      const key = Math.round(speed * 2) / 2;
      for (const L of this.layers) {
        L.ox = (L.ox + L.f * speed) % W;
        if (L.sheets) continue;
        const vx = L.f * key;
        L.cur = L.bySpeed[key] || (L.bySpeed[key] = [streakSprite(vx, L.fall, L.len), streakSprite(vx, L.fall, L.len - 2), streakSprite(vx, L.fall, L.len + 2)]);
      }
      // age what's already splashing, so this tick's new splashes show from their first frame
      for (const s of this.splashes) s.age++;
      this.splashes = this.splashes.filter((s) => s.age < s.life);
      for (const h of this.carHits) h.age++;
      this.carHits = this.carHits.filter((h) => h.age < 9);
      // where the car's body is, to land drops on it
      const hx = hero ? hero.x + (hero.dx || 0) : 0;
      const carTop = (x) => {
        const lx = x - hx;
        return hero && lx > 2 && lx < ND.HERO.W - 3 ? hero.y + ND.HERO.topY(lx) + hero.bob : null;
      };
      for (const L of this.layers) {
        if (L.sheets) continue;
        const want = Math.floor(L.max * rain);
        while (L.p.length < want) L.p.push(this.spawn(L, false));
        for (let i = L.p.length - 1; i >= 0; i--) {
          const p = L.p[i];
          p.x += p.f * speed;
          p.y += L.vy;
          let floor = p.floor, car = false;
          if (L.impact && p.f === 1) {
            const top = carTop(p.x);
            if (top != null && top < floor) { floor = top; car = true; }
          }
          if (p.y > floor) {
            if (car) this.carHits.push({ lx: p.x - hx, age: 0, drops: this.bounce() });
            else if (L.splash || L.impact) this.splash(p.x, floor, p.f, !!L.splash);
            if (L.p.length > want) { L.p.splice(i, 1); continue; }
            Object.assign(p, this.spawn(L, true));
          }
        }
      }
      // the far lane and the sidewalk, where the rain sheets land
      const n = rain * 3;
      for (let k = 0; k < Math.floor(n) + (r() < n % 1 ? 1 : 0); k++) {
        const y = r() < 0.4 ? r.int(Y.BUILD + 3, Y.CURB - 1) : r.int(Y.CURB + 4, 268);
        this.splash(r.range(-10, W + 10), y, ND.fAt(y), false);
      }
      // more drops on the car than the impact layer alone brings
      const m = rain * 1.8;
      for (let k = 0; k < Math.floor(m) + (r() < m % 1 ? 1 : 0); k++) this.carHits.push({ lx: r.range(4, ND.HERO.W - 5), age: 0, drops: this.bounce() });
    }
  }

  // Ripple rings (perspective-flattened ellipses) and splash crowns.
  function genRings() {
    const rings = [];
    for (let rad = 1; rad <= 9; rad++) {
      const ry = Math.max(0.8, rad * 0.32);
      const w = rad * 2 + 3, h = Math.ceil(ry * 2) + 3;
      const pb = new ND.PB(w, h);
      const cx = w / 2 - 0.5, cy = h / 2 - 0.5;
      for (let a = 0; a < Math.PI * 2; a += 0.05) {
        const x = Math.round(cx + Math.cos(a) * rad), y = Math.round(cy + Math.sin(a) * ry);
        pb.set(x, y, ND.pack(255, 255, 255, Math.sin(a) < 0 ? 150 : 255));
      }
      rings.push(pb.canvas());
    }
    const sprite = (rows) => {
      const pb = new ND.PB(rows[0].length, rows.length);
      rows.forEach((row, y) => [...row].forEach((ch, x) => ch === '#' && pb.set(x, y, ND.pack(255, 255, 255))));
      return pb.canvas();
    };
    const crowns = [['.#.#.', '#...#'], ['#.#.#', '.....'], ['..#..', '.#.#.']].map(sprite);
    // close to the camera the crowns are bigger
    const bigCrowns = [['...#...', '.#...#.', '#..#..#'], ['.#.#.#.', '#.....#', '.......'], ['#..#..#', '.#...#.', '.......']].map(sprite);
    return { rings, crowns, bigCrowns };
  }

  // Tileable drifting mist band.
  function genMist(seed, T, h, color, strength) {
    const pb = new ND.PB(T, h);
    for (let y = 0; y < h; y++) {
      const vy = Math.sin((y / (h - 1)) * Math.PI);
      for (let x = 0; x < T; x++) {
        const k = x / T;
        const n = ND.fbm(x / 90, y / 14, 4, seed) * (1 - k) + ND.fbm((x - T) / 90, y / 14, 4, seed) * k;
        let a = ND.clamp((n - 0.35) * 2.2, 0, 1) * vy * strength;
        a = Math.floor(a * 10 + ND.bayer(x, y)) / 10;
        if (a > 0) pb.set(x, y, ND.pack(color[0], color[1], color[2], a * 255));
      }
    }
    return pb.canvas();
  }

  // Heavy overcast rolling over the upper sky during storms.
  function genOvercast(seed) {
    const T = 1024, h = 150;
    const pb = new ND.PB(T, h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < T; x++) {
        const k = x / T;
        const n = ND.fbm(x / 60, y / 16, 5, seed) * (1 - k) + ND.fbm((x - T) / 60, y / 16, 5, seed) * k;
        const fall = 1 - Math.pow(y / h, 2.2);
        let a = ND.clamp((n - 0.3) * 2.4, 0, 1) * fall;
        a = Math.floor(a * 8 + ND.bayer(x, y)) / 8;
        if (a <= 0) continue;
        const lit = ND.fbm(x / 60, (y - 3) / 16, 5, seed) < n - 0.03;
        const c = lit ? [48, 38, 86] : [22, 17, 46];
        pb.set(x, y, ND.pack(c[0], c[1], c[2], a * 245));
      }
    return pb.canvas();
  }

  ND.Weather = Weather;
  ND.Rain = Rain;
  ND.genRings = genRings;
  ND.genMist = genMist;
  ND.genOvercast = genOvercast;
})();
