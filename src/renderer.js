/* Nightdrive — frame renderer: layered composition, emissive buffer, wet-road
 * reflections, bloom and final presentation at integer pixel scale. */
(function () {
  'use strict';
  const ND = window.ND;
  const { W, H, CX, Y } = ND;
  const CURB = Y.CURB;
  const RH = H - CURB;

  function smoothCtx(cv) {
    const x = cv.getContext('2d');
    x.imageSmoothingEnabled = true;
    return x;
  }

  // Mode-7 style ground texture for the road: alpha = how much the asphalt
  // hides the reflection (puddles are nearly transparent = mirror-like).
  function makeRoadTexture(seed) {
    const T = 1024;
    const pb = new ND.PB(T, RH);
    for (let j = 0; j < RH; j++) {
      const y = CURB + j;
      const f = ND.fAt(y);
      const depth = 1 / f;
      for (let u = 0; u < T; u++) {
        const n = (a) => ND.fbm(a / 70, depth * 4.2, 4, seed);
        const k = u / T;
        const nn = n(u) * (1 - k) + n(u - T) * k; // periodic blend
        let a = 0.62;
        const puddle = ND.clamp((nn - 0.5) * 7, 0, 1);
        a = a * (1 - puddle * 0.88);
        let c = [12, 8, 22];
        const g = ND.hash(u, j, seed);
        if (g < 0.06) { c = [38, 30, 52]; a = Math.max(a, 0.55); }
        else if (g > 0.95) { a = Math.max(0, a - 0.2); }
        // gutter along the curb
        if (j < 5) { a = Math.max(a, 0.72 - j * 0.08); c = [10, 6, 16]; }
        // lane dashes
        if (y >= 298 && y <= 300 && u % 72 < 38) {
          c = y === 298 ? [255, 196, 96] : [214, 140, 40];
          a = 0.85;
        }
        pb.set(u, j, ND.pack(c[0], c[1], c[2], a * 255));
      }
    }
    return { canvas: pb.canvas(), T };
  }

  function makeSidewalkTexture(seed) {
    const T = 1024, SH = CURB - Y.BUILD;
    const pb = new ND.PB(T, SH);
    for (let j = 0; j < SH; j++) {
      const t = j / (SH - 1);
      for (let u = 0; u < T; u++) {
        let c = ND.mix([76, 42, 84], [58, 32, 72], t);
        const n = ND.fbm(u / 40, j / 3, 3, seed) - 0.5;
        c = ND.scale(c, 1 + n * 0.25);
        if (u % 48 < 3) c = ND.scale(c, 0.55);        // expansion joints
        if (j === 0) c = ND.scale(c, 0.7);             // building base shadow
        if (ND.hash(u, j, seed) < 0.04) c = ND.scale(c, 1.3);
        pb.dset(u, j, c, 255, 8);
      }
    }
    return { canvas: pb.canvas(), T, SH };
  }

  // Draws a horizontally tiling texture row with ground-plane perspective.
  function mode7Row(ctx, tex, T, row, y, D, f, n = 1) {
    const sw = W / f;
    let u0 = (-D - CX / f) % T;
    if (u0 < 0) u0 += T;
    if (u0 + sw <= T) {
      ctx.drawImage(tex, u0, row, sw, n, 0, y, W, n);
    } else {
      const w1 = T - u0;
      const dx = Math.round(w1 * f);
      ctx.drawImage(tex, u0, row, w1, n, 0, y, dx, n);
      ctx.drawImage(tex, 0, row, sw - w1, n, dx, y, W - dx, n);
    }
  }

  class Renderer {
    constructor(world, opts = {}) {
      this.world = world;
      this.opts = opts;
      this.scene = ND.canvas(W, H);
      this.c = ND.ctx(this.scene);
      this.glowC = ND.canvas(W, H);
      this.g = ND.ctx(this.glowC);

      this.bl = [ND.canvas(W / 2, H / 2), ND.canvas(W / 4, H / 4), ND.canvas(W / 8, Math.ceil(H / 8)), ND.canvas(W / 16, Math.ceil(H / 16))];
      this.blx = this.bl.map(smoothCtx);

      this.K = 1.45;
      this.TOPB = CURB - Math.ceil(RH * this.K) - 8;
      this.BH = CURB - this.TOPB;
      this.upper = ND.canvas(W, this.BH);
      this.upx = ND.ctx(this.upper);
      this.mix = ND.canvas(W, this.BH);
      this.mx = ND.ctx(this.mix);
      this.mb = [ND.canvas(W, Math.ceil(this.BH / 2)), ND.canvas(W, Math.ceil(this.BH / 4)), ND.canvas(W, Math.ceil(this.BH / 8))];
      this.mbx = this.mb.map(smoothCtx);
      this.wet = { ripple: 1, mirror: 1, streak: 1 };
      this.rsrc = ND.canvas(W, this.BH);
      this.rsx = ND.ctx(this.rsrc);
      this.fresnel = (() => {
        const pb = new ND.PB(W, RH);
        for (let j = 0; j < RH; j++)
          for (let x = 0; x < W; x++) {
            const a = ND.clamp(0.12 + (j / RH) * 0.55, 0, 1);
            const q = Math.floor(a * 16 + ND.bayer(x, j)) / 16;
            pb.set(x, j, ND.pack(12, 8, 24, q * 255));
          }
        return pb.canvas();
      })();
      this.refl = ND.canvas(W, RH);
      this.rx = ND.ctx(this.refl);
      this.strip = ND.canvas(W, 26);
      this.sx = ND.ctx(this.strip);

      this.carC = ND.canvas(ND.HERO.W, ND.HERO.H);
      this.carX = ND.ctx(this.carC);
      this.trafC = ND.canvas(ND.TRAFFIC.W, ND.TRAFFIC.H);
      this.trafX = ND.ctx(this.trafC);

      this.road = makeRoadTexture(world.seed + 3);
      this.walk = makeSidewalkTexture(world.seed + 4);
      this.vignette = ND.genVignette(W, H);
      this.vigTop = 110;
      this.vigSide = 190;
      this.haze = this.makeHaze();
      this.bloom = opts.bloom != null ? opts.bloom : 0.62;
      // quality: 2 = full, 1 = coarser ground/reflection rows, 0 = minimal
      this.q = opts.quality != null ? opts.quality : 2;

      // cinematic effects
      const HW = ND.HERO.W, HH = ND.HERO.H;
      this.fx = {
        rings: ND.genRings(),
        cone: ND.genCone(64, 118, [255, 186, 110]),
        beamAir: ND.genBeam(230, 16, [255, 244, 222]),
        beamGround: ND.genGroundBeam(220, 22, [255, 236, 200]),
        tBeamAir: ND.genBeam(130, 9, [255, 240, 210]),
        tBeamGround: ND.genGroundBeam(130, 12, [255, 230, 190]),
        redPool: ND.genPool(64, 14, [255, 40, 60], 0.7),
        grain: ND.genGrain(4, world.seed + 12),
        umbrellas: ND.genUmbrellas(),
        mistBack: ND.genMist(world.seed + 21, 1024, 70, [150, 118, 200], 0.6),
        mistFront: ND.genMist(world.seed + 22, 1024, 64, [132, 104, 186], 0.55),
        overcast: ND.genOvercast(world.seed + 23),
        skyFlash: (() => {
          const pb = new ND.PB(W, 240);
          for (let y = 0; y < 240; y++) for (let x = 0; x < W; x++) {
            const a = Math.pow(1 - y / 240, 1.4);
            const q = Math.floor(a * 14 + ND.bayer(x, y)) / 14;
            pb.set(x, y, ND.pack(170 * q, 160 * q, 255 * q));
          }
          return pb.canvas();
        })(),
      };
      this.rainC = ND.canvas(W, H);
      this.rainX = ND.ctx(this.rainC);
      this.lm = ND.canvas(W / 2, H / 2);
      this.lmx = smoothCtx(this.lm);
      this.envC = ND.canvas(HW, HH);
      this.envX = ND.ctx(this.envC);
      this.letter = 0;
      this.letterOn = false;
      this.grainOn = true;
      this.titlesOn = true;
    }

    // Tiles a horizontally-wrapping texture across the screen.
    tiled(img, off, y, alpha) {
      const c = this.c, T = img.width, h = img.height;
      let u = off % T;
      if (u < 0) u += T;
      const w1 = Math.min(W, T - u);
      c.globalAlpha = alpha;
      c.drawImage(img, u, 0, w1, h, 0, y, w1, h);
      if (w1 < W) c.drawImage(img, 0, 0, W - w1, h, w1, y, W - w1, h);
      c.globalAlpha = 1;
    }

    makeHaze() {
      const pb = new ND.PB(W, 120);
      for (let y = 0; y < 120; y++)
        for (let x = 0; x < W; x++) {
          const t = y / 119;
          const a = Math.sin(t * Math.PI) * 0.16 + t * 0.06;
          const q = Math.floor(a * 20 + ND.bayer(x, y)) / 20;
          if (q > 0) pb.set(x, y, ND.pack(120, 50, 140, q * 255));
        }
      return pb.canvas();
    }

    // Draw a sprite into the colour buffer; it occludes glow behind it and
    // contributes its own emissive pixels.
    spr(s, x, y) {
      this.c.drawImage(s.c, x, y);
      this.occlude(s.c, x, y);
      if (s.g) this.g.drawImage(s.g, x, y);
    }
    occlude(img, x, y, w, h) {
      const g = this.g;
      g.globalCompositeOperation = 'destination-out';
      if (w) g.drawImage(img, x, y, w, h);
      else g.drawImage(img, x, y);
      g.globalCompositeOperation = 'lighter';
    }

    render() {
      const w = this.world, c = this.c, g = this.g;
      const t = w.tick / 60;
      const wx = w.weather;
      const mp = ND.music ? ND.music.pulse() : null;
      this.mp = mp && mp.playing ? mp : null;
      const R = { c, g, t, tick: w.tick, D: w.D, r: this, weather: wx, boost: wx.boost, cloudShift: w.cloudShift };
      // the driver nods on the beat when the drums are in
      this.nod = this.mp && this.mp.energy >= 0.5 && this.mp.kick > 0.55 ? 1 : 0;
      this.wet.ripple = 1 + wx.v.rain * 0.8;
      this.wet.mirror = 1 + wx.v.rain * 0.12;
      this.wet.streak = 1 + wx.v.rain * 0.25 + wx.flash * 0.6;
      this.buildLightMap(R);
      c.globalCompositeOperation = 'source-over';
      c.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
      g.clearRect(0, 0, W, H);
      g.globalCompositeOperation = 'lighter';

      w.sky.draw(R);
      this.drawStormSky(R);
      w.air.draw(R, 'plane', wx);
      w.air.draw(R, 'heli', wx); // far away: the skyline and the street hide it and its beam
      this.drawSkyline(R);
      w.air.draw(R, 'blimp', wx); // over the city: in front of the skyline, behind the street
      this.drawBuildings(R);
      this.drawSidewalk(R);
      this.drawStreetLife(R);
      this.drawCurb(R);
      this.drawMist(R, 'back');
      this.drawRoad(R);
      this.drawSplashes(R);
      this.drawTraffic(R);
      if (this.q >= 2) this.drawRain(R, [0, 1, 3], 'back');
      this.drawHero(R);
      if (w.intro) w.intro.draw(R, this); // the man himself, leaning on the car
      this.drawRain(R, this.q >= 2 ? [2, 3] : [0, 1, 2, 3], this.q >= 2 ? 'front' : null);
      this.drawForeground(R);
      this.drawMist(R, 'front');
      this.post(R);
    }

    // ---------------------------------------------------------------------------
    drawSkyline(R) {
      const { c, g } = R;
      const w = this.world;
      w.skyLayers.forEach((layer, d) => {
        for (const it of layer.items) {
          const x = layer.x(it, R.D);
          if (x > W || x + it.w < 0) continue;
          this.spr(it.spr, x, it.y);
          for (const a of it.anims) this.anim(R, a, x, it.y);
        }
        if (d === 1) {
          c.globalAlpha = Math.min(1, 0.7 + R.weather.v.fog * 0.8);
          c.drawImage(this.haze, 0, 128);
          c.globalAlpha = 1;
        }
      });
      c.globalAlpha = Math.min(1, 0.55 + R.weather.v.fog * 1.1);
      c.drawImage(this.haze, 0, 150);
      c.globalAlpha = 1;
    }

    anim(R, a, ox, oy) {
      const { c, g, t } = R;
      switch (a.type) {
        case 'blink': {
          const ph = (t / a.period + a.phase) % 1;
          if (ph < 0.12) {
            c.fillStyle = ND.css(a.color);
            c.fillRect(ox + a.x, oy + a.y, 1, 1);
            g.fillStyle = ND.css(a.color, 0.9);
            g.fillRect(ox + a.x - 1, oy + a.y, 3, 1);
            g.fillRect(ox + a.x, oy + a.y - 1, 1, 3);
          }
          break;
        }
        case 'bridgeCars': {
          for (const car of a.cars) {
            let px = (car.off + R.tick * car.v * car.dir) % a.w;
            if (px < 0) px += a.w;
            const x = Math.round(ox + px), y = oy + a.y + (car.dir > 0 ? 1 : 0);
            if (car.dir > 0) {
              c.fillStyle = '#ff3a4a'; c.fillRect(x, y, 2, 1);
              g.fillStyle = 'rgba(255,40,60,0.8)'; g.fillRect(x - 1, y, 4, 1);
            } else {
              c.fillStyle = '#fff4d0'; c.fillRect(x, y, 2, 1);
              g.fillStyle = 'rgba(255,240,200,0.8)'; g.fillRect(x - 1, y, 4, 1);
            }
          }
          break;
        }
        case 'flicker': {
          let off = false;
          if (a.slow) off = Math.floor(t * 0.8 + a.seed) % 2 === 1;
          else {
            const k = Math.floor(t * 12);
            const burst = ND.hash(Math.floor(t * 0.5), a.seed | 0) < a.rate * 4 + (R.boost || 0) * 0.5;
            off = burst && ND.hash(k, (a.seed | 0) + 1) < 0.45;
          }
          if (off && a.off) {
            c.drawImage(a.off, ox + a.x, oy + a.y);
            g.globalCompositeOperation = 'destination-out';
            g.fillStyle = '#000';
            g.fillRect(ox + a.x, oy + a.y, a.w, a.h);
            g.globalCompositeOperation = 'lighter';
          }
          break;
        }
        case 'chase': {
          const step = Math.floor(t * a.speed);
          c.fillStyle = ND.css(a.color);
          g.fillStyle = ND.css(a.glow, 0.9);
          for (let i = 0; i < a.pts.length; i++) {
            if ((i + step) % 3) continue;
            const [px, py] = a.pts[i];
            c.fillRect(ox + px, oy + py, 1, 1);
            g.fillRect(ox + px - 1, oy + py, 3, 1);
          }
          break;
        }
        case 'tv': {
          const k = Math.floor(t * 8 + a.seed);
          const v = ND.hash(k, a.seed | 0);
          const col = v < 0.5 ? [90, 140, 255] : v < 0.8 ? [150, 200, 255] : [255, 255, 255];
          c.globalAlpha = 0.35 + v * 0.3;
          c.fillStyle = ND.css(col);
          c.fillRect(ox + a.x, oy + a.y, a.w, a.h);
          c.globalAlpha = 1;
          g.fillStyle = ND.css(col, 0.25);
          g.fillRect(ox + a.x, oy + a.y, a.w, a.h);
          break;
        }
      }
    }

    // ---------------------------------------------------------------------------
    drawBuildings(R) {
      const w = this.world, layer = w.buildings;
      for (const it of layer.items) {
        if (it.isGap) continue;
        const x = layer.x(it, R.D);
        if (x > W || x + it.w < 0) continue;
        if (!it.data) w.jobs.finish(it.job);
        const d = it.data;
        if (d.bigsign) ND.drawBigSignBeams(d.bigsign, R, x, d.y); // searchlights behind the sign
        this.spr(d.spr, x, d.y);
        for (const a of d.anims) this.anim(R, a, x, d.y);
        if (d.bigsign) ND.drawBigSign(d.bigsign, R, x, d.y, this);
      }
    }

    drawSidewalk(R) {
      const { c, g } = R;
      const w = this.world;
      const y0 = Y.BUILD, SH = this.walk.SH;
      // wet reflection source: the bottom of the buildings
      this.sx.clearRect(0, 0, W, 26);
      this.sx.drawImage(this.scene, 0, y0 - 26, W, 26, 0, 0, W, 26);
      const rs = this.q >= 2 ? 1 : 2;
      for (let j = 0; j < SH; j += rs) {
        const y = y0 + j;
        mode7Row(c, this.walk.canvas, this.walk.T, j, y, R.D, ND.fAt(y), Math.min(rs, SH - j));
      }
      // mirrored building bases
      for (let j = 1; j < SH; j++) {
        c.globalAlpha = Math.min(1, 0.32 * (1 + R.weather.v.rain * 0.6)) * (1 - j / SH);
        const sy = 25 - Math.floor(j * 1.3);
        if (sy < 0) break;
        c.drawImage(this.strip, 0, sy, W, 1, 0, y0 + j, W, 1);
      }
      c.globalAlpha = 1;
      // storefront light spilling onto the wet pavement
      c.globalCompositeOperation = 'lighter';
      const layer = w.buildings;
      for (const it of layer.items) {
        if (!it.data) continue;
        const x = layer.x(it, R.D);
        if (x > W || x + it.w < 0) continue;
        for (const p of it.data.pools) {
          c.globalAlpha = p.s;
          c.drawImage(w.spillFor(p.c), x + p.x0 - 4, y0, p.x1 - p.x0 + 8, SH);
        }
      }
      c.globalAlpha = 1;
      // lamp pools
      const curb = w.curb;
      for (const it of curb.items) {
        if (it.type !== 'lamp') continue;
        const x = curb.x(it, R.D);
        if (x < -60 || x > W + 60) continue;
        c.drawImage(w.lampPool, x - 45, CURB - 12);
      }
      c.globalCompositeOperation = 'source-over';
    }

    drawStreetLife(R) {
      const { c } = R;
      const w = this.world, layer = w.buildings;
      const FOOT = ND.PERSON.FOOT, FW = ND.PERSON.FW;
      // planters and patio crowds move with the buildings (f = 0.5)
      for (const it of layer.items) {
        if (!it.data || it.isGap) continue;
        const x = layer.x(it, R.D);
        if (x > W + 40 || x + it.w < -40) continue;
        for (const p of it.planters) {
          const img = p.p;
          c.drawImage(img.c, x + p.x, 236 - img.h);
          this.occlude(img.c, x + p.x, 236 - img.h);
        }
        for (const cr of it.crowd) {
          const fr = Math.floor(R.tick / cr.rate + cr.ph) % 4;
          const img = cr.p[cr.face][fr];
          const px = x + cr.x - FW / 2, py = 232 + cr.y - FOOT;
          c.drawImage(img, px, py);
          this.occlude(img, px, py);
        }
      }
      // walkers, back to front
      const walkers = w.walkers.slice().sort((a, b) => a.y - b.y);
      for (const p of walkers) {
        const x = Math.round(CX + (R.D - p.P) * p.f);
        if (x < -30 || x > W + 30) continue;
        const fr = Math.floor(R.tick / p.rate + p.ph) % 8;
        const img = (p.dir > 0 ? p.sp.walkL : p.sp.walkR)[fr];
        c.drawImage(img, x - FW / 2, p.y - FOOT);
        this.occlude(img, x - FW / 2, p.y - FOOT);
        if (p.umb >= 0 && R.weather.v.rain > 0.26) {
          const u = this.fx.umbrellas[p.umb];
          const ux = x - 12 + (p.dir > 0 ? -3 : 3), uy = p.y - 60 + (fr % 4 === 1 ? 1 : 0);
          c.drawImage(u, ux, uy);
          this.occlude(u, ux, uy);
        }
      }
    }

    drawCurb(R) {
      const { c, g, t } = R;
      const w = this.world, curb = w.curb;
      const base = CURB - 1;
      for (const it of curb.items) {
        const x = curb.x(it, R.D);
        if (it.type === 'lamp') {
          const L = it.lamp;
          if (x < -40 || x > W + 40) continue;
          const lx = x - L.baseX, ly = base - L.h + 2;
          this.spr(L.spr, lx, ly);
          g.drawImage(w.lampHalo, lx + L.light[0] - 30, ly + L.light[1] - 30);
        } else {
          const P = it.palm;
          if (x < -P.S || x > W + P.S) continue;
          const tx = x - P.bx, ty = base - P.h;
          c.drawImage(P.trunk.c, tx, ty);
          this.occlude(P.trunk.c, tx, ty);
          const fr = Math.floor((w.sway || t * 2.2) + it.ph) % ND.PALM_FRAMES;
          const img = P.crowns[fr];
          const cx = x + Math.round(P.topDX) - Math.round(P.ccx), cy = ty - Math.round(P.ccy);
          c.drawImage(img, cx, cy);
          this.occlude(img, cx, cy);
        }
      }
      // volumetric cones under the lamps: the more mist and rain, the stronger
      const vol = 0.1 + 0.6 * Math.max(R.weather.v.fog * 0.9, R.weather.v.rain);
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = Math.min(1, vol);
      for (const it of curb.items) {
        if (it.type !== 'lamp') continue;
        const x = curb.x(it, R.D), L = it.lamp;
        if (x < -60 || x > W + 60) continue;
        const px = x - L.baseX + L.light[0], py = base - L.h + 2 + L.light[1];
        c.drawImage(this.fx.cone, px - 32, py + 1);
      }
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'source-over';
      // the curb itself
      c.fillStyle = '#b388c0';
      c.fillRect(0, CURB, W, 1);
      c.fillStyle = '#3a2248';
      c.fillRect(0, CURB + 1, W, 1);
      c.fillStyle = '#1e1028';
      c.fillRect(0, CURB + 2, W, 2);
    }

    // ---------------------------------------------------------------------------
    drawRoad(R) {
      const { c, g, t } = R;
      const wet = this.wet;
      const TOPB = this.TOPB, BH = this.BH;
      // snapshot the band of the upper world that the road can reflect
      this.upx.drawImage(this.scene, 0, TOPB, W, BH, 0, 0, W, BH);
      // mix colour + emissive light, then smear it vertically (wet asphalt
      // scatters reflections into long streaks)
      const mx = this.mx;
      mx.globalCompositeOperation = 'source-over';
      mx.clearRect(0, 0, W, BH);
      mx.globalAlpha = 0.34 * wet.mirror;
      mx.drawImage(this.upper, 0, 0);
      mx.globalCompositeOperation = 'lighter';
      mx.globalAlpha = 1.2 * wet.streak;
      mx.drawImage(this.glowC, 0, TOPB, W, BH, 0, 0, W, BH);
      mx.globalAlpha = 1;
      const mb = this.mb, mbx = this.mbx;
      let src = this.mix;
      for (let i = 0; i < mb.length; i++) {
        mbx[i].clearRect(0, 0, W, mb[i].height);
        mbx[i].drawImage(src, 0, 0, W, src.height, 0, 0, W, mb[i].height);
        src = mb[i];
      }
      const sx = this.rsx;
      sx.globalCompositeOperation = 'source-over';
      sx.globalAlpha = 1;
      sx.fillStyle = '#0c0818';
      sx.fillRect(0, 0, W, BH);
      sx.globalAlpha = 0.16 * wet.mirror;
      sx.drawImage(this.upper, 0, 0);
      sx.globalCompositeOperation = 'lighter';
      this.rsx.imageSmoothingEnabled = true;
      sx.globalAlpha = 1;
      sx.drawImage(mb[2], 0, 0, W, mb[2].height, 0, 0, W, BH);
      sx.globalAlpha = 0.45;
      sx.drawImage(mb[0], 0, 0, W, mb[0].height, 0, 0, W, BH);
      this.rsx.imageSmoothingEnabled = false;
      sx.globalAlpha = 1;
      sx.globalCompositeOperation = 'source-over';

      // mirror it row by row with ripple distortion
      const rx = this.rx;
      rx.globalCompositeOperation = 'source-over';
      rx.fillStyle = '#0c0818';
      rx.fillRect(0, 0, W, RH);
      const K = this.K;
      const rstep = this.q >= 2 ? 1 : 2;
      for (let j = 0; j < RH; j += rstep) {
        const q = j / RH;
        const jit = (ND.noise(j * 0.7, t * 2.2, 5) - 0.5) * 3 * q;
        const sy = CURB - 1 - Math.floor((j + 1) * K + jit) - TOPB;
        if (sy < 0) break;
        const amp = (0.6 + q * 3.2) * wet.ripple;
        const dx = Math.round((ND.noise(j * 0.33, t * 0.9, 9) - 0.5) * 2 * amp + (ND.noise(j * 1.3, t * 3.1, 11) - 0.5) * amp * 0.8);
        rx.drawImage(this.rsrc, 0, sy, W, 1, dx, j, W, rstep);
      }
      // Fresnel: reflections fade as we look more steeply down at the road
      rx.drawImage(this.fresnel, 0, 0);

      c.fillStyle = '#0c0818';
      c.fillRect(0, CURB + 4, W, RH - 4);
      c.drawImage(this.refl, 0, 4, W, RH - 4, 0, CURB + 4, W, RH - 4);
      g.globalAlpha = 0.35;
      g.drawImage(this.refl, 0, 4, W, RH - 4, 0, CURB + 4, W, RH - 4);
      g.globalAlpha = 1;
      // asphalt with ground-plane perspective (puddles let reflections through)
      const ms = this.q >= 2 ? 1 : 2;
      for (let j = 4; j < RH; j += ms) {
        const y = CURB + j;
        mode7Row(c, this.road.canvas, this.road.T, j, y, R.D, ND.fAt(y), Math.min(ms, RH - j));
      }
    }

    // Draws a sprite canvas mirrored below groundY, row by row with ripples.
    reflect(img, x, groundY, h, alpha, t, rows) {
      const c = this.c;
      const n = Math.min(rows || h, H - groundY - 1);
      const st = this.q >= 2 ? 1 : 2;
      for (let k = 0; k < n; k += st) {
        const sy = h - 1 - k;
        if (sy < 0) break;
        const y = groundY + 1 + k;
        const amp = (0.5 + ((y - CURB) / RH) * 2.6) * this.wet.ripple;
        const dx = Math.round((ND.noise(y * 0.33, t * 0.9, 9) - 0.5) * 2 * amp + (ND.noise(y * 1.3, t * 3.1, 11) - 0.5) * amp * 0.8);
        c.globalAlpha = alpha * (1 - k / (n * 1.15));
        c.drawImage(img, 0, sy, img.width, 1, x + dx, y, img.width, st);
      }
      c.globalAlpha = 1;
    }

    drawTraffic(R) {
      const w = this.world;
      const tx = this.trafX;
      for (const car of w.traffic) {
        const x = Math.round(CX + (R.D - car.P) * car.f);
        const S = car.sp;
        if (x > W + 10 || x + S.w < -10) continue;
        tx.clearRect(0, 0, S.w, S.h);
        tx.drawImage(S.body.c, 0, 0);
        const fr = 3 - (Math.floor(car.wa) % 4); // counter-clockwise, like the hero's wheels
        for (const [wx, wy] of S.wheels) tx.drawImage(S.wheelFrames[fr], wx - S.wheelR, wy - S.wheelR);
        const y = Y.FAR - S.ground;
        // headlight beam ahead, brake-light glow behind (lighting the wet road)
        const air = 0.05 + 0.45 * Math.max(R.weather.v.rain, R.weather.v.fog * 0.8);
        const c0 = this.c;
        c0.globalCompositeOperation = 'lighter';
        c0.globalAlpha = 0.45;
        c0.drawImage(this.fx.tBeamGround, x - 128, Y.FAR - 6);
        c0.drawImage(this.fx.redPool, x + S.w - 34, Y.FAR - 5);
        c0.globalAlpha = air;
        c0.drawImage(this.fx.tBeamAir, x - 128, y + S.lampY - 9);
        c0.globalAlpha = 1;
        c0.globalCompositeOperation = 'source-over';
        this.g.globalAlpha = 0.3;
        this.g.drawImage(this.fx.tBeamGround, x - 128, Y.FAR - 6);
        this.g.globalAlpha = air * 0.6;
        this.g.drawImage(this.fx.tBeamAir, x - 128, y + S.lampY - 9);
        this.g.globalAlpha = 1;
        this.reflect(this.trafC, x, Y.FAR, S.h, 0.3, R.t, 30);
        this.c.drawImage(this.trafC, x, y);
        this.occlude(this.trafC, x, y);
        if (S.body.g) this.g.drawImage(S.body.g, x, y);
        if (S.bar) {
          const on = Math.floor(R.t * 6) % 2;
          const col = on ? '#ff2040' : '#3060ff';
          const half = S.bar.w >> 1, bx = x + S.bar.x + (on ? 0 : S.bar.w - half), by = y + S.bar.y;
          this.c.fillStyle = col;
          this.c.fillRect(bx, by, half, S.bar.h - 1);
          this.g.fillStyle = col;
          this.g.fillRect(bx - 3, by - 2, half + 6, S.bar.h + 4);
        }
        // tail light streak on the wet road
        this.g.fillStyle = 'rgba(255,30,50,0.35)';
        this.g.fillRect(x + S.w - 6, Y.FAR + 2, 5, 22);
      }
    }

    drawHero(R) {
      const w = this.world, h = w.hero;
      const cx = this.carX, HW = ND.HERO.W, HH = ND.HERO.H;
      cx.clearRect(0, 0, HW, HH);
      cx.drawImage(h.body.c, 0, h.bob);
      const x = h.x + (h.dx || 0), y = h.y;
      // live neon reflections sliding along the paint (last frame's bloom, mirrored)
      if (this.q >= 1) {
        const ex = this.envX;
        ex.globalCompositeOperation = 'source-over';
        ex.clearRect(0, 0, HW, HH);
        ex.imageSmoothingEnabled = true;
        ex.save();
        ex.translate(HW, 0);
        ex.scale(-1, 1);
        // upper flank mirrors the storefronts, lower flank the glowing wet road
        ex.drawImage(this.bl[1], ND.clamp(x / 4, 0, W / 4 - HW / 4), 120 / 4, HW / 4, 90 / 4, 0, 0, HW, 44);
        ex.drawImage(this.bl[1], ND.clamp(x / 4, 0, W / 4 - HW / 4), 282 / 4, HW / 4, 60 / 4, 0, 44, HW, HH - 44);
        ex.restore();
        ex.imageSmoothingEnabled = false;
        ex.globalCompositeOperation = 'destination-in';
        ex.drawImage(h.body.mask, 0, 0);
        cx.globalCompositeOperation = 'lighter';
        cx.globalAlpha = 0.6;
        cx.drawImage(this.envC, 0, h.bob);
        cx.globalAlpha = 1;
        cx.globalCompositeOperation = 'source-over';
      }
      // the NIGHT DRIVE sign washes the paint pink (and a little cyan)
      const sg = ND.signState;
      if (sg && sg.light > 0.01 && sg.x != null && sg.frame === R.tick) {
        const k = sg.light * ND.clamp(1 - Math.abs(sg.x - (x + HW / 2)) / 420, 0, 1);
        if (k > 0.01) {
          cx.globalCompositeOperation = 'source-atop';
          const gr = cx.createLinearGradient(0, 0, 0, HH);
          gr.addColorStop(0, `rgba(255,80,205,${0.55 * k})`);
          gr.addColorStop(0.3, `rgba(255,110,215,${0.25 * k})`);
          gr.addColorStop(0.62, `rgba(80,215,255,${0.12 * k})`);
          gr.addColorStop(1, 'rgba(0,0,0,0)');
          cx.fillStyle = gr;
          cx.fillRect(0, 0, HW, HH);
          cx.globalCompositeOperation = 'source-over';
        }
      }
      // lamps dark until the engine starts; pop-up headlights rise with them
      const lights = h.lights;
      if (lights < 1) {
        cx.globalAlpha = 1 - lights;
        cx.drawImage(h.body.lampsOff, 0, h.bob);
        cx.globalAlpha = 1;
      }
      if (h.pods > 0) {
        const up = Math.max(1, Math.round(h.pods * 4)), by = 36 + h.bob;
        for (let k = 0; k < up; k++) {
          cx.fillStyle = k === up - 1 ? '#ffffff' : k === 0 ? '#8a86a8' : '#e6e2f2';
          cx.fillRect(20, by - k, 11, 1);
        }
        cx.fillStyle = lights > 0.5 ? '#fffbe0' : '#9a96b0';
        cx.fillRect(20, by - up + 1, 1, Math.max(1, up - 1));
      }
      // the door, swung out towards us from its front hinge, and him getting in
      if (h.door > 0) {
        const th = h.door * 1.25, dw = Math.max(2, Math.round(67 * Math.cos(th))), b = h.bob;
        cx.fillStyle = '#120c1e'; cx.fillRect(107, 27 + b, 66, 33);
        cx.fillStyle = '#e4dcea'; cx.fillRect(147, 34 + b, 25, 13); // white leather, naturally
        cx.fillStyle = '#b8aecc'; cx.fillRect(147, 45 + b, 25, 2);
        cx.fillStyle = '#d6cee0'; cx.fillRect(161, 27 + b, 10, 8);
        cx.fillStyle = '#6a6488'; cx.fillRect(107, 57 + b, 66, 3);
        if (h.seat) this.drawSeat(cx, h);
        cx.drawImage(h.body.c, 106, 26, 68, 35, 106, 26 + b, dw, 35);
        cx.fillStyle = `rgba(30,16,50,${0.45 * Math.sin(th)})`;
        cx.fillRect(106, 26 + b, dw, 35);
        cx.fillStyle = '#f4f0ff';
        cx.fillRect(106 + dw, 27 + b, 1, 33);
      } else if (h.seat) this.drawSeat(cx, h);
      // driver (behind the door), then the door top again so the torso stays inside
      // he talks (lip sync from his voice) and sometimes turns to us, with a
      // nod when he's done. Before the shades go on (the opening) he's bare-eyed.
      const Dv = h.driver, tk = this.mp && this.mp.talk;
      const S = h.shades;
      const set = S >= 1 ? { c: Dv.c, talk: Dv.talk, cam: Dv.cam } : { c: S > 0.5 ? Dv.slide[1] : S > 0 ? Dv.slide[0] : Dv.bare, talk: Dv.bareTalk, cam: Dv.bareCam };
      let face = h.lookCam ? set.cam[0] : set.c, nod = this.nod || 0;
      if (tk) {
        const open = tk.mouth > 0.55 ? 2 : tk.mouth > 0.2 ? 1 : 0;
        if (tk.cam) face = set.cam[open];
        else if (open) face = set.talk[open - 1];
        if (tk.cam && tk.left < 0 && tk.left > -0.3) nod = 1;
      }
      if (h.driverIn) cx.drawImage(face, Dv.x, Dv.y + h.bob + nod);
      // window glass rolls up when it rains
      if (h.window > 0) {
        const top = Math.round(26 - h.window * 23);
        cx.drawImage(h.glass, 0, top, HW, 27 - top, 0, top + h.bob, HW, 27 - top);
        // the glass's top edge catches the light (same shape as the pane)
        cx.globalCompositeOperation = 'lighter';
        cx.globalAlpha = 0.7;
        cx.drawImage(h.glass, 0, top, HW, 1, 0, top + h.bob, HW, 1);
        cx.globalAlpha = 1;
        cx.globalCompositeOperation = 'source-over';
      }
      if (!h.door) cx.drawImage(h.body.c, 104, 26, 108, 2, 104, 26 + h.bob, 108, 2);
      // arm out of the window with the cigarette (pulled in when it rains)
      const A = h.arm;
      const af = A.frames[ND.clamp(Math.round(((h.armTh - A.th0) / (A.th1 - A.th0)) * (A.N - 1)), 0, A.N - 1)];
      if (h.armOut >= 0.999) {
        cx.drawImage(af.c, A.ox, A.oy + h.bob);
        const ember = 0.6 + 0.4 * ND.noise(R.t * 9, 3.3, 17);
        const tx = Math.round(af.tip[0]), ty = Math.round(af.tip[1]) + h.bob;
        cx.fillStyle = `rgb(255,${(150 + ember * 100) | 0},${(60 + ember * 80) | 0})`;
        cx.fillRect(tx, ty, 1, 1);
        cx.fillStyle = `rgb(255,${(70 + ember * 60) | 0},30)`;
        cx.fillRect(tx + 1, ty, 1, 1);
      } else if (h.armOut > 0) {
        // sliding up and in over the sill
        const lift = Math.round((1 - h.armOut) * 16);
        cx.save();
        cx.beginPath();
        cx.rect(0, 27 + h.bob, HW, HH);
        cx.clip();
        cx.drawImage(af.c, A.ox, A.oy + h.bob - lift);
        cx.restore();
      }
      const WF = h.wheels;
      // driving left = counter-clockwise spin (screen y points down, so the angle decreases)
      const spin = ((-h.angle % WF.period) + WF.period) % WF.period;
      const fr = Math.floor((spin / WF.period) * WF.frames.length) % WF.frames.length;
      for (const [wx, wy] of ND.HERO.WHEELS) cx.drawImage(WF.frames[fr], wx - WF.R, wy - WF.R);
      // driving lights: pool on the road ahead + a beam you can see in the rain
      const c = this.c, g0 = this.g;
      const air = (0.06 + 0.5 * Math.max(R.weather.v.rain, R.weather.v.fog * 0.8)) * lights;
      if (lights > 0) {
        c.globalCompositeOperation = 'lighter';
        c.globalAlpha = 0.55 * lights;
        c.drawImage(this.fx.beamGround, x - 212, Y.CAR - 12);
        c.drawImage(this.fx.redPool, x + 262, Y.CAR - 5);
        c.globalAlpha = air;
        c.drawImage(this.fx.beamAir, x - 226, y + 46 - 16);
        c.globalAlpha = 1;
        c.globalCompositeOperation = 'source-over';
        g0.globalAlpha = 0.35 * lights;
        g0.drawImage(this.fx.beamGround, x - 212, Y.CAR - 12);
        g0.globalAlpha = air * 0.6;
        g0.drawImage(this.fx.beamAir, x - 226, y + 46 - 16);
        g0.globalAlpha = 1;
      }
      this.reflect(this.carC, x, Y.CAR, HH, 0.34, R.t, 80);
      this.c.drawImage(this.carC, x, y);
      this.occlude(this.carC, x, y);
      const g = this.g;
      if (lights > 0) {
        g.globalAlpha = lights;
        this.g.drawImage(h.body.g, x, y + h.bob);
        // light streaks on the road below tail and marker lights
        g.fillStyle = 'rgba(255,30,50,0.45)';
        g.fillRect(x + 293, Y.CAR + 3, 6, 40);
        g.fillStyle = 'rgba(255,150,30,0.35)';
        g.fillRect(x + 1, Y.CAR + 6, 6, 26);
        if (h.pods > 0.5) { g.fillStyle = 'rgba(255,250,220,0.9)'; g.fillRect(x + 18, y + 32 + h.bob, 4, 4); }
        g.globalAlpha = 1;
      }
      // cigarette ember glow + smoke trail streaming back in the wind
      const A2 = h.arm;
      const af2 = A2.frames[ND.clamp(Math.round(((h.armTh - A2.th0) / (A2.th1 - A2.th0)) * (A2.N - 1)), 0, A2.N - 1)];
      const em = 0.6 + 0.4 * ND.noise(R.t * 9, 3.3, 17);
      if (h.armOut >= 0.999) g.fillStyle = `rgba(255,120,40,${0.9 * em})`;
      else g.fillStyle = 'rgba(0,0,0,0)';
      g.fillRect(Math.round(x + af2.tip[0]) - 1, Math.round(y + af2.tip[1]) + h.bob - 1, 4, 3);
      g.fillStyle = h.armOut >= 0.999 ? `rgba(255,200,120,${0.9 * em})` : 'rgba(0,0,0,0)';
      g.fillRect(Math.round(x + af2.tip[0]), Math.round(y + af2.tip[1]) + h.bob, 1, 1);
      // smoke is drawn after bloom (see post) so the glow doesn't wash it out
      this.smokeAt = [x, y];
      // spray thrown up by the tyres
      if (h.spray.length) {
        for (const p of h.spray) {
          const k = p.age / p.life;
          c.fillStyle = `rgba(222,216,250,${0.62 * (1 - k)})`;
          c.fillRect(Math.round(x + p.x), Math.round(y + p.y), k < 0.5 ? 2 : 1, k < 0.25 ? 2 : 1);
        }
      }
    }

    // Him getting into the seat while the door is open: the bare-eyed driver
    // head with his blazer below it, seen through the window and the doorway.
    drawSeat(cx, h) {
      const st = h.seat, Dv = h.driver, b = h.bob;
      cx.save();
      cx.beginPath();
      cx.moveTo(114.5, 26 + b); cx.lineTo(144.5, 4 + b); cx.lineTo(173, 4 + b); cx.lineTo(173, 26 + b); cx.closePath();
      if (h.door > 0) cx.rect(107, 26 + b, 66, 31);
      cx.clip();
      const hx = Math.round(st.x), hy = Math.round(st.y) + b;
      cx.fillStyle = '#8fb8f0'; cx.fillRect(hx + 3, hy + 20, 13, 24);
      cx.fillStyle = '#5474b4'; cx.fillRect(hx + 13, hy + 20, 3, 24);
      cx.fillStyle = '#f0ece4'; cx.fillRect(hx - 10, hy + 38, 18, 7);
      cx.drawImage(Dv.bare, hx, hy);
      cx.restore();
    }

    // "Now playing" card when a new track starts.
    drawTitle(R) {
      const mp = this.mp;
      if (!mp || !mp.track || !this.titlesOn || mp.trackAge > 8) return;
      const T = mp.track;
      if (!this.titleCache || this.titleCache.track !== T) {
        const top = ND.textMask('NOW PLAYING', { small: true, gap: 1 });
        const name = ND.textMask(T.name, { gap: 1 });
        const info = ND.textMask(`${T.key.toUpperCase().replace('#', ' SHARP')} - ${T.bpm} BPM${T.styleName ? ' - ' + T.styleName : ''}`, { small: true, gap: 1 });
        const w = Math.max(top.w, name.w, info.w) + 8, h = 30;
        const pb = new ND.PB(w, h), gl = new ND.PB(w, h);
        ND.neonMask(pb, gl, top, 3, 2, ...ND.NEON.cyan, { halo: false });
        ND.neonMask(pb, gl, name, 3, 10, ...ND.NEON.pink);
        ND.neonMask(pb, gl, info, 3, 21, ...ND.NEON.purple, { halo: false });
        this.titleCache = { track: T, spr: ND.sprite(pb, gl) };
      }
      const age = mp.trackAge;
      const a = age < 0.6 ? age / 0.6 : age > 6.5 ? Math.max(0, (8 - age) / 1.5) : 1;
      if (a <= 0) return;
      const c = this.c, s = this.titleCache.spr;
      const y = H - 44 - Math.max(Math.round(this.letter), this.cropY || 0); // clear of a phone's crop
      c.globalAlpha = a;
      c.drawImage(s.c, 14, y);
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = a * 0.6;
      if (s.g) c.drawImage(s.g, 14, y);
      c.globalCompositeOperation = 'source-over';
      c.globalAlpha = 1;
    }

    // Splash crowns and expanding ripple rings on the wet street.
    drawSplashes(R) {
      const sp = this.world.rain.splashes;
      if (!sp.length) return;
      const c = this.c, rings = this.fx.rings.rings;
      c.globalCompositeOperation = 'lighter';
      for (const s of sp) {
        const x = Math.round(CX + (R.D - s.P) * s.f);
        if (x < -12 || x > W + 12) continue;
        const k = s.age / s.life;
        const ri = Math.min(rings.length - 1, Math.floor(k * (2 + s.f * 4.5)));
        const img = rings[ri];
        c.globalAlpha = (1 - k) * (0.34 + s.f * 0.18);
        c.drawImage(img, x - (img.width >> 1), s.y - (img.height >> 1));
      }
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'source-over';
    }

    // Light map for rain: last frame's bloom over a dim ambient, so drops
    // sparkle where they pass neon, lamps and headlights.
    buildLightMap(R) {
      const l = this.lmx, fl = R.weather.flash;
      l.globalCompositeOperation = 'source-over';
      l.globalAlpha = 1;
      l.fillStyle = `rgb(${62 + fl * 150 | 0},${54 + fl * 140 | 0},${96 + fl * 150 | 0})`;
      l.fillRect(0, 0, W / 2, H / 2);
      l.globalCompositeOperation = 'lighter';
      l.drawImage(this.bl[0], 0, 0);
      l.drawImage(this.bl[0], 0, 0);
      l.globalCompositeOperation = 'source-over';
    }

    // Rain in two passes around the hero car: 'back' is everything behind
    // it, 'front' everything in front of it and landing on it (null: all).
    drawRain(R, which, pass) {
      const w = this.world, layers = w.rain.layers;
      const rc = this.rainX;
      let n = 0;
      rc.globalCompositeOperation = 'source-over';
      rc.clearRect(0, 0, W, H);
      const rain = R.weather.v.rain;
      const inPass = (f) => !pass || (pass === 'back' ? f < 1 : f >= 1);
      for (const i of which) {
        const L = layers[i];
        if (L.sheets) {
          const ox = Math.round(L.ox), oy = Math.round((R.tick * L.vy) % H);
          const nSheets = this.q >= 2 ? 3 : 1;
          rc.save();
          rc.beginPath();
          rc.rect(0, 0, W, L.ground); // the sheet ends where it reaches the ground
          rc.clip();
          for (let k = 0; k < nSheets; k++) {
            const a = (nSheets === 3 ? ND.clamp(rain * 3 - k, 0, 1) : Math.min(1, rain * 1.6)) * L.a;
            if (a < 0.02) continue;
            rc.globalAlpha = a;
            const img = L.sheets[k];
            rc.drawImage(img, ox - W, oy - H);
            rc.drawImage(img, ox, oy - H);
            rc.drawImage(img, ox - W, oy);
            rc.drawImage(img, ox, oy);
            n++;
          }
          rc.restore();
          continue;
        }
        if (!L.p.length) continue;
        rc.globalAlpha = L.a;
        for (const p of L.p) {
          if (L.impact && !inPass(p.f)) continue;
          const s = (L.cur || L.sprites)[p.s];
          rc.drawImage(s.c, Math.round(p.x - s.ox), Math.round(p.y - s.oy));
          n++;
        }
      }
      // splashes: a crown where the drop lands, then droplets thrown up
      const { crowns, bigCrowns } = this.fx.rings;
      const drop = (x, y, big, a) => { rc.globalAlpha = a; rc.fillRect(Math.round(x), Math.round(y), big ? 2 : 1, 1); };
      rc.fillStyle = '#fff';
      for (const s of w.rain.splashes) {
        if (!inPass(s.f)) continue;
        const x = CX + (R.D - s.P) * s.f;
        if (x < -12 || x > W + 12) continue;
        const big = s.big || s.f > 1.25;
        if (s.crown && s.age < 4) {
          const img = (big ? bigCrowns : crowns)[s.age % 3];
          rc.globalAlpha = 0.95 * (1 - s.age / 4);
          rc.drawImage(img, Math.round(x - (img.width >> 1)), s.y - img.height - (s.age < 2 ? 1 : 0));
          n++;
        }
        if (s.drops && s.age < 9) for (const [vx, vy] of s.drops) {
          const dy = vy * s.age * (0.6 + s.f * 0.4) + 0.16 * s.age * s.age;
          if (dy < 0) drop(x + vx * s.age * (0.6 + s.f * 0.4), s.y - 1 + dy, big, 0.9 * (1 - s.age / 9));
        }
      }

      if (!n) return;
      rc.globalAlpha = 1;
      if (this.q < 1) {
        // minimal quality: flat lavender rain, no light map
        rc.globalCompositeOperation = 'source-in';
        rc.fillStyle = 'rgb(120,110,170)';
        rc.fillRect(0, 0, W, H);
        rc.globalCompositeOperation = 'source-over';
        this.c.globalCompositeOperation = 'lighter';
        this.c.drawImage(this.rainC, 0, 0);
        this.c.globalCompositeOperation = 'source-over';
        return;
      }
      rc.globalCompositeOperation = 'source-in';
      rc.imageSmoothingEnabled = true;
      rc.drawImage(this.lm, 0, 0, W, H);
      rc.imageSmoothingEnabled = false;
      rc.globalCompositeOperation = 'source-over';
      const c = this.c;
      c.globalCompositeOperation = 'lighter';
      c.drawImage(this.rainC, 0, 0);
      c.globalCompositeOperation = 'source-over';
    }

    // Drops bursting on the hero car's roof, hood and deck. Light spray would
    // vanish on the white paint, so the water is cool blue with a glint.
    drawCarRain() {
      const w = this.world, h = w.hero, c = this.c, hx = h.x + (h.dx || 0);
      const CROWN = [[[0, -1], [-1, 0], [1, 0], [0, 0]], [[-2, -1], [2, -1], [-1, -1], [1, -1], [-1, 0], [1, 0]], [[-3, -2], [3, -2], [-2, -1], [2, -1]]];
      for (const hit of w.rain.carHits) {
        const x = Math.round(hx + hit.lx), y = Math.round(h.y + ND.HERO.topY(hit.lx) + h.bob) - 1;
        if (hit.age < 3) {
          c.globalAlpha = 0.9 - hit.age * 0.25;
          c.fillStyle = '#5a64b8';
          for (const [dx, dy] of CROWN[hit.age]) c.fillRect(x + dx, y + dy, 1, 1);
          if (hit.age === 0) { c.fillStyle = '#ffffff'; c.fillRect(x, y - 1, 1, 1); }
        }
        c.fillStyle = '#8c96e0';
        for (const [vx, vy] of hit.drops) {
          const dy = vy * hit.age + 0.18 * hit.age * hit.age;
          if (dy < 0.5) {
            c.globalAlpha = 0.9 * (1 - hit.age / 9);
            c.fillRect(Math.round(x + vx * hit.age), Math.round(y + dy), 1, 1);
          }
        }
      }
      c.globalAlpha = 1;
    }

    drawMist(R, which) {
      const v = R.weather.v;
      const a = which === 'back' ? 0.15 + v.fog * 0.95 : v.fog * 0.75 + v.rain * 0.12;
      if (a < 0.02) return;
      if (which === 'back') this.tiled(this.fx.mistBack, -(R.D * 0.55 + R.tick * 0.12), 196, Math.min(1, a));
      else this.tiled(this.fx.mistFront, -(R.D * 1.35 + R.tick * 0.25), H - 64, Math.min(1, a));
    }

    // Overcast, lightning bolts and sky flashes.
    drawStormSky(R) {
      const c = this.c, g = this.g, wx = R.weather;
      const oc = ND.clamp((wx.v.cloud - 0.45) * 1.9, 0, 1);
      if (oc > 0.01) this.tiled(this.fx.overcast, -(R.tick * 0.06 + R.D * 0.01), 0, oc);
      const fl = wx.flash;
      if (fl > 0.01) {
        c.globalCompositeOperation = 'lighter';
        c.globalAlpha = Math.min(1, fl * 0.6);
        c.drawImage(this.fx.skyFlash, 0, 0);
        if (oc > 0.01) this.tiled(this.fx.overcast, -(R.tick * 0.06 + R.D * 0.01), 0, Math.min(1, fl * oc * 1.2));
        c.globalCompositeOperation = 'lighter';
        const b = wx.bolt;
        if (b && b.img && fl > 0.2) {
          c.globalAlpha = Math.min(1, fl * 1.4);
          c.drawImage(b.img.c, b.x, 0);
          g.globalAlpha = Math.min(1, fl * 1.4);
          g.drawImage(b.img.g, b.x, 0);
          g.globalAlpha = 1;
        }
        c.globalAlpha = 1;
        c.globalCompositeOperation = 'source-over';
      }
    }

    drawForeground(R) {
      const w = this.world, fg = w.fg, c = this.c;
      for (const it of fg.items) {
        const x = fg.x(it, R.D);
        if (x > W || x + it.w < 0) continue;
        const img = it.img;
        const y = H - img.height * 2 + 10 + it.dy;
        c.drawImage(img, x, y, img.width * 2, img.height * 2);
        this.occlude(img, x, y, img.width * 2, img.height * 2);
      }
    }

    // ---------------------------------------------------------------------------
    post(R) {
      const c = this.c;
      // bloom: downsample chain, then accumulate back up
      const bl = this.bl, bx = this.blx;
      bx[0].globalCompositeOperation = 'source-over';
      bx[0].clearRect(0, 0, bl[0].width, bl[0].height);
      bx[0].drawImage(this.glowC, 0, 0, bl[0].width, bl[0].height);
      const levels = this.q >= 1 ? bl.length : 3;
      for (let i = 1; i < levels; i++) {
        bx[i].globalCompositeOperation = 'source-over';
        bx[i].clearRect(0, 0, bl[i].width, bl[i].height);
        bx[i].drawImage(bl[i - 1], 0, 0, bl[i].width, bl[i].height);
      }
      for (let i = levels - 1; i > 0; i--) {
        bx[i - 1].globalCompositeOperation = 'lighter';
        bx[i - 1].drawImage(bl[i], 0, 0, bl[i - 1].width, bl[i - 1].height);
      }
      c.imageSmoothingEnabled = true;
      c.globalCompositeOperation = 'lighter';
      const mp = this.mp;
      const pump = mp ? mp.kick * 0.08 * mp.energy + mp.drop * 0.4 : 0;
      c.globalAlpha = Math.min(1, this.bloom + pump);
      c.drawImage(bl[0], 0, 0, W, H);
      if (mp && mp.drop > 0.02) {
        // the drop: every neon on the street surges
        c.globalAlpha = mp.drop * 0.45;
        c.drawImage(this.glowC, 0, 0);
      }
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'source-over';
      c.imageSmoothingEnabled = false;
      // vignette: only its non-empty border strips
      const v = this.vignette, vt = this.vigTop, vs = this.vigSide;
      c.drawImage(v, 0, 0, W, vt, 0, 0, W, vt);
      c.drawImage(v, 0, H - vt, W, vt, 0, H - vt, W, vt);
      c.drawImage(v, 0, vt, vs, H - 2 * vt, 0, vt, vs, H - 2 * vt);
      c.drawImage(v, W - vs, vt, vs, H - 2 * vt, W - vs, vt, vs, H - 2 * vt);
      // rain bursting on the car (after bloom, which would wash it out on the white paint)
      this.drawCarRain();
      // cigarette smoke and sparks (after bloom: smoke isn't a light source)
      const h = this.world.hero, so = this.smokeAt;
      if (so && h.smoke.length) {
        for (const p of h.smoke) {
          const k = p.age / p.life;
          const px = Math.round(so[0] + p.x), py = Math.round(so[1] + p.y);
          if (p.spark) {
            c.fillStyle = `rgba(255,${150 + (1 - k) * 90 | 0},60,${1 - k})`;
            c.fillRect(px, py, 1, 1);
            continue;
          }
          if (p.exh) { // exhaust: bigger, softer puffs
            c.fillStyle = `rgba(160,150,196,${0.5 * Math.pow(1 - k, 0.8)})`;
            const sz = 2 + Math.floor(k * 3);
            c.fillRect(px, py, sz, sz);
            continue;
          }
          c.fillStyle = `rgba(146,136,182,${0.78 * Math.pow(1 - k, 0.75)})`;
          c.fillRect(px, py, k > 0.45 ? 2 : 1, k > 0.7 ? 2 : 1);
        }
      }
      if (this.world.intro) this.world.intro.drawPost(R, this); // his smoke, and PRESS START
      // lightning washes the whole street for a moment
      const fl = R.weather.flash;
      if (fl > 0.01) {
        c.globalCompositeOperation = 'lighter';
        c.fillStyle = `rgba(90,86,150,${Math.min(0.4, fl * 0.17)})`;
        c.fillRect(0, 0, W, H);
        c.globalCompositeOperation = 'source-over';
      }
      this.drawTitle(R);
      // film grain
      if (this.grainOn && this.q >= 1) {
        c.globalCompositeOperation = 'soft-light';
        c.globalAlpha = 0.55;
        c.drawImage(this.fx.grain[(R.tick >> 1) & 3], 0, 0);
        c.globalAlpha = 1;
        c.globalCompositeOperation = 'source-over';
      }
      // optional cinematic letterbox (2.39:1)
      const target = this.letterOn ? 46 : 0;
      this.letter += (target - this.letter) * 0.06;
      const lb = Math.round(this.letter);
      if (lb > 0) {
        c.fillStyle = '#000';
        c.fillRect(0, 0, W, lb);
        c.fillRect(0, H - lb, W, lb);
      }
    }
  }

  ND.Renderer = Renderer;
})();
