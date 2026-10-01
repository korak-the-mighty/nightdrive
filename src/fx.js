/* Nightdrive — cinematic effects: volumetric lamp cones, headlight beams,
 * film grain, umbrellas, and night aircraft (planes, a searchlight helicopter
 * and a blimp with a scrolling LED sign). */
(function () {
  'use strict';
  const ND = window.ND;
  const { W, H, rgb } = ND;

  const dq = (a, x, y, levels = 12) => Math.floor(a * levels + ND.bayer(x, y)) / levels;

  // Downward light cone for street lamps (additive).
  function genCone(w, h, color) {
    const pb = new ND.PB(w, h);
    for (let y = 0; y < h; y++) {
      const t = y / (h - 1);
      const half = 2 + (w / 2 - 2) * Math.pow(t, 0.85);
      for (let x = 0; x < w; x++) {
        const dx = Math.abs(x - w / 2 + 0.5) / half;
        if (dx >= 1) continue;
        const a = dq((1 - dx * dx) * Math.pow(1 - t, 1.25) * (0.35 + 0.65 * Math.exp(-t * 3)), x, y);
        if (a > 0) pb.set(x, y, ND.pack(color[0] * a, color[1] * a, color[2] * a));
      }
    }
    return pb.canvas();
  }

  // Horizontal beam pointing left: apex on the right edge, centred vertically.
  function genBeam(len, spread, color, falloff = 1.1) {
    const h = spread * 2 + 1;
    const pb = new ND.PB(len, h);
    for (let x = 0; x < len; x++) {
      const t = (len - 1 - x) / (len - 1);
      const half = 1 + (spread - 1) * Math.pow(t, 0.8);
      for (let y = 0; y < h; y++) {
        const dy = Math.abs(y - spread) / half;
        if (dy >= 1) continue;
        const a = dq((1 - dy * dy) * Math.pow(1 - t, falloff), x, y);
        if (a > 0) pb.set(x, y, ND.pack(color[0] * a, color[1] * a, color[2] * a));
      }
    }
    return pb.canvas();
  }

  // Elongated pool of light on the road ahead of a car.
  function genGroundBeam(len, h, color) {
    const pb = new ND.PB(len, h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < len; x++) {
        const u = x / (len - 1); // 0 far ahead (left), 1 at the car
        const v = (y - h / 2 + 0.5) / (h / 2);
        const width = 0.35 + 0.65 * Math.sin(Math.min(1, u * 1.25) * Math.PI * 0.5);
        const d = Math.abs(v) / width;
        if (d >= 1) continue;
        const a = dq((1 - d * d) * Math.pow(u, 0.9) * (1 - Math.pow(u, 12)), x, y);
        if (a > 0) pb.set(x, y, ND.pack(color[0] * a, color[1] * a, color[2] * a));
      }
    return pb.canvas();
  }

  // Film grain frames: mid-grey noise for a soft-light blend, so it adds
  // texture to the mid-tones but leaves bright paint and deep blacks clean.
  function genGrain(n, seed) {
    const r = ND.rng(seed);
    const frames = [];
    for (let k = 0; k < n; k++) {
      const pb = new ND.PB(W, H);
      for (let i = 0; i < W * H; i++) {
        const v = 128 + ((r() + r() + r()) / 3 - 0.5) * 34;
        pb.d[i] = ND.pack(v, v, v);
      }
      frames.push(pb.canvas());
    }
    return frames;
  }

  // Umbrellas: dome + ribs + scalloped hem + J handle. 24x21, dome centre x=12.
  function genUmbrellas() {
    const cols = [rgb('#e02838'), rgb('#18121e'), rgb('#ff6ab0'), rgb('#2a3a80'), rgb('#ffc830'), rgb('#20c0c8'), rgb('#f0f0f8')];
    return cols.map((c, ci) => {
      const pb = new ND.PB(24, 21);
      const half = [3, 6, 8, 9, 10, 11, 11];
      for (let y = 0; y < 7; y++)
        for (let x = 12 - half[y]; x <= 11 + half[y]; x++) {
          const u = (x - 12 + half[y]) / (2 * half[y]);
          let k = 0.7 + 0.5 * (1 - u) - y * 0.03;
          if (y === 0) k += 0.2;
          if ((x - 12) % 5 === 0 && y > 1) k *= 0.8; // ribs
          const cc = ci === 6 ? ND.mix(c, [180, 170, 230], 0.3) : c;
          pb.set(x, y, ND.pack(cc[0] * k, cc[1] * k, cc[2] * k, ci === 6 ? 170 : 255));
        }
      for (let x = 1; x < 23; x++) if (x % 5 !== 1) pb.set(x, 7, ND.pack(c[0] * 0.6, c[1] * 0.6, c[2] * 0.6));
      for (let y = 7; y < 19; y++) pb.set(12, y, ND.pack(40, 30, 50));
      pb.set(11, 19, ND.pack(40, 30, 50)); pb.set(10, 18, ND.pack(40, 30, 50));
      pb.set(12, 0, ND.pack(60, 50, 70));
      return pb.canvas();
    });
  }

  // Helicopter silhouette facing left (rotor drawn live).
  function genHeli() {
    const rows = [
      '........................',
      '........................',
      '....####...............#',
      '..#######.............##',
      '.##..#####..........###.',
      '##....#################.',
      '##########.###..........',
      '.########...............',
      '..######................',
      '..#....#................',
      '##########..............',
    ];
    const pb = new ND.PB(24, rows.length);
    rows.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch !== '#') return;
      const rim = y < 5 && (rows[y - 1] || '')[x] !== '#';
      pb.set(x, y, ND.pack(...(rim ? [58, 42, 92] : [14, 10, 24])));
    }));
    // cockpit glass glint
    pb.set(3, 4, ND.pack(90, 150, 200)); pb.set(4, 4, ND.pack(70, 110, 170));
    return pb.canvas();
  }

  // The tourist board's blimp, facing left, with a dark LED board on its side
  // (the text is scrolled onto it live). Envelope, fins, gondola.
  function genBlimp() {
    const L = 80, W = 84, H = 36, cy = 15.5, R = 11.5;
    const pb = new ND.PB(W, H);
    const P = (c) => ND.pack(c[0], c[1], c[2]);
    // radius along the hull: a blunt nose and a long taper to the tail
    const rAt = (x) => {
      const u = (x + 0.5) / L, t = u < 0.38 ? (u - 0.38) / 0.38 : (u - 0.38) / 0.62;
      return Math.abs(t) >= 1 ? 0 : R * Math.sqrt(1 - t * t);
    };
    const fin = (pts) => pb.polyFn(pts, (x, y) => {
      const edge = !pb.alpha(x, y - 1) && y > 0;
      pb.set(x, y, P(edge ? rgb('#ff8ad0') : ND.mix(rgb('#1c5a66'), rgb('#123c48'), (x - 60) / 20)));
    });
    fin([[61, cy - 8], [69, cy - 15], [78, cy - 15], [80, cy - 2]]);
    fin([[61, cy + 8], [69, cy + 15], [78, cy + 15], [80, cy + 2]]);
    for (let x = 0; x < L; x++) {
      const r = rAt(x);
      for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
        const ny = (y + 0.5 - cy) / (r || 1);
        if (Math.abs(ny) > 1) continue;
        const nx = Math.abs((x + 0.5) / L - 0.38) * 2;
        // moonlight on top, the city's pink glow underneath
        let c = ND.mix(rgb('#2e2842'), rgb('#aaa4cc'), Math.pow(Math.max(0, -ny), 0.9) * 0.75 + 0.12 - nx * 0.1);
        c = ND.mix(c, rgb('#b04c8e'), Math.pow(Math.max(0, ny), 1.6) * 0.55);
        if (Math.abs(ny) > 0.93) c = ND.scale(c, 0.7);
        if (x % 11 === 5 && Math.abs(ny) < 0.9) c = ND.scale(c, 0.9); // fabric gores
        pb.dset(x, y, c, 255, 10);
      }
    }
    // a pink pinstripe down the side, the horizontal fin, the gondola
    for (let x = 6; x < 70; x++) if (rAt(x) > 7.5) pb.set(x, Math.round(cy + 6), P(ND.mix(rgb('#ff6ac0'), rgb('#6a2a5a'), 0.35)));
    pb.polyFn([[62, cy - 1], [80, cy - 2.5], [81.5, cy + 2.5], [62, cy + 1]], (x, y) => pb.set(x, y, P(y < cy ? rgb('#2a7a88') : rgb('#15404c'))));
    const gy = Math.round(cy + R) - 1;
    for (let y = gy; y < gy + 5; y++) for (let x = 26; x <= 42; x++) {
      if ((y === gy || y === gy + 4) && (x < 28 || x > 40)) continue;
      pb.set(x, y, P(y === gy + 4 ? rgb('#16121e') : rgb('#2c2838')));
    }
    for (let x = 28; x <= 40; x += 2) pb.set(x, gy + 2, P(rgb('#ffd890')));
    // the LED board: dark cells in a thin frame
    const board = { x: 17, y: Math.round(cy) - 4, w: 44, h: 7 };
    for (let y = board.y - 1; y <= board.y + board.h; y++) for (let x = board.x - 1; x <= board.x + board.w; x++) {
      const frame = y < board.y || y >= board.y + board.h || x < board.x || x >= board.x + board.w;
      pb.set(x, y, P(frame ? rgb('#3a3448') : (x + y) % 2 ? rgb('#140c14') : rgb('#1c1018')));
    }
    return { c: pb.canvas(), W, H, board, beacon: [30, Math.floor(cy - R) - 1], gondola: [26, gy, 17] };
  }

  // What the blimp's sign says. Someone at the tourist board has had a night.
  const BLIMP_LINES = [
    'WELCOME TO MIAMI - PLEASE REMAIN TAN',
    'LOST: ONE ALLIGATOR. ANSWERS TO ELVIS',
    'VICE SQUAD NOW HIRING. SOCKS OPTIONAL',
    'PASTEL IS THE NEW BLACK',
    'HAIRSPRAY SALE! THE OZONE LAYER CAN WAIT',
    'SHOULDER PADS - 2 FOR 1 - WIDER IS BETTER',
    'NEW CAR PHONE! NOW ONLY 9 POUNDS',
    'BE KIND. REWIND.',
    'SAX SOLO IN 3... 2... 1...',
    "EAT AT JOE'S",
    'HONK IF YOU LOVE GATED REVERB',
    'FORECAST: 100% CHANCE OF NEON',
    'SUNGLASSES AT NIGHT? ALWAYS.',
    'MULLETS: BUSINESS UP FRONT. PARTY IN THE BACK',
    'THIS BLIMP RUNS ON SYNTHESIZERS',
    "SLOW DOWN - YOUR HAIR CAN'T TAKE IT",
    'FREE PERM WITH EVERY FILL-UP',
    'THE 90S ARE JUST A RUMOR',
    'WARNING: EXCESSIVE COOLNESS AHEAD',
    'HAPPY HOUR: 9PM TIL SUNRISE',
    'NO SOCKS. NO PROBLEM.',
  ];

  // Night aircraft: blinking planes high up, a helicopter sweeping a
  // searchlight over the skyline, and now and then the joke blimp.
  class Aircraft {
    constructor(seed) {
      this.r = ND.rng(seed);
      this.items = [];
      this.nextPlane = 60 * this.r.range(15, 45);
      this.nextHeli = 60 * this.r.range(30, 60);
      this.heli = genHeli();
      this.nextBlimp = 60 * this.r.range(20, 45);
      this.blimp = genBlimp();
      // each line pre-rendered as lit LEDs: amber, now and then pink or green
      const LED = [[255, 178, 70], [255, 178, 70], [255, 110, 200], [120, 255, 150]];
      this.lines = BLIMP_LINES.map((text, i) => {
        const mk = ND.textMask(text, { small: true, gap: 1 });
        const col = LED[i % LED.length];
        const pb = new ND.PB(mk.w, mk.h);
        for (let y = 0; y < mk.h; y++) for (let x = 0; x < mk.w; x++) if (mk.m[y * mk.w + x]) pb.set(x, y, ND.pack(col[0], col[1], col[2]));
        return { c: pb.canvas(), w: mk.w };
      });
      this.deck = [];
      this.searchBeam = (() => {
        // narrow vertical cone, apex at top-centre: a bright core that the
        // haze scatters into soft edges, fading out with distance
        const w = 28, h = 190;
        const pb = new ND.PB(w, h);
        for (let y = 0; y < h; y++) {
          const t = y / (h - 1), half = 1 + (w / 2 - 1) * Math.pow(t, 0.9);
          for (let x = 0; x < w; x++) {
            const dx = Math.abs(x - w / 2 + 0.5) / half;
            if (dx >= 1) continue;
            const across = Math.pow(1 - dx * dx, 1.6);
            const along = Math.pow(1 - t, 1.3) * (0.45 + 0.55 * Math.exp(-t * 2.5));
            const a = dq(across * along, x, y, 16);
            if (a > 0) pb.set(x, y, ND.pack(222 * a, 230 * a, 255 * a));
          }
        }
        return pb.canvas();
      })();
    }
    update(tick, weather) {
      const r = this.r;
      if (tick >= this.nextPlane) {
        const dir = r() < 0.5 ? -1 : 1;
        this.items.push({ kind: 'plane', x: dir < 0 ? W + 10 : -10, y: r.range(14, 70), vx: dir * r.range(0.18, 0.34) + 0.06, ph: r() * 100 });
        this.nextPlane = tick + 60 * r.range(40, 120);
      }
      if (tick >= this.nextHeli && weather.v.storm < 0.4) {
        const dir = r() < 0.5 ? -1 : 1;
        this.items.push({ kind: 'heli', x: dir < 0 ? W + 30 : -30, y: r.range(14, 36), vx: dir * r.range(0.4, 0.6) + 0.12, ph: r() * 100, dir });
        ND.bus.emit('heli');
        this.nextHeli = tick + 60 * r.range(70, 150);
      }
      if (tick >= this.nextBlimp) {
        // grounded in a storm, and there's only one
        if (weather.v.storm < 0.3 && !this.items.some((it) => it.kind === 'blimp')) {
          const dir = r() < 0.5 ? -1 : 1;
          this.items.push({ kind: 'blimp', x: dir < 0 ? W + 4 : -this.blimp.W - 4, y: r.int(40, 54), vx: dir * r.range(0.14, 0.2) + 0.05, ph: r() * 100, dir, line: this.nextLine(), scroll: 0 });
          ND.bus.emit('blimp');
        }
        this.nextBlimp = tick + 60 * r.range(150, 300);
      }
      for (const it of this.items) {
        it.x += it.vx;
        if (it.kind === 'blimp' && (it.scroll += 0.45) > this.lines[it.line].w + this.blimp.board.w + 16) {
          it.line = this.nextLine();
          it.scroll = 0;
        }
      }
      this.items = this.items.filter((it) => it.x > (it.kind === 'blimp' ? -this.blimp.W - 10 : -60) && it.x < W + 60);
    }
    // the sign's lines in a shuffled order, none repeated until all have run
    nextLine() {
      if (!this.deck.length) {
        this.deck = this.lines.map((_, i) => i);
        for (let i = this.deck.length - 1; i > 0; i--) { const j = Math.floor(this.r() * (i + 1)); [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]]; }
      }
      return this.deck.pop();
    }
    draw(R, kind, weather) {
      const { c, g, tick } = R;
      // on a phone the top of the picture is cropped off: fly below the crop
      // (the blimp already flies low enough)
      const lift = kind === 'blimp' ? 0 : Math.max(0, (R.r.cropY || 0) - 12);
      for (const it of this.items) {
        if (it.kind !== kind) continue;
        const x = Math.round(it.x), y = Math.round(it.y) + lift;
        const t = tick + it.ph * 60;
        if (kind === 'blimp') {
          const B = this.blimp, bd = B.board, flip = it.dir > 0;
          c.save();
          if (flip) { c.translate(x + B.W, y); c.scale(-1, 1); c.drawImage(B.c, 0, 0); } else c.drawImage(B.c, x, y);
          c.restore();
          // the sign reads left to right whichever way she flies
          const bx = x + (flip ? B.W - bd.x - bd.w : bd.x), by = y + bd.y;
          const L = this.lines[it.line], tx = bx + bd.w - Math.floor(it.scroll);
          for (const [ctx, a] of [[c, 1], [g, 0.85]]) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(bx, by, bd.w, bd.h);
            ctx.clip();
            ctx.globalAlpha = a;
            ctx.drawImage(L.c, tx, by + 1);
            ctx.restore();
          }
          g.fillStyle = 'rgba(255,170,90,0.12)';
          g.fillRect(bx - 2, by - 2, bd.w + 4, bd.h + 4);
          const gx = x + (flip ? B.W - B.gondola[0] - B.gondola[2] : B.gondola[0]);
          g.fillStyle = 'rgba(255,216,144,0.5)';
          g.fillRect(gx + 2, y + B.gondola[1] + 2, B.gondola[2] - 4, 1);
          if (t % 90 < 8) {
            const [ax, ay] = B.beacon, bx0 = x + (flip ? B.W - 1 - ax : ax);
            c.fillStyle = '#ff3040'; c.fillRect(bx0, y + ay, 1, 1);
            g.fillStyle = 'rgba(255,40,60,0.9)'; g.fillRect(bx0 - 1, y + ay - 1, 3, 3);
          }
        } else if (kind === 'plane') {
          c.fillStyle = '#1a1430';
          c.fillRect(x - 2, y, 5, 1);
          const strobe = t % 80 < 3, beacon = t % 64 < 8;
          if (strobe) { c.fillStyle = '#ffffff'; c.fillRect(x - 3, y, 1, 1); c.fillRect(x + 3, y, 1, 1); g.fillStyle = 'rgba(255,255,255,0.9)'; g.fillRect(x - 4, y - 1, 3, 3); g.fillRect(x + 2, y - 1, 3, 3); }
          if (beacon) { c.fillStyle = '#ff3040'; c.fillRect(x, y - 1, 1, 1); g.fillStyle = 'rgba(255,40,60,0.9)'; g.fillRect(x - 1, y - 2, 3, 3); }
          c.fillStyle = 'rgba(255,240,200,0.7)'; c.fillRect(x + (it.vx < 0 ? -2 : 2), y, 1, 1);
        } else {
          // searchlight first (behind the body)
          const ang = Math.sin(t * 0.006) * 0.55 + Math.sin(t * 0.0021) * 0.25;
          // the beam only shows where there is haze or rain to catch it
          const beamA = 0.1 + weather.v.fog * 0.3 + weather.v.rain * 0.14;
          c.save();
          c.globalCompositeOperation = 'lighter';
          c.globalAlpha = Math.min(0.42, beamA);
          c.translate(x + 7, y + 9);
          c.rotate(ang);
          c.drawImage(this.searchBeam, -14, 0);
          c.restore();
          g.save();
          g.globalAlpha = 0.1;
          g.translate(x + 7, y + 9);
          g.rotate(ang);
          g.drawImage(this.searchBeam, -14, 0);
          g.restore();
          // body (flip when flying right)
          c.save();
          if (it.dir > 0) { c.translate(x + 24, y); c.scale(-1, 1); c.drawImage(this.heli, 0, 0); }
          else c.drawImage(this.heli, x, y);
          c.restore();
          // rotor blur
          c.fillStyle = 'rgba(40,30,70,0.8)';
          const span = t % 4 < 2 ? 26 : 18;
          c.fillRect(x + 7 - span / 2, y + 1, span, 1);
          if (t % 50 < 6) { c.fillStyle = '#ff3040'; c.fillRect(x + 12, y + 2, 1, 1); g.fillStyle = 'rgba(255,40,60,1)'; g.fillRect(x + 11, y + 1, 3, 3); }
          g.fillStyle = 'rgba(255,255,255,0.8)';
          g.fillRect(x + 6, y + 8, 3, 2);
        }
      }
    }
  }

  ND.genCone = genCone;
  ND.genBeam = genBeam;
  ND.genGroundBeam = genGroundBeam;
  ND.genGrain = genGrain;
  ND.genUmbrellas = genUmbrellas;
  ND.Aircraft = Aircraft;
})();
