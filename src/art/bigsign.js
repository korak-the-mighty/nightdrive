/* Nightdrive — the NIGHT DRIVE rooftop sign: a neon extravaganza on a steel
 * lattice. A striped outrun sun, NIGHT in hot-pink tubes, DRIVE in chrome with
 * a cyan outline, speed lines, neon palms, a marquee of chasing bulbs, stars,
 * glints on the chrome and two searchlights sweeping the sky. It powers up
 * letter by letter, pulses with the kick and surges on a drop.
 *
 * The sign sprite sits on the roof of its building: sign-local (0, 0) is the
 * building's local (0, -110). Everything static (board, frame, lattice, dark
 * tubes, dim chrome) is baked into `base`; each lit element is its own layer.
 */
(function () {
  'use strict';
  const ND = window.ND;
  const { rgb } = ND;

  const SW = 420, SH = 112, ROOF = 110;
  const BOARD = { x0: 40, y0: 4, x1: 380, y1: 88 };
  const SUN = { cx: 210, cy: 76, r: 58 };
  const HORIZON = 78; // the sun sets behind it; the grid runs below it
  const SUN_FRAMES = 12;

  // --- mask helpers -----------------------------------------------------------
  function maskAt(mk, x, y) { return x >= 0 && y >= 0 && x < mk.w && y < mk.h ? mk.m[y * mk.w + x] : 0; }
  function pad(mk, p) {
    const w = mk.w + p * 2, h = mk.h + p * 2, m = new Uint8Array(w * h);
    for (let y = 0; y < mk.h; y++) for (let x = 0; x < mk.w; x++) if (mk.m[y * mk.w + x]) m[(y + p) * w + x + p] = 1;
    return { w, h, m };
  }
  function dilate(mk, r) {
    const out = new Uint8Array(mk.w * mk.h);
    for (let y = 0; y < mk.h; y++)
      for (let x = 0; x < mk.w; x++) {
        let hit = 0;
        for (let dy = -r; dy <= r && !hit; dy++)
          for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r + r && maskAt(mk, x + dx, y + dy)) { hit = 1; break; }
        out[y * mk.w + x] = hit;
      }
    return { w: mk.w, h: mk.h, m: out };
  }
  // pixels of the mask with a 4-neighbour outside it
  function edge(mk) {
    const out = new Uint8Array(mk.w * mk.h);
    for (let y = 0; y < mk.h; y++)
      for (let x = 0; x < mk.w; x++) {
        if (!mk.m[y * mk.w + x]) continue;
        if (!maskAt(mk, x - 1, y) || !maskAt(mk, x + 1, y) || !maskAt(mk, x, y - 1) || !maskAt(mk, x, y + 1)) out[y * mk.w + x] = 1;
      }
    return { w: mk.w, h: mk.h, m: out };
  }
  function minus(a, b) {
    const out = new Uint8Array(a.w * a.h);
    for (let i = 0; i < out.length; i++) out[i] = a.m[i] && !b.m[i] ? 1 : 0;
    return { w: a.w, h: a.h, m: out };
  }

  // a lit layer: its own colour + glow buffers over a box of the sign
  function layer(x, y, w, h) {
    return { x, y, w, h, col: new ND.PB(w, h), glow: new ND.PB(w, h) };
  }
  function bake(L) {
    L.c = L.col.canvas();
    L.g = L.glow.isEmpty() ? null : L.glow.canvas();
    delete L.col; delete L.glow;
    return L;
  }
  // tube pixels: bright core, a halo blended around it
  function tube(L, set, core, tubeC, opts = {}) {
    const has = (x, y) => set.has(x + ',' + y);
    const halo = opts.halo !== false;
    if (halo) {
      for (const k of set) {
        const [x, y] = k.split(',').map(Number);
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            if ((!dx && !dy) || has(x + dx, y + dy)) continue;
            L.col.blend(x + dx - L.x, y + dy - L.y, tubeC, dx && dy ? 0.35 : 0.6);
            L.glow.blend(x + dx - L.x, y + dy - L.y, ND.scale(tubeC, 0.7), dx && dy ? 0.4 : 0.7);
          }
      }
    }
    for (const k of set) {
      const [x, y] = k.split(',').map(Number);
      L.col.set(x - L.x, y - L.y, ND.pack(core[0], core[1], core[2]));
      const g = ND.mix(tubeC, core, 0.25);
      L.glow.set(x - L.x, y - L.y, ND.pack(g[0], g[1], g[2]));
    }
  }
  function lineSet(pts, set = new Set(), width = 1) {
    const pb = new ND.PB(1, 1);
    for (let i = 0; i + 1 < pts.length; i++)
      pb.lineFn(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], (x, y) => {
        set.add(x + ',' + y);
        if (width > 1) set.add(x + ',' + (y + 1));
      });
    return set;
  }

  function genBigSign(seed = 1985) {
    const r = ND.rng(seed);
    const P = (c, a = 255) => ND.pack(c[0], c[1], c[2], a);
    const base = new ND.PB(SW, SH), bglow = new ND.PB(SW, SH);
    const layers = {};

    // ---- lattice: posts and cross-braces from the board down to the roof
    const steel = rgb('#2a2238'), steelL = rgb('#6a4a7a'), steelD = rgb('#140e1e');
    for (let x = BOARD.x0 + 6; x <= BOARD.x1 - 6; x += 34) {
      for (let y = BOARD.y1; y <= ROOF; y++) { base.set(x, y, P(steelL)); base.set(x + 1, y, P(steel)); base.set(x + 2, y, P(steelD)); }
      if (x + 34 <= BOARD.x1 - 6) {
        base.lineFn(x + 2, BOARD.y1 + 1, x + 34, ROOF - 1, (px, py) => base.set(px, py, P(steel)));
        base.lineFn(x + 2, ROOF - 1, x + 34, BOARD.y1 + 1, (px, py) => base.set(px, py, P(steel)));
      }
    }
    for (let x = BOARD.x0; x <= BOARD.x1; x++) { base.set(x, BOARD.y1 + 1, P(steelL)); base.set(x, ROOF, P(steel)); base.set(x, ROOF + 1, P(steelD)); }
    // catwalk rail
    for (let x = BOARD.x0 - 4; x <= BOARD.x1 + 4; x++) base.set(x, ROOF - 7, P(steel));
    for (let x = BOARD.x0 - 4; x <= BOARD.x1 + 4; x += 6) for (let y = ROOF - 7; y < ROOF; y++) base.set(x, y, P(steel));

    // ---- the board: deep night glass inside a chrome frame
    for (let y = BOARD.y0; y <= BOARD.y1; y++)
      for (let x = BOARD.x0; x <= BOARD.x1; x++) {
        const fr = Math.min(x - BOARD.x0, BOARD.x1 - x, y - BOARD.y0, BOARD.y1 - y);
        let c;
        if (fr === 0) c = y === BOARD.y0 ? rgb('#ffffff') : rgb('#8a84b0');
        else if (fr === 1) c = y < BOARD.y0 + 3 ? rgb('#dcd8f0') : x - BOARD.x0 === 1 ? rgb('#c8c2e2') : rgb('#5a5480');
        else if (fr === 2) c = rgb('#2a2440');
        else {
          const v = (y - BOARD.y0) / (BOARD.y1 - BOARD.y0);
          c = ND.mix(rgb('#1a0c2e'), rgb('#0a0616'), v);
          if ((x + y * 3) % 29 === 0) c = ND.mix(c, rgb('#3a2a5a'), 0.5);
        }
        base.dset(x, y, c, 255, 8);
      }

    // ---- the sun (behind DRIVE): gradient disc with scrolling stripe gaps
    const sunBox = { x: SUN.cx - SUN.r, y: SUN.cy - SUN.r, w: SUN.r * 2 + 1, h: BOARD.y1 - 3 - (SUN.cy - SUN.r) };
    const sunGrad = [[0, rgb('#ffe83a')], [0.28, rgb('#ffa82a')], [0.5, rgb('#ff5a4a')], [0.72, rgb('#ff2a8a')], [1, rgb('#a01cff')]];
    const inSun = (x, y) => Math.hypot(x - SUN.cx, y - SUN.cy) <= SUN.r + 0.3 && y < HORIZON;
    const stripeGap = (y, ph) => {
      // gaps start a third of the way down and widen towards the bottom
      const top = SUN.cy - SUN.r * 0.45;
      if (y < top) return false;
      const u = (y - top + ph) / 7.5;
      const f = u - Math.floor(u);
      const width = 0.12 + ((y - top) / (HORIZON - top)) * 0.42;
      return f < width;
    };
    // dark sun (unlit glass) baked into the board
    for (let y = sunBox.y; y < sunBox.y + sunBox.h; y++)
      for (let x = sunBox.x; x < sunBox.x + sunBox.w; x++) {
        if (!inSun(x, y)) continue;
        const t = (y - (SUN.cy - SUN.r)) / (SUN.r * 2);
        base.set(x, y, P(ND.scale(ND.grad(sunGrad, t), 0.16)));
      }
    layers.sun = [];
    for (let f = 0; f < SUN_FRAMES; f++) {
      const L = layer(sunBox.x, sunBox.y, sunBox.w, sunBox.h);
      const ph = (f / SUN_FRAMES) * 7.5;
      for (let y = sunBox.y; y < sunBox.y + sunBox.h; y++)
        for (let x = sunBox.x; x < sunBox.x + sunBox.w; x++) {
          if (!inSun(x, y) || stripeGap(y, ph)) continue;
          const t = (y - (SUN.cy - SUN.r)) / (SUN.r * 2);
          let c = ND.grad(sunGrad, t);
          const rim = SUN.r - Math.hypot(x - SUN.cx, y - SUN.cy);
          if (rim < 1.2) c = ND.mix(c, [255, 255, 240], 0.35);
          L.col.dset(x - L.x, y - L.y, c, 255, 8);
          L.glow.set(x - L.x, y - L.y, P(ND.scale(c, 0.32)));
        }
      layers.sun.push(bake(L));
    }

    // ---- NIGHT: hot-pink tube outlines over tinted glass, a magenta outer tube
    const nightMk = ND.textMask('NIGHT', { scale: 4, gap: 5, italic: 9 });
    const nx0 = Math.round(SUN.cx - nightMk.w / 2), ny0 = BOARD.y0 + 6;
    const NP = pad(nightMk, 3);
    const nOuter = edge(minus(dilate(NP, 2), dilate(NP, 1)));
    const nKey = minus(dilate(NP, 1), NP);
    const [pinkCore, pinkTube] = ND.NEON.pink, [magCore, magTube] = ND.NEON.magenta;
    // one layer per letter so they can buzz on one by one
    const letterW = 4 * 5, letterGap = 5;
    layers.night = [];
    for (let i = 0; i < 5; i++) {
      const lx0 = i * (letterW + letterGap), lx1 = lx0 + letterW + 9 + 3 * 2; // italic shear + padding
      const L = layer(nx0 - 3 + lx0 - 2, ny0 - 3 - 2, lx1 - lx0 + 6, NP.h + 4);
      const inner = new Set(), outer = new Set(), fill = [];
      for (let y = 0; y < NP.h; y++)
        for (let x = 0; x < NP.w; x++) {
          const col = x - 3; // glyph-space x
          if (col < lx0 - 3 || col > lx1) continue;
          // which letter owns this column (by the sheared centre line)
          const gy = ND.clamp(y - 3, 0, nightMk.h - 1);
          const shear = Math.round(((nightMk.h - 1 - gy) / (nightMk.h - 1)) * 9);
          const own = Math.floor((col - shear + letterGap / 2) / (letterW + letterGap));
          if (own !== i) continue;
          const sx = nx0 - 3 + x, sy = ny0 - 3 + y;
          if (NP.m[y * NP.w + x]) {
            const onEdge = !maskAt(NP, x - 1, y) || !maskAt(NP, x + 1, y) || !maskAt(NP, x, y - 1) || !maskAt(NP, x, y + 1);
            if (onEdge) inner.add(sx + ',' + sy);
            else fill.push([sx, sy, y / NP.h]);
          } else if (nOuter.m[y * NP.w + x]) outer.add(sx + ',' + sy);
          else if (nKey.m[y * NP.w + x]) {
            L.col.set(sx - L.x, sy - L.y, P(rgb('#1a0628')));
            base.set(sx, sy, P(rgb('#1a0628')));
          }
        }
      for (const [sx, sy, v] of fill) {
        const c = ND.mix(rgb('#ff2aa8'), rgb('#b0107a'), v);
        L.col.set(sx - L.x, sy - L.y, P(c));
        L.glow.set(sx - L.x, sy - L.y, P(ND.scale(c, 0.22)));
        base.set(sx, sy, P(ND.scale(c, 0.22)));
      }
      tube(L, outer, ND.mix(magCore, magTube, 0.45), magTube, { halo: false });
      tube(L, inner, ND.mix(pinkCore, pinkTube, 0.4), pinkTube, { halo: false });
      for (const k of inner) { const [x, y] = k.split(',').map(Number); base.set(x, y, P(rgb('#4a2440'))); }
      for (const k of outer) { const [x, y] = k.split(',').map(Number); base.set(x, y, P(rgb('#3a2046'))); }
      layers.night.push(bake(L));
    }

    // ---- DRIVE: chrome letters with a dark keyline and a cyan tube outline
    const driveMk = ND.textMask('DRIVE', { scale: 5, gap: 5, italic: 7 });
    const DP = pad(driveMk, 4);
    const dx0 = Math.round(SUN.cx - driveMk.w / 2) - 4, dy0 = 44 - 4;
    const key = minus(dilate(DP, 1), DP), cyanRing = minus(dilate(DP, 2), dilate(DP, 1));
    const shadow = dilate(DP, 2);
    const chrome = [[0, rgb('#ffffff')], [0.18, rgb('#dff4ff')], [0.4, rgb('#7fb4ff')], [0.5, rgb('#3a3aa0')], [0.52, rgb('#1a0a3a')],
      [0.56, rgb('#ff5ac8')], [0.75, rgb('#ff9a6a')], [1, rgb('#ffe89a')]];
    const L = layer(dx0, dy0, DP.w + 3, DP.h + 4);
    const [cyCore, cyTube] = ND.NEON.cyan;
    const cy = new Set();
    layers.chromePts = [];
    for (let y = 0; y < DP.h; y++)
      for (let x = 0; x < DP.w; x++) {
        const sx = dx0 + x, sy = dy0 + y;
        // drop shadow, down and to the right, so the chrome lifts off the sun
        if (shadow.m[y * DP.w + x]) {
          base.set(sx + 2, sy + 3, P(rgb('#12061e')));
          L.col.set(sx + 2 - L.x, sy + 3 - L.y, P(rgb('#12061e')));
        }
      }
    for (let y = 0; y < DP.h; y++)
      for (let x = 0; x < DP.w; x++) {
        const sx = dx0 + x, sy = dy0 + y, i = y * DP.w + x;
        if (DP.m[i]) {
          const v = (y - 4) / driveMk.h;
          let c = ND.grad(chrome, ND.clamp(v, 0, 1));
          if (!maskAt(DP, x, y - 1)) c = ND.mix(c, [255, 255, 255], 0.7);
          if (!maskAt(DP, x - 1, y)) c = ND.mix(c, [255, 255, 255], 0.25);
          if (!maskAt(DP, x + 1, y)) c = ND.scale(c, 0.8);
          L.col.dset(sx - L.x, sy - L.y, c, 255, 6);
          L.glow.set(sx - L.x, sy - L.y, P(ND.scale(c, 0.12)));
          base.dset(sx, sy, ND.scale(c, 0.42), 255, 6);
          layers.chromePts.push([sx, sy]);
        } else if (key.m[i]) {
          L.col.set(sx - L.x, sy - L.y, P(rgb('#140828')));
          base.set(sx, sy, P(rgb('#140828')));
        } else if (cyanRing.m[i]) {
          cy.add(sx + ',' + sy);
          base.set(sx, sy, P(rgb('#1c3a4a')));
        }
      }
    tube(L, cy, cyCore, cyTube);
    layers.drive = bake(L);

    // ---- speed lines streaking out from DRIVE
    const lines = [
      { y: 54, x0: 52, x1: dx0 - 6, c: 'pink' }, { y: 61, x0: 64, x1: dx0 - 8, c: 'cyan' }, { y: 68, x0: 58, x1: dx0 - 10, c: 'purple' },
      { y: 54, x0: dx0 + DP.w + 5, x1: 368, c: 'pink' }, { y: 61, x0: dx0 + DP.w + 7, x1: 356, c: 'cyan' }, { y: 68, x0: dx0 + DP.w + 9, x1: 362, c: 'purple' },
    ];
    layers.lines = lines.map((ln) => {
      const Ll = layer(Math.min(ln.x0, ln.x1) - 1, ln.y - 1, Math.abs(ln.x1 - ln.x0) + 3, 3);
      const [c0, t0] = ND.NEON[ln.c];
      tube(Ll, lineSet([[ln.x0, ln.y], [ln.x1, ln.y]]), c0, t0);
      for (let x = Math.min(ln.x0, ln.x1); x <= Math.max(ln.x0, ln.x1); x++) base.set(x, ln.y, P(rgb('#2c2040')));
      return Object.assign(bake(Ll), { ln, tubeC: t0 });
    });

    // ---- neon palms on the roof, either side of the board
    const palm = (bx, dir) => {
      const set = new Set(), fr = new Set();
      const trunk = [];
      for (let i = 0; i <= 10; i++) {
        const t = i / 10;
        trunk.push([bx + dir * Math.sin(t * 1.5) * 9, ROOF - 2 - t * 66]);
      }
      lineSet(trunk, set);
      lineSet(trunk.map(([x, y]) => [x + 1, y]), set);
      const top = trunk[trunk.length - 1];
      for (const [fx, fy] of [[-18, 8], [-16, -4], [-7, -11], [6, -11], [16, -4], [18, 8], [-11, 13], [11, 13]]) {
        const pts = [];
        for (let i = 0; i <= 8; i++) {
          const t = i / 8;
          pts.push([top[0] + fx * t, top[1] + fy * t - Math.sin(t * Math.PI) * 6 + t * t * 7]);
        }
        lineSet(pts, fr);
      }
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const k of [...set, ...fr]) { const [x, y] = k.split(',').map(Number); x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
      const Lp = layer(x0 - 1, y0 - 1, x1 - x0 + 3, y1 - y0 + 3);
      tube(Lp, set, ...ND.NEON.green);
      tube(Lp, fr, ...ND.NEON.pink);
      for (const k of [...set, ...fr]) { const [x, y] = k.split(',').map(Number); base.set(x, y, P(rgb('#2a2440'))); }
      return bake(Lp);
    };
    layers.palms = [palm(20, 1), palm(SW - 22, -1)];

    // ---- the outrun grid below the horizon (unlit tubes), and an inner border tube
    for (let x = BOARD.x0 + 3; x <= BOARD.x1 - 3; x++) base.set(x, HORIZON, P(rgb('#3a1e4a')));
    const border = new Set();
    lineSet([[BOARD.x0 + 5, BOARD.y0 + 5], [BOARD.x1 - 5, BOARD.y0 + 5], [BOARD.x1 - 5, BOARD.y1 - 5], [BOARD.x0 + 5, BOARD.y1 - 5], [BOARD.x0 + 5, BOARD.y0 + 5]], border);
    for (const k of border) { const [x, y] = k.split(',').map(Number); base.set(x, y, P(rgb('#1e3040'))); }
    const Lb = layer(BOARD.x0 + 3, BOARD.y0 + 3, BOARD.x1 - BOARD.x0 - 5, BOARD.y1 - BOARD.y0 - 5);
    tube(Lb, border, ...ND.NEON.cyan);
    layers.border = bake(Lb);

    // ---- marquee bulbs around the frame, and stars on the board
    const bulbs = [];
    const { x0, y0, x1, y1 } = BOARD;
    for (let x = x0 + 3; x <= x1 - 3; x += 6) { bulbs.push([x, y0 + 1]); }
    for (let y = y0 + 6; y <= y1 - 4; y += 6) { bulbs.push([x1 - 1, y]); }
    for (let x = x1 - 3; x >= x0 + 3; x -= 6) { bulbs.push([x, y1 - 1]); }
    for (let y = y1 - 6; y >= y0 + 4; y -= 6) { bulbs.push([x0 + 1, y]); }
    for (const [x, y] of bulbs) base.set(x, y, P(rgb('#6a4a2a')));
    const stars = [];
    while (stars.length < 30) {
      const x = r.int(x0 + 6, x1 - 6), y = r.int(y0 + 5, y1 - 5);
      const clearText = (y > ny0 + 31 || y < ny0 - 4 || x < nx0 - 8 || x > nx0 + nightMk.w + 8) && (y < dy0 - 2 || x < dx0 - 6 || x > dx0 + DP.w + 6);
      const clearSun = Math.hypot(x - SUN.cx, y - SUN.cy) > SUN.r + 4 && y < HORIZON - 3 && x > BOARD.x0 + 8 && x < BOARD.x1 - 8 && y > BOARD.y0 + 8;
      const clearLines = !lines.some((ln) => Math.abs(y - ln.y) < 3 && x >= Math.min(ln.x0, ln.x1) - 2 && x <= Math.max(ln.x0, ln.x1) + 2);
      if (clearText && clearSun && clearLines) stars.push([x, y, r() * 10, r() < 0.3]);
    }

    // the grid's lines fanning out from the vanishing point (pixels, drawn live)
    const gridPts = [];
    for (let k = -14; k <= 14; k++) {
      base.lineFn(SUN.cx + k * 4, HORIZON + 1, SUN.cx + k * 26, BOARD.y1 - 3, (x, y) => {
        if (x >= BOARD.x0 + 3 && x <= BOARD.x1 - 3) gridPts.push([x, y]);
      });
    }
    return {
      gridPts,
      base: ND.sprite(base, bglow),
      layers, bulbs, stars,
      w: SW, h: SH, dy: -ROOF,
      beams: [[28, ROOF - 8], [SW - 28, ROOF - 8]],
      beamImg: [genSearchBeam([255, 170, 235]), genSearchBeam([170, 235, 255])],
      center: [SUN.cx, 46],
    };
  }

  // A searchlight cone pointing straight up, apex at the bottom centre.
  function genSearchBeam(tint) {
    const w = 60, h = 300;
    const pb = new ND.PB(w, h);
    for (let y = 0; y < h; y++) {
      const t = 1 - y / (h - 1); // 0 at the lamp, 1 at the far end
      const half = 1.5 + (w / 2 - 1.5) * t;
      for (let x = 0; x < w; x++) {
        const dx = Math.abs(x - w / 2 + 0.5) / half;
        if (dx >= 1) continue;
        const a = Math.pow(1 - dx * dx, 1.4) * Math.pow(1 - t, 0.8) * (0.5 + 0.5 * Math.exp(-t * 3));
        const q = Math.floor(a * 14 + ND.bayer(x, y)) / 14;
        // white-hot core, tinted towards the edges
        const k = Math.max(0, 1 - dx * 1.6);
        if (q > 0) pb.set(x, y, ND.pack((tint[0] + (255 - tint[0]) * k) * q, (tint[1] + (255 - tint[1]) * k) * q, (tint[2] + (255 - tint[2]) * k) * q));
      }
    }
    return pb.canvas();
  }

  // --------------------------------------------------------------------------------
  // Live drawing. `S` is the shared sign state: power-on start time, surge.
  const state = (ND.signState = ND.signState || { t0: null, surge: 0, light: 0 });

  function lit(t, on, i) {
    // before `on`: dark; right after it, a buzzing flicker; then steady
    if (t < on) return 0;
    if (t < on + 0.3) return ND.hash(Math.floor(t * 22), i * 7 + 3) < 0.55 ? 1 : 0.12;
    return 1;
  }

  function drawBeams(S, R, ox, oy) {
    const s = state;
    if (s.t0 == null) return;
    const t = R.t - s.t0;
    const a = ND.clamp((t - 2.6) / 0.8, 0, 1);
    if (a <= 0) return;
    const { c, g } = R;
    S.beams.forEach(([bx, by], i) => {
      const ang = Math.sin(R.t * 0.45 + i * 2.4) * 0.55 + (i ? 0.18 : -0.18);
      for (const [ctx, alpha] of [[c, 0.62], [g, 0.3]]) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = alpha * a * (1 + s.surge * 0.8);
        ctx.translate(ox + bx, oy + S.dy + by);
        ctx.rotate(ang);
        const img = S.beamImg[i];
        ctx.drawImage(img, -img.width / 2, -img.height);
        ctx.restore();
      }
    });
  }

  function draw(S, R, ox, oy, rr) {
    const s = state;
    if (s.t0 == null) s.t0 = R.t;
    const t = R.t - s.t0;
    const { c, g } = R;
    const X = ox, Y = oy + S.dy;
    const mp = rr.mp;
    const pulse = 0.85 + (mp ? mp.kick * 0.35 * Math.max(0.4, mp.energy) + mp.drop * 0.6 : 0) + s.surge * 0.8;
    s.surge = Math.max(0, s.surge - 1 / 40);
    rr.spr(S.base, X, Y);
    const put = (L, k, glowK = 1) => {
      if (k <= 0) return;
      c.globalAlpha = Math.min(1, k);
      c.drawImage(L.c, X + L.x, Y + L.y);
      c.globalAlpha = 1;
      if (L.g) {
        g.globalAlpha = Math.min(1, k * pulse * glowK);
        g.drawImage(L.g, X + L.x, Y + L.y);
        g.globalAlpha = 1;
      }
    };
    // the sun rises into its stripes, which scroll down forever
    const sunK = ND.clamp((t - 2.0) / 0.6, 0, 1);
    put(S.layers.sun[Math.floor(R.t * 6) % SUN_FRAMES], sunK);
    // the grid: magenta lines racing towards us from the vanishing point
    const gridK = ND.clamp((t - 2.1) / 0.5, 0, 1);
    if (gridK > 0) {
      const gx0 = BOARD.x0 + 3, gx1 = BOARD.x1 - 3, gy1 = BOARD.y1 - 3;
      c.globalAlpha = gridK;
      g.globalAlpha = gridK * pulse;
      c.fillStyle = '#ff5ad8';
      g.fillStyle = 'rgba(255,60,200,0.7)';
      c.fillRect(X + gx0, Y + HORIZON, gx1 - gx0, 1);
      g.fillRect(X + gx0, Y + HORIZON - 1, gx1 - gx0, 3);
      const ph = (R.t * 0.9) % 1;
      for (let k = 0; k < 4; k++) {
        const u = (k + ph) / 4, gy = Math.round(HORIZON + 1 + u * u * (gy1 - HORIZON - 1));
        c.fillRect(X + gx0, Y + gy, gx1 - gx0, 1);
        g.fillRect(X + gx0, Y + gy, gx1 - gx0, 1);
      }
      for (const [x, y] of S.gridPts) c.fillRect(X + x, Y + y, 1, 1);
      c.globalAlpha = 1;
      g.globalAlpha = 1;
    }
    put(S.layers.border, lit(t, 2.5, 30));
    // DRIVE: chrome catches the light, then the cyan tube strikes
    put(S.layers.drive, lit(t, 1.6, 11));
    // NIGHT, letter by letter; later the G buzzes now and then, like a real tube
    let bright = 0;
    S.layers.night.forEach((L, i) => {
      let k = lit(t, 0.35 + i * 0.22, i);
      if (i === 3 && t > 6 && ND.hash(Math.floor(R.t * 0.4), 91) < 0.18 && ND.hash(Math.floor(R.t * 16), 92) < 0.5) k = 0.15;
      put(L, k);
      bright += k / 5;
    });
    // speed lines, with a pulse of light racing outwards
    S.layers.lines.forEach((L, i) => {
      const k = lit(t, 2.3 + (i % 3) * 0.08, 20 + i);
      put(L, k);
      if (k >= 1) {
        const ln = L.ln, len = Math.abs(ln.x1 - ln.x0), dir = ln.x1 > ln.x0 ? 1 : -1;
        const from = dir > 0 ? ln.x0 : ln.x0;
        const p = ((R.t * 90 + i * 23) % (len + 30)) - 15;
        const px = from + dir * p;
        c.fillStyle = '#ffffff';
        g.fillStyle = ND.css(L.tubeC, 0.9);
        for (let k2 = 0; k2 < 6; k2++) {
          const x = Math.round(px - dir * k2 * 1.5);
          if ((x - ln.x0) * (x - ln.x1) > 0) continue;
          c.fillRect(X + x, Y + ln.y, 1, 1);
          g.fillRect(X + x - 1, Y + ln.y - 1, 3, 3);
        }
      }
    });
    S.layers.palms.forEach((L, i) => put(L, lit(t, 2.35 + i * 0.1, 40 + i)));
    // marquee bulbs: dark until the show starts, then chasing
    const bulbsOn = t > 2.6;
    const step = Math.floor(R.t * 14);
    S.bulbs.forEach(([bx, by], i) => {
      const on = bulbsOn && (i + step) % 4 !== 0;
      if (!on) return;
      const hot = (i + step) % 4 === 1;
      c.fillStyle = hot ? '#ffffff' : '#ffe08a';
      c.fillRect(X + bx, Y + by, 1, 1);
      g.fillStyle = hot ? 'rgba(255,236,170,0.95)' : 'rgba(255,200,90,0.6)';
      g.fillRect(X + bx - 1, Y + by - 1, 3, 3);
    });
    // stars twinkle on the board
    if (t > 2.6) {
      for (const [sx, sy, ph, big] of S.stars) {
        const tw = 0.5 + 0.5 * Math.sin(R.t * 2.2 + ph);
        if (tw < 0.25) continue;
        c.fillStyle = `rgba(255,255,255,${tw})`;
        c.fillRect(X + sx, Y + sy, 1, 1);
        if (big && tw > 0.8) {
          c.fillStyle = `rgba(200,220,255,${tw * 0.6})`;
          c.fillRect(X + sx - 1, Y + sy, 3, 1);
          c.fillRect(X + sx, Y + sy - 1, 1, 3);
        }
      }
    }
    // glints running over the chrome
    if (t > 2.2) {
      const gi = Math.floor(R.t * 1.6);
      for (let n = 0; n < 2; n++) {
        const age = R.t * 1.6 - gi;
        const pt = S.layers.chromePts[Math.floor(ND.hash(gi, n * 13 + 5) * S.layers.chromePts.length)];
        const sz = Math.round(Math.sin(age * Math.PI) * 3);
        if (sz <= 0) continue;
        const [gx, gy] = pt;
        c.fillStyle = '#ffffff';
        c.fillRect(X + gx - sz, Y + gy, sz * 2 + 1, 1);
        c.fillRect(X + gx, Y + gy - sz, 1, sz * 2 + 1);
        g.fillStyle = 'rgba(255,255,255,0.9)';
        g.fillRect(X + gx - 1, Y + gy - 1, 3, 3);
      }
    }
    // the big power-up flash when everything is on
    if (t > 2.8 && t < 3.3) s.surge = Math.max(s.surge, 0.7 * (1 - (t - 2.8) / 0.5));
    // how much light the sign throws on the street (for the car and the dude)
    s.light = ND.clamp(bright * 0.6 + sunK * 0.25 + (lit(t, 1.6, 11) ? 0.15 : 0), 0, 1) * (0.9 + (pulse - 0.85) * 0.5);
    s.x = X + S.center[0];
    s.frame = R.tick; // lit this frame (the car only takes its light while it's in view)
  }

  ND.genBigSign = genBigSign;
  ND.drawBigSign = draw;
  ND.drawBigSignBeams = drawBeams;
  ND.BIGSIGN = { W: SW, H: SH, ROOF };
})();
