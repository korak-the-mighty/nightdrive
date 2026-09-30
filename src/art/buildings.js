/* Nightdrive — Art Deco street buildings with baked neon lighting.
 *
 * Each facade is authored as material maps (albedo, relief multiplier,
 * emissive, glass), lit by an ambient street/sky term plus every neon tube
 * and lit storefront as an area light, then dithered down to pixels. Neon
 * tubes and signs are drawn on top and also written to the emissive (glow)
 * sprite that feeds bloom and wet-road reflections.
 */
(function () {
  'use strict';
  const ND = window.ND;
  const { rgb } = ND;
  const BASE = ND.Y.BUILD;
  const EXPO = 1.08;

  const A = (hex) => rgb(hex).map((v) => v / 255); // albedo helper

  const PALETTES = {
    lavender: { wall: A('#b8a0ff'), trim: A('#e6dcff') },
    pink: { wall: A('#ffa8d8'), trim: A('#ffe0f0') },
    mint: { wall: A('#9ff0da'), trim: A('#e0fff4') },
    peach: { wall: A('#ffc6a8'), trim: A('#fff0e0') },
    sky: { wall: A('#a4d0ff'), trim: A('#e4f2ff') },
    cream: { wall: A('#f2e6d0'), trim: A('#ffffff') },
    lilac: { wall: A('#dca8f8'), trim: A('#f6e4ff') },
    teal: { wall: A('#7fd8e0'), trim: A('#d8fbff') },
    coral: { wall: A('#ff9c9c'), trim: A('#ffe0dc') },
  };
  const PAL_KEYS = Object.keys(PALETTES);

  const ROOMS = [
    { top: rgb('#ffe2a0'), bot: rgb('#ffb45c') },
    { top: rgb('#ffd08a'), bot: rgb('#ff9a48') },
    { top: rgb('#fff0c8'), bot: rgb('#f0c078') },
    { top: rgb('#ffc0a0'), bot: rgb('#ff8a6a') },
  ];

  // ---------------------------------------------------------------------------
  class Facade {
    constructor(w, h) {
      this.w = w;
      this.h = h;
      const N = w * h;
      this.kind = new Uint8Array(N); // 0 empty, 1 lit surface, 2 emissive, 3 glass
      this.alb = new Float32Array(N * 3);
      this.mul = new Float32Array(N).fill(1);
      this.emi = new Float32Array(N * 3);
      this.eg = new Float32Array(N);
      this.lights = [];
      this.col = new ND.PB(w, h);
      this.glow = new ND.PB(w, h);
      this.post = [];
      this.anims = [];
      this.pools = [];
      this.crowd = [];
      this.lamps = [];
    }
    each(x, y, w, h, fn) {
      x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
      const x0 = Math.max(0, x), y0 = Math.max(0, y), x1 = Math.min(this.w, x + w), y1 = Math.min(this.h, y + h);
      for (let yy = y0; yy < y1; yy++)
        for (let xx = x0; xx < x1; xx++) fn(yy * this.w + xx, xx, yy, (xx - x) / Math.max(1, w - 1), (yy - y) / Math.max(1, h - 1));
    }
    surf(x, y, w, h, alb, mul = 1) {
      this.each(x, y, w, h, (i) => {
        this.kind[i] = 1;
        this.alb[i * 3] = alb[0]; this.alb[i * 3 + 1] = alb[1]; this.alb[i * 3 + 2] = alb[2];
        this.mul[i] = mul;
      });
    }
    surfPx(x, y, alb, mul = 1) { this.surf(x, y, 1, 1, alb, mul); }
    mulRect(x, y, w, h, m) {
      this.each(x, y, w, h, (i) => { if (this.kind[i] === 1) this.mul[i] *= m; });
    }
    emit(x, y, w, h, fn, g = 0.45) {
      this.each(x, y, w, h, (i, xx, yy, u, v) => {
        const c = typeof fn === 'function' ? fn(xx, yy, u, v) : fn;
        if (!c) return;
        this.kind[i] = 2;
        this.emi[i * 3] = c[0]; this.emi[i * 3 + 1] = c[1]; this.emi[i * 3 + 2] = c[2];
        this.eg[i] = c[3] != null ? c[3] : g;
      });
    }
    glass(x, y, w, h, tint = 0) {
      this.each(x, y, w, h, (i, xx, yy, u, v) => {
        this.kind[i] = 3;
        this.alb[i * 3] = u; this.alb[i * 3 + 1] = v; this.alb[i * 3 + 2] = tint;
      });
    }
    clear(x, y, w, h) {
      this.each(x, y, w, h, (i) => { this.kind[i] = 0; });
    }
    light(x0, y0, x1, y1, c, I = 1, r = 14) {
      this.lights.push({ x0, y0, x1, y1, c: c.map((v) => v / 255), I, r });
    }
    *shade() {
      const { w, h } = this;
      const L = new Float32Array(w * h * 3);
      const top = BASE - h;
      for (let y = 0; y < h; y++) {
        const sy = top + y;
        const st = Math.exp(-(BASE - sy) / 40);
        const a0 = 0.22 + 0.42 * st, a1 = 0.17 + 0.25 * st, a2 = 0.38 + 0.14 * st;
        for (let x = 0, i = y * w * 3; x < w; x++, i += 3) { L[i] = a0; L[i + 1] = a1; L[i + 2] = a2; }
      }
      yield;
      for (const lt of this.lights) {
        const { x0, y0, x1, y1, c, I, r } = lt;
        const R = r * 3.2, R2 = R * R, inv = 1 / (r * r);
        const floorK = I / (1 + R2 * inv);
        const bx0 = Math.max(0, Math.floor(Math.min(x0, x1) - R)), bx1 = Math.min(w - 1, Math.ceil(Math.max(x0, x1) + R));
        const by0 = Math.max(0, Math.floor(Math.min(y0, y1) - R)), by1 = Math.min(h - 1, Math.ceil(Math.max(y0, y1) + R));
        const dx = x1 - x0, dy = y1 - y0, len2 = dx * dx + dy * dy || 1e-6;
        for (let y = by0; y <= by1; y++)
          for (let x = bx0; x <= bx1; x++) {
            let t = ((x - x0) * dx + (y - y0) * dy) / len2;
            t = t < 0 ? 0 : t > 1 ? 1 : t;
            const px = x0 + t * dx - x, py = y0 + t * dy - y;
            const d2 = px * px + py * py;
            if (d2 > R2) continue;
            const k = I / (1 + d2 * inv) - floorK;
            const i = (y * w + x) * 3;
            L[i] += c[0] * k; L[i + 1] += c[1] * k; L[i + 2] += c[2] * k;
          }
        yield;
      }
      const col = this.col, glow = this.glow;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = y * w + x, k = this.kind[i];
          if (!k) continue;
          const j = i * 3;
          if (k === 1) {
            const m = this.mul[i] * 255 * EXPO;
            col.dset(x, y, [this.alb[j] * L[j] * m, this.alb[j + 1] * L[j + 1] * m, this.alb[j + 2] * L[j + 2] * m], 255, 10);
          } else if (k === 2) {
            col.dset(x, y, [this.emi[j], this.emi[j + 1], this.emi[j + 2]], 255, 8);
            const g = this.eg[i];
            if (g > 0) glow.set(x, y, ND.pack(this.emi[j] * g, this.emi[j + 1] * g, this.emi[j + 2] * g));
          } else {
            const u = this.alb[j], v = this.alb[j + 1];
            let c = ND.mix([54, 46, 112], [10, 10, 30], Math.min(1, v * 1.3));
            const refl = 0.34;
            c = [c[0] + L[j] * 255 * refl, c[1] + L[j + 1] * 255 * refl, c[2] + L[j + 2] * 255 * refl];
            const streak = ((x + (y * 0.7) | 0) % 13);
            if (streak < 2) c = ND.mix(c, [150, 140, 220], 0.18);
            if (v < 0.06) c = ND.mix(c, [150, 140, 220], 0.3);
            col.dset(x, y, c, 255, 10);
          }
        }
        if ((y & 31) === 31) yield;
      }
      for (const p of this.post) { p(); yield; }
    }
  }
  ND.Facade = Facade;

  // ---------------------------------------------------------------------------
  // Interior painters (emissive)
  function roomFn(r) {
    const base = r.pick(ROOMS);
    const curtain = r.chance(0.55), blinds = !curtain && r.chance(0.5);
    const person = r.chance(0.22), pu = r.range(0.25, 0.75);
    const lamp = r.chance(0.3);
    return (x, y, u, v) => {
      let c = ND.mix(base.top, base.bot, v);
      if (lamp) c = ND.mix(c, [255, 250, 220], Math.max(0, 0.5 - Math.hypot(u - 0.5, v - 0.2) * 1.4));
      if (curtain && (u < 0.2 || u > 0.8)) c = ND.scale(c, 0.62);
      if (blinds && y % 2) c = ND.scale(c, 0.78);
      if (person) {
        const dx = (u - pu) * 6, hy = v - 0.35;
        if ((dx * dx + (hy * 5) * (hy * 5) < 1.1) || (v > 0.55 && Math.abs(u - pu) < 0.22)) c = [70, 30, 40];
      }
      return c;
    };
  }

  // Storefront interior with ceiling lights, back wall, silhouettes, tables.
  function interior(F, x0, y0, w, h, r, style) {
    const S = {
      restaurant: { top: rgb('#ffe6a8'), bot: rgb('#ff9f45'), sil: [74, 30, 32] },
      bar: { top: rgb('#ff8ad0'), bot: rgb('#a0306a'), sil: [44, 12, 44] },
      lobby: { top: rgb('#ffe0a0'), bot: rgb('#ffa852'), sil: [80, 40, 30] },
      shop: { top: rgb('#e8f6ff'), bot: rgb('#9fc4ea'), sil: [40, 44, 70] },
      diner: { top: rgb('#fff8e0'), bot: rgb('#ffc8a0'), sil: [70, 40, 50] },
      club: { top: rgb('#b070ff'), bot: rgb('#3a1c8a'), sil: [20, 8, 40] },
    }[style];
    const people = [];
    const n = Math.floor(w / r.range(9, 14));
    for (let i = 0; i < n; i++) {
      if (r() < 0.25) continue;
      people.push({
        x: r.range(3, w - 4),
        sit: r.chance(0.5),
        hy: 0,
        s: r.range(0.9, 1.15),
      });
    }
    const tables = [];
    if (style === 'restaurant' || style === 'diner' || style === 'bar')
      for (let x = 6; x < w - 6; x += r.int(14, 20)) tables.push(x + r.int(-2, 2));
    const shelves = style === 'bar' || style === 'shop' || style === 'club';
    // rasterise tables + silhouettes into a mask once
    const mask = new Uint8Array(w * h);
    const mset = (x, y, v) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < w && y < h) mask[y * w + x] = v; };
    for (const tx of tables) {
      for (let x = tx - 4; x <= tx + 4; x++) mset(x, h - 9, 2);
      for (let y = h - 8; y < h - 1; y++) mset(tx, y, 2);
    }
    for (const p of people) {
      const headY = p.sit ? h - 15 * p.s : h - 23 * p.s;
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (dx * dx + dy * dy <= 5.5) mset(p.x + dx, headY + dy, 1);
      const shoulder = headY + 3, bottom = p.sit ? h - 6 : h - 1;
      for (let ly = Math.ceil(shoulder); ly < bottom; ly++) {
        const half = ly < shoulder + 2 ? 2.2 + (ly - shoulder) : 3.4 - (ly - shoulder) * 0.06;
        for (let dx = -Math.floor(half); dx <= Math.floor(half); dx++) mset(p.x + dx, ly, 1);
      }
    }
    const silC = [...S.sil, 0.12], tabC = [...ND.scale(S.sil, 0.9), 0.1];
    const shelfY = Math.floor(h * 0.3);
    F.emit(x0, y0, w, h, (x, y, u, v) => {
      const lx = x - x0, ly = y - y0;
      const m = mask[ly * w + lx];
      if (m === 1) return silC;
      if (m === 2) return tabC;
      let c = ND.mix(S.top, S.bot, Math.pow(v, 0.8));
      // ceiling lights
      if (ly === 1 && (lx % 12 === 5 || lx % 12 === 6)) return [255, 252, 230, 0.9];
      if (ly <= 3) c = ND.mix(c, [255, 250, 225], 0.25 * (1 - ly / 4));
      // back wall shelf / bottles
      if (shelves && (ly === shelfY || ly === shelfY + 6)) c = ND.scale(c, 0.55);
      if (shelves && (ly === shelfY - 1 || ly === shelfY + 5) && ND.hash(lx, ly, 3) < 0.55) {
        const b = [[120, 255, 180], [255, 220, 120], [255, 120, 160], [140, 200, 255]][Math.floor(ND.hash(lx, 7) * 4)];
        c = ND.mix(c, b, 0.7);
      }
      if (!shelves && ly === shelfY && lx % 26 < 10) c = ND.scale(c, 0.7); // picture frames
      if (ly >= h - 2) c = ND.scale(c, 0.7);
      return c;
    }, 0.4);
    // light the surroundings (awning underside, sidewalk)
    const lc = ND.mix(S.top, S.bot, 0.5);
    F.light(x0 + 2, y0 + 2, x0 + w - 2, y0 + 2, lc, 0.9, 12);
    F.light(x0 + 2, y0 + h - 1, x0 + w - 2, y0 + h - 1, lc, 0.7, 10);
    F.pools.push({ x0, x1: x0 + w, c: lc, s: style === 'club' ? 0.5 : 0.8 });
  }

  // Door in the storefront.
  function door(F, x, y, w, h, trim, r) {
    F.surf(x - 1, y - 1, w + 2, h + 1, trim, 1.15);
    const lit = r.chance(0.8);
    if (lit) F.emit(x, y, w, h, (xx, yy, u, v) => (u > 0.45 && u < 0.55 ? [120, 70, 60] : ND.mix([255, 236, 190], [255, 170, 90], v)), 0.5);
    else F.glass(x, y, w, h);
  }

  // Striped fabric awning with scalloped valance.
  function awning(F, x, y, w, h, colA, colB, stripe = 6) {
    for (let yy = 0; yy < h; yy++) {
      for (let xx = 0; xx < w; xx++) {
        const band = Math.floor((xx + Math.floor(yy * 0.5)) / stripe) % 2;
        const alb = band ? colA : colB;
        let m = 0.8 + (yy / h) * 0.45;
        if (yy === 0) m = 1.3;
        F.surfPx(x + xx, y + yy, alb, m);
      }
    }
    // valance scallops
    for (let xx = 0; xx < w; xx++) {
      const s = Math.floor(xx / stripe) % 2 ? colA : colB;
      const dip = (xx % stripe) > 0 && (xx % stripe) < stripe - 1 ? 2 : 1;
      for (let k = 0; k < dip; k++) F.surfPx(x + xx, y + h + k, s, 1.05);
    }
  }

  // Box sign (e.g. HOTEL) with neon border.
  function boxSign(F, text, cx, y, neonName, opts = {}) {
    const [core, tube] = ND.NEON[neonName];
    const letterCore = opts.letterCore || rgb('#ffffff');
    const mk = ND.textMask(text, { scale: opts.scale || 2, gap: opts.gap || 2 });
    const padX = opts.padX || 6, padY = opts.padY || 4;
    const bw = mk.w + padX * 2, bh = mk.h + padY * 2;
    const x = Math.round(cx - bw / 2);
    const bg = opts.bg || ND.scale(tube, 0.2);
    F.emit(x, y, bw, bh, (xx, yy, u, v) => ND.mix(ND.scale(bg, 1.25), bg, v), 0);
    F.light(x, y + bh / 2, x + bw, y + bh / 2, tube, 1.15, 18);
    F.post.push(() => {
      const pts = [[x, y], [x + bw - 1, y], [x + bw - 1, y + bh - 1], [x, y + bh - 1], [x, y]];
      ND.neonPath(F.col, F.glow, pts, core, tube);
      ND.neonMask(F.col, F.glow, mk, x + padX, y + padY, letterCore, tube);
    });
    return { x, y, w: bw, h: bh };
  }

  // Vertical blade sign (e.g. COLONY).
  function bladeSign(F, text, cx, y, neonLetters, neonBorder, opts = {}) {
    const [lc, lt] = ND.NEON[neonLetters];
    const [bc, bt] = ND.NEON[neonBorder];
    const mk = ND.textMask(text, { vertical: true, scale: 2, gap: opts.gap || 4 });
    const pad = 5;
    const bw = mk.w + pad * 2, bh = mk.h + pad * 2 + 2;
    const x = Math.round(cx - bw / 2);
    F.emit(x, y, bw, bh, (xx, yy, u, v) => ND.mix([28, 26, 84], [14, 14, 50], v), 0);
    F.light(x, y, x, y + bh, bt, 1.1, 16);
    F.light(x + bw, y, x + bw, y + bh, bt, 1.1, 16);
    F.light(cx, y, cx, y + bh, lt, 0.6, 10);
    F.post.push(() => {
      const pts = [[x, y], [x + bw - 1, y], [x + bw - 1, y + bh - 1], [x, y + bh - 1], [x, y]];
      ND.neonPath(F.col, F.glow, pts, bc, bt);
      const pts2 = [[x - 2, y - 2], [x + bw + 1, y - 2], [x + bw + 1, y + bh + 1], [x - 2, y + bh + 1], [x - 2, y - 2]];
      ND.neonPath(F.col, F.glow, pts2, ND.mix(bc, bt, 0.4), bt, { halo: false });
      ND.neonMask(F.col, F.glow, mk, x + pad, y + pad + 1, lc, lt);
    });
    return { x, y, w: bw, h: bh };
  }

  // Neon palm-tree sculpture sign.
  function neonPalm(F, x, yBase, hgt, neonName) {
    const [core, tube] = ND.NEON[neonName];
    const top = [x + 5, yBase - hgt];
    F.light(x, yBase, top[0], top[1], tube, 1.0, 16);
    F.post.push(() => {
      const trunk = [];
      for (let i = 0; i <= 8; i++) {
        const t = i / 8;
        trunk.push([x + Math.sin(t * 1.6) * 5, yBase - t * hgt]);
      }
      ND.neonPath(F.col, F.glow, trunk, core, tube);
      const fr = [[-15, 6], [-13, -3], [-6, -8], [5, -8], [13, -3], [15, 6], [-9, 10], [9, 10]];
      for (const [fx, fy] of fr) {
        const pts = [];
        for (let i = 0; i <= 6; i++) {
          const t = i / 6;
          pts.push([top[0] + fx * t, top[1] + fy * t - Math.sin(t * Math.PI) * 5 + t * t * 5]);
        }
        ND.neonPath(F.col, F.glow, pts, core, tube);
      }
    });
  }

  // Horizontal neon line across a facade.
  function neonLine(F, x0, x1, y, neonName, I = 0.9) {
    const [core, tube] = ND.NEON[neonName];
    F.light(x0, y, x1, y, tube, I, 13);
    F.post.push(() => ND.neonPath(F.col, F.glow, [[x0, y], [x1, y]], core, tube));
  }
  function neonV(F, x, y0, y1, neonName, I = 0.9) {
    const [core, tube] = ND.NEON[neonName];
    F.light(x, y0, x, y1, tube, I, 13);
    F.post.push(() => ND.neonPath(F.col, F.glow, [[x, y0], [x, y1]], core, tube));
  }

  // Upper-floor window with eyebrow ledge.
  function upperWindow(F, x, y, w, h, trim, r, litP, deco) {
    if (deco !== 'none') {
      F.surf(x - 2, y - 4, w + 4, 1, trim, 1.35);
      F.surf(x - 2, y - 3, w + 4, 1, trim, 0.62);
      F.mulRect(x - 1, y - 2, w + 2, 1, 0.8);
    }
    F.surf(x, y, w, h, trim, 1.05);
    F.mulRect(x, y, 1, h, 1.1);
    const lit = r() < litP;
    if (lit) F.emit(x + 1, y + 1, w - 2, h - 2, roomFn(r), 0.32);
    else F.glass(x + 1, y + 1, w - 2, h - 2);
    if (w >= 9) F.surf(x + (w >> 1), y + 1, 1, h - 2, trim, 0.95);
    F.surf(x + 1, y + Math.round(h * 0.33), w - 2, 1, trim, 0.95);
    F.surf(x - 1, y + h, w + 2, 1, trim, 1.3);
    F.mulRect(x - 1, y + h + 1, w + 2, 2, 0.75);
    if (lit) {
      F.light(x + w / 2, y + h / 2, x + w / 2, y + h / 2, [255, 190, 110], 0.22, 7);
      if (r() < 0.12) F.anims.push({ type: 'tv', x: x + 1, y: y + 1, w: w - 2, h: h - 2, seed: r() * 1000 });
    }
    return lit;
  }

  function regionWindows(F, x0, x1, fy, fh, trim, r, litP, ww, deco) {
    const sp = r.int(5, 8);
    const rw = x1 - x0;
    const n = Math.max(0, Math.floor((rw + sp) / (ww + sp)));
    if (!n) return;
    const tot = n * ww + (n - 1) * sp;
    let x = Math.round(x0 + (rw - tot) / 2);
    const wy = fy + Math.round(fh * 0.24), wh = Math.round(fh * 0.54);
    for (let i = 0; i < n; i++, x += ww + sp) upperWindow(F, x, wy, ww, wh, trim, r, litP, deco);
  }

  // ---------------------------------------------------------------------------
  // Building types
  // ---------------------------------------------------------------------------

  // Art Deco hotel: parapet, stepped crown, window bays, fin with blade sign,
  // canopy with box sign, lit restaurant / lobby ground floor.
  function* genHotel(spec) {
    const r = ND.rng(spec.seed);
    const pal = spec.pal || PALETTES[r.pick(PAL_KEYS)];
    const wall = pal.wall, trim = pal.trim;
    const w = spec.w || r.int(170, 250);
    const n = spec.floors || r.int(2, 4);
    const fh = spec.floorH || r.int(36, 40);
    const gh = spec.groundH || r.int(62, 68);
    const ph = spec.parapetH || r.int(12, 20);
    let crownH = spec.crownH != null ? spec.crownH : r.chance(0.6) ? r.int(10, 22) : 0;
    if (spec.roofSign || (spec.name && !spec.blade && !spec.box)) crownH = Math.max(crownH, 12);
    const h = crownH + ph + n * fh + gh;
    const F = new Facade(w, h);
    const roofY = crownH, floorsY = crownH + ph, groundY = floorsY + n * fh;
    const neonA = spec.neonA || r.pick(['pink', 'cyan', 'magenta', 'blue', 'purple']);
    const neonB = spec.neonB || r.pick(['pink', 'cyan', 'magenta', 'orange', 'yellow']);
    const finX = spec.finX != null ? spec.finX : Math.round(w * r.range(0.35, 0.65));
    const finW = spec.finW || 14;

    // base wall + corners
    F.surf(0, roofY, w, h - roofY, wall);
    F.mulRect(0, roofY, 2, h - roofY, 0.72);
    F.mulRect(w - 2, roofY, 2, h - roofY, 0.84);

    // crown (stepped Deco tower over the fin)
    if (crownH) {
      const cw = Math.max(finW + 16, Math.round(w * 0.26));
      const cx0 = Math.round(finX - cw / 2);
      const s1 = Math.round(crownH * 0.45);
      F.surf(cx0, s1, cw, crownH - s1 + 1, trim, 1.0);
      F.surf(cx0 + 4, 0, cw - 8, s1 + 1, trim, 1.05);
      F.mulRect(cx0, s1, cw, 1, 1.3);
      F.mulRect(cx0 + 4, 0, cw - 8, 1, 1.3);
      for (let x = cx0 + 7; x < cx0 + cw - 7; x += 4) F.mulRect(x, 2, 1, crownH - 2, 0.72);
      if (r.chance(0.7)) {
        const [c, t] = ND.NEON[neonA];
        F.light(cx0 + 4, 0, cx0 + cw - 4, 0, t, 0.8, 10);
        F.post.push(() => ND.neonPath(F.col, F.glow, [[cx0, crownH], [cx0, s1], [cx0 + 4, s1], [cx0 + 4, 0], [cx0 + cw - 5, 0], [cx0 + cw - 5, s1], [cx0 + cw - 1, s1], [cx0 + cw - 1, crownH]], c, t));
      }
    }

    // parapet: cap, grooves ("speed lines"), cornice
    F.mulRect(0, roofY, w, 1, 1.3);
    F.mulRect(0, roofY + 1, w, 1, 0.72);
    for (let k = 0, y = roofY + 4; y < floorsY - 3; y += 3, k++) F.mulRect(3, y, w - 6, 1, 0.74);
    F.surf(0, floorsY - 2, w, 2, trim, 1.2);
    F.mulRect(0, floorsY, w, 2, 0.62);
    if (spec.roofNeon !== false && r.chance(0.55)) neonLine(F, 1, w - 2, floorsY - 3, neonA, 0.8);

    // fin (vertical feature) and edge pilasters
    const fx0 = Math.round(finX - finW / 2);
    F.surf(fx0, roofY - (crownH ? 0 : 4), finW, groundY - roofY + (crownH ? 0 : 4), trim, 1.02);
    F.mulRect(fx0, roofY, 1, groundY - roofY, 1.25);
    F.mulRect(fx0 + finW - 1, roofY, 1, groundY - roofY, 0.68);
    F.surf(0, floorsY, 5, groundY - floorsY, trim, 1.0);
    F.mulRect(4, floorsY, 1, groundY - floorsY, 0.7);
    F.surf(w - 5, floorsY, 5, groundY - floorsY, trim, 0.92);

    yield;
    // floors
    const litP = spec.litP != null ? spec.litP : r.range(0.25, 0.55);
    const ww = r.pick([10, 12, 14, 16]);
    const deco = r.pick(['eyebrow', 'eyebrow', 'none']);
    for (let f = 0; f < n; f++) {
      const fy = floorsY + f * fh;
      if (f > 0) F.mulRect(5, fy, w - 10, 1, 0.84);
      regionWindows(F, 7, fx0 - 3, fy, fh, trim, r, litP, ww, deco);
      regionWindows(F, fx0 + finW + 3, w - 7, fy, fh, trim, r, litP, ww, deco);
      yield;
    }
    // horizontal neon eyebrow on one floor
    if (spec.bandNeon !== false && r.chance(0.6)) {
      const f = r.int(0, n - 1), fy = floorsY + f * fh + Math.round(fh * 0.24) - 5;
      const side = r() < 0.5;
      neonLine(F, side ? 6 : fx0 + finW + 2, side ? fx0 - 3 : w - 6, fy, neonB, 0.8);
    }

    // ground floor
    const cy = groundY + 3, ch = 6;
    const glassY = cy + ch + 4, glassH = h - 4 - glassY;
    // plinth
    F.surf(0, h - 4, w, 4, ND.scale(wall, 0.55), 1);
    F.mulRect(0, h - 4, w, 1, 1.6);
    // storefront
    const style = spec.store || r.pick(['restaurant', 'restaurant', 'lobby', 'bar', 'diner']);
    const doorW = 12, doorX = Math.round(finX - doorW / 2);
    const segs = [[6, doorX - 3], [doorX + doorW + 3, w - 6]];
    for (const [a, b] of segs) {
      if (b - a < 8) continue;
      yield;
      interior(F, a, glassY, b - a, glassH, r, style);
      // mullions
      const step = r.int(18, 26);
      for (let x = a + step; x < b - 4; x += step) F.surf(x, glassY, 2, glassH, trim, 0.62);
      F.surf(a, glassY + Math.round(glassH * 0.22), b - a, 1, trim, 0.6);
      F.surf(a - 1, glassY - 1, b - a + 2, 1, trim, 0.85);
      F.surf(a - 1, glassY, 1, glassH, trim, 0.8);
      F.surf(b, glassY, 1, glassH, trim, 0.8);
    }
    door(F, doorX, glassY + 6, doorW, glassH - 6, trim, r);
    yield;
    // canopy / marquee
    const cx0 = spec.canopyX0 != null ? spec.canopyX0 : 3, cx1 = w - 3;
    F.surf(cx0, cy, cx1 - cx0, ch, trim, 1.0);
    F.mulRect(cx0, cy, cx1 - cx0, 1, 1.35);
    F.mulRect(cx0, cy + ch - 2, cx1 - cx0, 1, 0.8);
    F.mulRect(cx0, cy + ch, cx1 - cx0, 3, 0.55);
    // soffit lights
    F.emit(cx0 + 2, cy + ch, cx1 - cx0 - 4, 1, (x) => (x % 9 === 0 ? [255, 240, 200] : null), 0.9);
    const canopyNeon = spec.canopyNeon || neonA;
    neonLine(F, cx0, cx1 - 1, cy + ch - 1, canopyNeon, 1.1);

    // signs (random hotels get a name: vertical blade, box on the canopy or letters on the roof)
    if (!spec.blade && !spec.box && !spec.roofSign && spec.name) {
      const avail = groundY - roofY - 22;
      const nmax = Math.floor((avail - 12 + 4) / 18);
      const mode = r();
      if (mode < 0.5 && spec.name.length <= nmax && !spec.name.includes(' ')) {
        spec.blade = spec.name;
        spec.bladeLetters = r.pick(['cyan', 'white', 'pink', 'yellow']);
        spec.bladeBorder = r.pick(['blue', 'pink', 'magenta', 'cyan', 'purple']);
        if (r() < 0.6) spec.box = 'HOTEL';
      } else if (mode < 0.8 || ph < 16) {
        spec.box = spec.name;
        spec.boxNeon = r.pick(['pink', 'cyan', 'magenta', 'yellow', 'white', 'orange', 'purple']);
      } else {
        spec.roofSign = spec.name;
      }
    }
    if (spec.roofSign) {
      const [c, t] = ND.NEON[r.pick(['pink', 'cyan', 'yellow', 'magenta', 'orange'])];
      const mk = ND.textMask(spec.roofSign, { scale: 2, gap: 3 });
      const sx0 = Math.round(finX - mk.w / 2), sy0 = roofY - mk.h + 6;
      F.light(sx0, sy0 + 7, sx0 + mk.w, sy0 + 7, t, 1.1, 16);
      F.post.push(() => {
        for (let x = sx0; x < sx0 + mk.w; x += 6) for (let y = sy0 + mk.h; y < roofY + 2; y++) F.col.set(x, y, ND.pack(40, 30, 60));
        ND.neonMask(F.col, F.glow, mk, sx0, sy0, c, t);
      });
    }
    if (spec.blade) {
      const y0 = spec.bladeY != null ? spec.bladeY : roofY + 4;
      bladeSign(F, spec.blade, finX, y0, spec.bladeLetters || 'cyan', spec.bladeBorder || 'blue');
    }
    if (spec.box) {
      const mk = ND.textMask(spec.box, { scale: 2, gap: 2 });
      boxSign(F, spec.box, finX, cy - mk.h - 9, spec.boxNeon || 'pink');
    }
    if (spec.neonPalm) neonPalm(F, spec.neonPalm, h - 6, 44, 'pink');

    // crowd spots in front of the ground floor
    for (let x = 10; x < w - 10; x += r.int(14, 30)) if (r() < 0.65) F.crowd.push(x);
    F.lamps = spec.lamps || [];

    yield* F.shade();
    yield;
    return pack(F, w, h, spec);
  }

  // Low bar/club: two floors, script neon sign, striped awnings, vertical tube.
  function* genBar(spec) {
    const r = ND.rng(spec.seed);
    const pal = spec.pal || PALETTES[r.pick(PAL_KEYS)];
    const wall = pal.wall, trim = pal.trim;
    const w = spec.w || r.int(120, 170);
    const n = spec.floors || r.int(1, 2);
    const fh = 38, gh = spec.groundH || 64, ph = spec.parapetH || r.int(14, 22);
    const h = ph + n * fh + gh;
    const F = new Facade(w, h);
    const floorsY = ph, groundY = ph + n * fh;
    const neonA = spec.neonA || r.pick(['cyan', 'blue', 'green']);
    const neonB = spec.neonB || r.pick(['pink', 'red', 'magenta']);

    F.surf(0, 0, w, h, wall);
    F.mulRect(0, 0, 2, h, 0.72);
    F.mulRect(w - 2, 0, 2, h, 0.84);
    // streamline parapet with rounded right corner
    F.mulRect(0, 0, w, 1, 1.3);
    for (let y = 3; y < ph - 2; y += 3) F.mulRect(0, y, w, 1, 0.78);
    F.surf(0, ph - 2, w, 2, trim, 1.2);
    F.mulRect(0, ph, w, 2, 0.62);
    for (let y = 0; y < 8; y++) for (let x = w - 8 + y; x < w; x++) F.clear(x, y, 1, 1);
    // diagonal roof neon like the reference's pink streamline accent
    if (spec.diagNeon !== false) {
      const [c, t] = ND.NEON[neonB];
      F.light(w * 0.25, ph - 4, w - 2, 1, t, 0.9, 14);
      F.post.push(() => ND.neonPath(F.col, F.glow, [[Math.round(w * 0.25), ph - 4], [w - 9, ph - 4], [w - 2, 1]], c, t));
    }

    // vertical tube on the left pilaster
    F.surf(0, ph, 7, groundY - ph + 8, trim, 1.0);
    neonV(F, 3, ph + 2, groundY + 20, neonA, 1.2);

    const litP = r.range(0.3, 0.6);
    for (let f = 0; f < n; f++) {
      const fy = floorsY + f * fh;
      regionWindows(F, 10, w - 6, fy, fh, trim, r, litP, r.pick([12, 14]), 'eyebrow');
      yield;
    }

    // ground floor
    const style = spec.store || r.pick(['bar', 'club', 'bar']);
    const glassY = groundY + 22, glassH = h - 4 - glassY;
    F.surf(0, h - 4, w, 4, ND.scale(wall, 0.5), 1);
    F.mulRect(0, h - 4, w, 1, 1.6);
    const doorX = w - r.int(24, 34);
    interior(F, 9, glassY, doorX - 12, glassH, r, style);
    yield;
    for (let x = 9 + 20; x < doorX - 6; x += 20) F.surf(x, glassY, 2, glassH, trim, 0.6);
    door(F, doorX, glassY + 4, 12, glassH - 4, trim, r);
    if (doorX + 16 < w - 6) interior(F, doorX + 16, glassY, w - 6 - doorX - 16, glassH, r, style);
    // awning
    const [aa, ab] = r.pick([
      [A('#ff5fa8'), A('#ffe0f0')],
      [A('#40d0d0'), A('#e0ffff')],
      [A('#ff4a60'), A('#fff0f0')],
      [A('#8a5cff'), A('#f0e8ff')],
    ]);
    awning(F, 8, glassY - 11, w - 14, 7, aa, ab, 6);
    neonLine(F, 8, w - 7, glassY - 3, neonB, 0.9);

    // big script sign on the wall above the awning
    const text = spec.sign || r.pick(['BAR', 'CLUB', 'DISCO', 'LOUNGE', 'JAZZ']);
    let scale = text.length <= 3 ? 3 : 2;
    let mk = ND.textMask(text, { scale, gap: scale, italic: 4 });
    if (mk.w > w - 16) { scale = 1; mk = ND.textMask(text, { scale: 1, gap: 1, italic: 2 }); }
    const sx = Math.round((w - mk.w) / 2) + (spec.signDX || 0), sy = groundY + 22 - 14 - mk.h;
    const [sc, st] = ND.NEON[neonB];
    F.light(sx, sy + mk.h / 2, sx + mk.w, sy + mk.h / 2, st, 1.2, 18);
    const flick = { type: 'flicker', x: sx - 2, y: sy - 2, w: mk.w + 4, h: mk.h + 4, rate: r.range(0.02, 0.06), seed: r() * 100 };
    F.post.push(() => {
      flick.off = captureOff(F, flick, () => ND.neonMask(offPB, null, mk, 2, 2, sc, st, { on: false }));
      ND.neonMask(F.col, F.glow, mk, sx, sy, sc, st);
    });
    F.anims.push(flick);

    for (let x = 12; x < w - 10; x += r.int(14, 24)) if (r() < 0.8) F.crowd.push(x);
    yield* F.shade();
    yield;
    return pack(F, w, h, spec);
  }

  // Shop row: one or two floors, big parapet sign.
  function* genShop(spec) {
    const r = ND.rng(spec.seed);
    const pal = spec.pal || PALETTES[r.pick(PAL_KEYS)];
    const wall = pal.wall, trim = pal.trim;
    const w = spec.w || r.int(110, 170);
    const n = r.int(0, 1);
    const fh = 38, gh = 62, ph = r.int(26, 32);
    const h = ph + n * fh + gh;
    const F = new Facade(w, h);
    const groundY = ph + n * fh;
    const neon = spec.neon || r.pick(['pink', 'cyan', 'yellow', 'orange', 'green', 'magenta', 'red']);
    F.surf(0, 0, w, h, wall);
    F.mulRect(0, 0, 2, h, 0.72);
    F.mulRect(w - 2, 0, 2, h, 0.84);
    F.mulRect(0, 0, w, 1, 1.3);
    F.surf(0, ph - 2, w, 2, trim, 1.2);
    F.mulRect(0, ph, w, 2, 0.62);
    // sign panel on parapet
    const text = spec.sign || r.pick(['LIQUOR', 'PIZZA', 'VIDEO', 'ARCADE', 'DINER', 'CAFE', 'MUSIC', 'RECORDS', 'TATTOO', 'DONUTS', 'SURF']);
    const [c, t] = ND.NEON[neon];
    let mk = ND.textMask(text, { scale: 2, gap: 2 });
    if (mk.w > w - 10) mk = ND.textMask(text, { scale: 1, gap: 1 });
    const sx = Math.round((w - mk.w) / 2), sy = Math.round((ph - mk.h) / 2) - 1;
    F.light(sx, sy + 7, sx + mk.w, sy + 7, t, 1.1, 16);
    const flick = { type: 'flicker', x: sx - 2, y: sy - 2, w: mk.w + 4, h: mk.h + 4, rate: r.range(0.01, 0.05), seed: r() * 100 };
    F.post.push(() => {
      flick.off = captureOff(F, flick, () => ND.neonMask(offPB, null, mk, 2, 2, c, t, { on: false }));
      ND.neonMask(F.col, F.glow, mk, sx, sy, c, t);
    });
    F.anims.push(flick);
    for (let f = 0; f < n; f++) regionWindows(F, 6, w - 6, ph + f * fh, fh, trim, r, 0.4, 12, 'eyebrow');
    // storefront
    const glassY = groundY + 16, glassH = h - 4 - glassY;
    F.surf(0, h - 4, w, 4, ND.scale(wall, 0.5), 1);
    F.mulRect(0, h - 4, w, 1, 1.6);
    const style = r.pick(['shop', 'diner', 'shop', 'restaurant']);
    const doorX = r.chance(0.5) ? 10 : w - 24;
    const a0 = doorX < w / 2 ? doorX + 16 : 8, a1 = doorX < w / 2 ? w - 8 : doorX - 4;
    yield;
    interior(F, a0, glassY, a1 - a0, glassH, r, style);
    yield;
    for (let x = a0 + 22; x < a1 - 6; x += 22) F.surf(x, glassY, 2, glassH, trim, 0.6);
    door(F, doorX, glassY + 4, 12, glassH - 4, trim, r);
    if (r.chance(0.6)) {
      const [aa, ab] = r.pick([[A('#ff5fa8'), A('#ffe0f0')], [A('#40c0e0'), A('#f0ffff')], [A('#ffb040'), A('#fff4e0')], [A('#50e090'), A('#f0fff4')]]);
      awning(F, 4, glassY - 11, w - 8, 7, aa, ab, 5);
    } else {
      F.surf(4, glassY - 6, w - 8, 3, trim, 1.1);
      neonLine(F, 4, w - 5, glassY - 3, neon, 0.9);
    }
    for (let x = 12; x < w - 10; x += r.int(16, 30)) if (r() < 0.4) F.crowd.push(x);
    yield* F.shade();
    yield;
    return pack(F, w, h, spec);
  }

  // Roadside motel with tall pole sign, chasing-bulb arrow and VACANCY.
  function* genMotel(spec) {
    const r = ND.rng(spec.seed);
    const pal = spec.pal || PALETTES[r.pick(PAL_KEYS)];
    const wall = pal.wall, trim = pal.trim;
    const w = spec.w || r.int(170, 220);
    const bh = 38 + 60;
    const signH = 96;
    const h = bh + signH;
    const F = new Facade(w, h);
    const by = h - bh;
    F.surf(0, by, w, bh, wall);
    F.mulRect(0, by, w, 1, 1.3);
    F.surf(0, by + 1, w, 3, trim, 1.1);
    F.mulRect(0, by + 4, w, 2, 0.6);
    // walkway balcony
    const balY = by + 38;
    F.surf(0, balY, w, 3, trim, 1.2);
    F.mulRect(0, balY + 3, w, 2, 0.55);
    for (let x = 2; x < w; x += 4) F.surf(x, balY - 8, 1, 8, trim, 0.9);
    F.surf(0, balY - 9, w, 1, trim, 1.2);
    // room doors & windows (both floors)
    for (const fy of [by + 8, balY + 10]) {
      for (let x = 10; x < w - 20; x += 30) {
        F.surf(x, fy, 10, 20, ND.scale(trim, 0.9), 0.9);
        const lit = r() < 0.45;
        if (lit) F.emit(x + 14, fy + 2, 10, 9, roomFn(r), 0.35);
        else F.glass(x + 14, fy + 2, 10, 9);
        F.surf(x + 13, fy + 11, 12, 1, trim, 1.2);
        F.emit(x + 4, fy - 3, 2, 1, [255, 220, 150], 0.9);
        F.light(x + 5, fy - 3, x + 5, fy - 3, [255, 200, 120], 0.5, 8);
      }
    }
    F.surf(0, h - 4, w, 4, ND.scale(wall, 0.5), 1);
    F.mulRect(0, h - 4, w, 1, 1.6);
    yield;
    // lobby office at right
    interior(F, w - 40, balY + 10, 30, h - 4 - balY - 10, r, 'lobby');
    yield;

    // pole sign
    const px = r.int(20, 40);
    F.surf(px, 10, 4, h - 14, A('#8080a0'), 0.9);
    F.mulRect(px + 3, 10, 1, h - 14, 0.6);
    const text = spec.sign || 'MOTEL';
    const neon = r.pick(['pink', 'cyan', 'yellow', 'red']);
    const box = bladeLike(F, text, px + 2, 4, neon, r);
    // arrow with chasing bulbs
    const ay = box.y + box.h + 4;
    const ax0 = px - 14, ax1 = px + 44;
    const arrow = [[ax0 + 10, ay], [ax1, ay], [ax1, ay + 10], [ax0 + 10, ay + 10], [ax0 + 10, ay + 14], [ax0, ay + 5], [ax0 + 10, ay - 4], [ax0 + 10, ay]];
    const arrowCol = r.pick([[255, 70, 110], [255, 60, 60], [80, 220, 255], [255, 120, 40]]);
    F.emit(ax0, ay - 4, ax1 - ax0 + 1, 19, (x, y) => {
      const lx = x - ax0, ly = y - ay;
      const inside = lx < 10 ? Math.abs(ly - 5) <= lx * 0.9 : ly >= 0 && ly <= 10;
      if (!inside) return null;
      const edge = lx >= 10 && (ly === 0 || ly === 10 || x === ax1);
      const c = ND.mix(arrowCol, [255, 255, 255], edge ? 0.5 : 0.08 + 0.12 * Math.sin(lx * 0.5));
      return [c[0] * 0.85, c[1] * 0.85, c[2] * 0.85, 0.55];
    }, 0.55);
    F.light(ax0, ay + 5, ax1, ay + 5, arrowCol, 1.2, 18);
    const arrowText = r.pick(['OPEN', 'TV', 'POOL', 'COLOR TV', 'WATERBEDS', 'FREE ICE', 'CABLE TV', 'NO DISCO']);
    const am = ND.textMask(arrowText, { small: true, gap: 1 });
    F.post.push(() => {
      const tx = Math.round(ax0 + 12 + (ax1 - ax0 - 12 - am.w) / 2), ty = ay + 3;
      for (let y = 0; y < am.h; y++) for (let x = 0; x < am.w; x++) if (am.m[y * am.w + x]) { F.col.set(tx + x, ty + y, ND.pack(255, 255, 240)); F.glow.set(tx + x, ty + y, ND.pack(255, 240, 220)); }
    });
    const bulbs = [];
    for (let i = 0; i + 1 < arrow.length; i++) {
      const [x0, y0] = arrow[i], [x1, y1] = arrow[i + 1];
      const len = Math.hypot(x1 - x0, y1 - y0), steps = Math.max(1, Math.round(len / 3));
      for (let k = 0; k < steps; k++) bulbs.push([Math.round(x0 + ((x1 - x0) * k) / steps), Math.round(y0 + ((y1 - y0) * k) / steps)]);
    }
    const [bc, bt] = ND.NEON.yellow;
    F.light(ax0, ay + 5, ax1, ay + 5, bt, 0.9, 16);
    F.post.push(() => {
      for (const [x, y] of bulbs) F.col.set(x, y, ND.pack(120, 90, 40));
    });
    F.anims.push({ type: 'chase', pts: bulbs, color: bc, glow: bt, speed: 12 });
    // vacancy
    const vy = ay + 18;
    const [vc, vt] = ND.NEON.red;
    const vr = r();
    const vm = ND.textMask(vr < 0.45 ? 'VACANCY' : vr < 0.75 ? 'NO VACANCY' : vr < 0.9 ? 'MAYBE VACANCY' : 'VACANCY-ISH', { small: true, gap: 1 });
    F.emit(px - 4, vy - 2, vm.w + 4, vm.h + 4, [30, 10, 20], 0);
    const flick = { type: 'flicker', x: px - 3, y: vy - 1, w: vm.w + 2, h: vm.h + 2, rate: 0.15, seed: r() * 100, slow: true };
    F.post.push(() => {
      flick.off = captureOff(F, flick, () => ND.neonMask(offPB, null, vm, 1, 1, vc, vt, { on: false, halo: false }));
      ND.neonMask(F.col, F.glow, vm, px - 2, vy, vc, vt, { halo: false });
    });
    F.anims.push(flick);
    for (let x = w - 40; x < w - 10; x += 14) if (r() < 0.5) F.crowd.push(x);
    yield* F.shade();
    yield;
    return pack(F, w, h, spec);
  }

  // The NIGHT DRIVE building: a low Deco club with the big rooftop sign
  // (see bigsign.js) standing on its roof, lighting everything below it.
  function* genNightDrive(spec) {
    const r = ND.rng(spec.seed || 1985);
    const w = spec.w || 420;
    const ph = 12, fh = 38, gh = 64;
    const h = ph + fh + gh;
    const F = new Facade(w, h);
    const wall = A('#8f7cd0'), trim = A('#e2d8ff');
    const groundY = ph + fh;
    F.surf(0, 0, w, h, wall);
    F.mulRect(0, 0, 2, h, 0.72);
    F.mulRect(w - 2, 0, 2, h, 0.84);
    // parapet with speed grooves, and the club's own little sign
    F.mulRect(0, 0, w, 1, 1.35);
    for (let y = 3; y < ph - 2; y += 3) F.mulRect(3, y, w - 6, 1, 0.76);
    F.surf(0, ph - 2, w, 2, trim, 1.2);
    F.mulRect(0, ph, w, 2, 0.62);
    const om = ND.textMask('OPEN ALL NIGHT', { gap: 1 });
    const [oc, ot] = ND.NEON.cyan;
    const ox = Math.round((w - om.w) / 2);
    F.emit(ox - 4, 1, om.w + 8, ph - 2, [20, 12, 40], 0);
    F.light(ox, 5, ox + om.w, 5, ot, 0.9, 14);
    F.post.push(() => ND.neonMask(F.col, F.glow, om, ox, 2, oc, ot, { halo: false }));
    // the sign pours pink and cyan light down the facade
    F.light(40, -6, 380, -6, [255, 70, 190], 1.6, 34);
    F.light(150, -4, 270, -4, [255, 170, 90], 0.9, 26);
    F.light(40, -2, 120, -2, [60, 220, 255], 0.8, 22);
    F.light(300, -2, 380, -2, [60, 220, 255], 0.8, 22);
    yield;
    regionWindows(F, 8, w - 8, ph, fh, trim, r, 0.55, 14, 'eyebrow');
    neonLine(F, 4, w - 5, ph + fh - 4, 'pink', 0.9);
    yield;
    // ground floor: a glowing club front with a centre entrance and a canopy
    const glassY = groundY + 16, glassH = h - 4 - glassY;
    F.surf(0, h - 4, w, 4, ND.scale(wall, 0.5), 1);
    F.mulRect(0, h - 4, w, 1, 1.6);
    const doorX = Math.round(w / 2 - 8);
    interior(F, 10, glassY, doorX - 16, glassH, r, 'club');
    yield;
    interior(F, doorX + 22, glassY, w - 10 - doorX - 22, glassH, r, 'club');
    yield;
    for (let x = 10 + 24; x < doorX - 8; x += 24) F.surf(x, glassY, 2, glassH, trim, 0.6);
    for (let x = doorX + 22 + 24; x < w - 12; x += 24) F.surf(x, glassY, 2, glassH, trim, 0.6);
    door(F, doorX, glassY + 4, 16, glassH - 4, trim, r);
    F.surf(4, glassY - 8, w - 8, 4, trim, 1.15);
    F.mulRect(4, glassY - 4, w - 8, 2, 0.55);
    neonLine(F, 4, w - 5, glassY - 5, 'magenta', 1.0);
    for (let x = 16; x < w - 16; x += r.int(14, 22)) if (r() < 0.7) F.crowd.push(x);
    yield* F.shade();
    yield;
    const out = pack(F, w, h, spec);
    out.bigsign = ND.genBigSign(spec.seed || 1985);
    return out;
  }

  function bladeLike(F, text, cx, y, neonName, r) {
    const [c, t] = ND.NEON[neonName];
    const mk = ND.textMask(text, { vertical: true, scale: 2, gap: 3 });
    const bw = mk.w + 10, bh = mk.h + 10;
    const x = Math.round(cx - bw / 2);
    F.emit(x, y, bw, bh, (xx, yy, u, v) => ND.mix([60, 20, 60], [30, 10, 40], v), 0);
    F.light(x + bw / 2, y, x + bw / 2, y + bh, t, 1.3, 20);
    F.post.push(() => {
      ND.neonPath(F.col, F.glow, [[x, y], [x + bw - 1, y], [x + bw - 1, y + bh - 1], [x, y + bh - 1], [x, y]], c, t);
      ND.neonMask(F.col, F.glow, mk, x + 5, y + 5, [255, 255, 255], t);
    });
    return { x, y, w: bw, h: bh };
  }

  // Captures the facade pixels behind a flicker region, then paints the "off" sign.
  let offPB = null;
  function captureOff(F, fl, paint) {
    offPB = new ND.PB(fl.w, fl.h);
    for (let y = 0; y < fl.h; y++)
      for (let x = 0; x < fl.w; x++) offPB.set(x, y, F.col.get(fl.x + x, fl.y + y));
    paint();
    const c = offPB.canvas();
    offPB = null;
    return c;
  }

  function pack(F, w, h, spec) {
    return {
      spr: ND.sprite(F.col, F.glow),
      w,
      h,
      y: BASE - h,
      anims: F.anims,
      pools: F.pools,
      crowd: F.crowd,
      kind: spec.kind,
    };
  }

  ND.NAMES = {
    hotel: ['OCEAN', 'LUNA', 'STARLITE', 'PALMS', 'CORAL', 'NEPTUNE', 'AVALON', 'SUNSET', 'TROPICS', 'MARLIN', 'FLAMINGO',
      'PARADISE', 'BREEZE', 'ORCHID', 'SHORE', 'LAGUNA', 'AZURE', 'CABANA', 'NOVA', 'RIVIERA', 'SEABIRD', 'MOONLITE', 'DELMAR', 'ISLA',
      // the Miami Vice gag reel
      'MIAMI NICE', 'SUNBURN', 'NO SOCKS', 'BIG HAIR', 'SPF 2', 'THE MULLET', 'TAN LINES', 'EL TACKY', 'GATOR ARMS'],
    bar: ['BAR', 'CLUB', 'DISCO', 'LOUNGE', 'JAZZ', 'COCKTAILS', 'TIKI', 'NEON', 'SALSA', 'RUMBA', 'MAMBO', 'VICE',
      'SAX SOLO', 'KEYTAR', 'SYNTH & TONIC', 'MOONWALK', 'PINA COLADA', 'STAKEOUT', 'UNDERCOVER', "CROCKETT'S"],
    shop: ['LIQUOR', 'PIZZA', 'VIDEO', 'ARCADE', 'DINER', 'CAFE', 'MUSIC', 'RECORDS', 'TATTOO', 'DONUTS', 'SURF', 'CUBAN', 'GELATO', 'TACOS', 'ARCADE 24H',
      'BE KIND REWIND', 'NIGHT SHADES', 'PERMS 4 LESS', 'HAIRSPRAY 24H', 'LEG WARMERS', 'CAR PHONES', 'MIXTAPES', 'SHOULDER PADS', 'PASTEL SUITS', 'TAN-O-RAMA'],
    motel: ['INN', 'LODGE', 'MOTOR', 'SNORE', 'ZZZ'],
  };

  ND.BUILDING_GEN = { hotel: genHotel, bar: genBar, shop: genShop, motel: genMotel, nightdrive: genNightDrive };
  ND.PALETTES = PALETTES;
  ND.PAL_KEYS = PAL_KEYS;
})();
